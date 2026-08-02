import { createClient } from "@/lib/supabase/server";
import {
  computeSettlement,
  currentPeriodDay,
  totalPoints,
  type ActivityKind,
  type Participant,
} from "@/lib/rules";
import type { Activity, Member, Period } from "@/lib/types";
import { getActiveMembership } from "@/lib/active-group";

export interface SettlementRow {
  memberId: string;
  displayName: string;
  points: number;
  status: "active" | "sick" | "withdrawn";
  capApplied: number;
  owed: number;
  isRecordHolder: boolean;
  activities: Activity[];
}

export interface MyStanding {
  memberId: string;
  displayName: string;
  points: number;
  owed: number;
  status: "active" | "sick" | "withdrawn";
  isRecordHolder: boolean;
  /** Points behind the record holder. 0 when leading. */
  behind: number;
  /** Rank among non-withdrawn participants, 1-based. */
  rank: number;
  /** How many are being ranked. */
  of: number;
  /** True once the cap is reached -- further losses cost nothing more. */
  capReached: boolean;
}

export interface GroupSettlementView {
  groupId: string;
  groupName: string;
  isAdmin: boolean;
  inviteCode: string;
  me: MyStanding | null;
  period: Period;
  daysRemaining: number;
  currentDay: number;
  rows: SettlementRow[];
  record: number;
  pot: number;
  perHead: number;
  currency: string;
}

/**
 * Loads the caller's group, its currently open period, and computes the
 * full settlement (points, cap, owed) for every member -- the data the
 * Rangliste view renders. Returns null if the caller has no group yet.
 */
export async function getMySettlementView(): Promise<GroupSettlementView | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Which group the app is currently showing -- a member may belong to
  // several, and the choice is remembered per user.
  const active = await getActiveMembership();
  if (!active) return null;

  const membership = { id: active.memberId, group_id: active.groupId };

  const { data: period } = await supabase
    .from("periods")
    .select("*")
    .eq("group_id", membership.group_id)
    .eq("status", "open")
    .order("starts_on", { ascending: false })
    .limit(1)
    .maybeSingle<Period>();

  if (!period) return null;

  // These three are independent of each other -- issuing them sequentially
  // meant three full round trips stacked on top of the two above, which is
  // what made tapping a tab feel unresponsive.
  const [{ data: members }, { data: participations }, { data: activities }] =
    await Promise.all([
      supabase.from("members").select("*").eq("group_id", membership.group_id),
      supabase.from("participations").select("*").eq("period_id", period.id),
      supabase.from("activities").select("*").eq("period_id", period.id),
    ]);

  const bikeFactor = period.settings_snapshot.bike_factor;
  const capChf = period.settings_snapshot.cap_chf;
  const periodDays = period.settings_snapshot.period_days;

  const activitiesByMember = new Map<string, Activity[]>();
  for (const a of (activities as Activity[] | null) ?? []) {
    const list = activitiesByMember.get(a.member_id) ?? [];
    list.push(a);
    activitiesByMember.set(a.member_id, list);
  }

  const partByMember = new Map<
    string,
    { status: "active" | "sick" | "withdrawn"; sick_from_day: number | null }
  >();
  for (const p of (participations as
    | { member_id: string; status: "active" | "sick" | "withdrawn"; sick_from_day: number | null }[]
    | null) ?? []) {
    partByMember.set(p.member_id, { status: p.status, sick_from_day: p.sick_from_day });
  }

  const participants: Participant[] = ((members as Member[] | null) ?? []).map((m) => {
    const memberActivities = activitiesByMember.get(m.id) ?? [];
    const points = totalPoints(
      memberActivities.map((a) => ({ kind: a.sport_type as ActivityKind, distanceKm: Number(a.distance_km) })),
      bikeFactor
    );
    const participation = partByMember.get(m.id);
    return {
      memberId: m.id,
      points,
      status: participation?.status ?? "active",
      sickFromDay: participation?.sick_from_day ?? undefined,
    };
  });

  const result = computeSettlement(participants, capChf, periodDays);

  const memberById = new Map(((members as Member[] | null) ?? []).map((m) => [m.id, m]));

  const rows: SettlementRow[] = result.lines
    .map((line) => ({
      memberId: line.memberId,
      displayName: memberById.get(line.memberId)?.display_name ?? "?",
      points: line.points,
      status: line.status,
      capApplied: line.capApplied,
      owed: line.owed,
      isRecordHolder: line.isRecordHolder,
      activities: (activitiesByMember.get(line.memberId) ?? []).sort(
        (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      ),
    }))
    .sort((a, b) => b.points - a.points);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startsOn = new Date(period.starts_on + "T00:00:00");
  const day = currentPeriodDay(startsOn, today, periodDays);

  const activeCount = rows.filter((r) => r.status !== "withdrawn").length;

  const ranked = rows.filter((r) => r.status !== "withdrawn");
  const myRow = rows.find((r) => r.memberId === membership.id) ?? null;
  const me: MyStanding | null = myRow
    ? {
        memberId: myRow.memberId,
        displayName: myRow.displayName,
        points: myRow.points,
        owed: myRow.owed,
        status: myRow.status,
        isRecordHolder: myRow.isRecordHolder,
        behind: Math.max(0, result.record - myRow.points),
        rank: ranked.findIndex((r) => r.memberId === myRow.memberId) + 1,
        of: ranked.length,
        capReached: myRow.owed > 0 && myRow.owed >= myRow.capApplied,
      }
    : null;

  return {
    groupId: membership.group_id,
    groupName: active.groupName,
    isAdmin: active.role === "admin",
    inviteCode: active.inviteCode,
    me,
    period,
    daysRemaining: Math.max(0, periodDays - day),
    currentDay: day,
    rows,
    record: result.record,
    pot: result.pot,
    perHead: activeCount > 0 ? Math.round((result.pot / activeCount) * 100) / 100 : 0,
    currency: period.settings_snapshot.currency,
  };
}
