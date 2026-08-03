import { createClient } from "@/lib/supabase/server";
import { computeSettlement, currentPeriodDay, type Participant } from "@/lib/rules";
import { sportsFromSnapshot, totalPointsFor, pointsForScorable, sportByKey, formatAmount, type SportDef } from "@/lib/sports";
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

export interface CatchUp {
  /** Who is directly ahead of me (or null when leading). */
  aheadName: string;
  /** Points needed to pass them. */
  pointsNeeded: number;
  /** Concrete suggestions in the group's enabled sports, best first. */
  suggestions: { label: string; amount: string }[];
  /** True when the person ahead is the leader. */
  aheadIsLeader: boolean;
}

export interface MyStanding {
  catchUp: CatchUp | null;
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
}

export interface FeedItem {
  displayName: string;
  sportLabel: string;
  amount: string;
  points: number;
  daysAgo: number;
  isMe: boolean;
}

export interface GroupSettlementView {
  /** Latest activities across the whole group, newest first. */
  feed: FeedItem[];
  /** A period settled within the last 3 days -- worth celebrating. */
  freshlySettled: { endedOn: string } | null;
  sports: SportDef[];
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

  const [{ data: period }, { data: justSettled }] = await Promise.all([
    supabase
      .from("periods")
      .select("*")
      .eq("group_id", membership.group_id)
      .eq("status", "open")
      .order("starts_on", { ascending: false })
      .limit(1)
      .maybeSingle<Period>(),
    supabase
      .from("periods")
      .select("ends_on, settled_at")
      .eq("group_id", membership.group_id)
      .eq("status", "settled")
      .gte("settled_at", new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString())
      .order("settled_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ ends_on: string; settled_at: string }>(),
  ]);

  if (!period) return null;
  const freshlySettled = justSettled ? { endedOn: justSettled.ends_on } : null;

  // These three are independent of each other -- issuing them sequentially
  // meant three full round trips stacked on top of the two above, which is
  // what made tapping a tab feel unresponsive.
  const [{ data: members }, { data: participations }, { data: activities }] =
    await Promise.all([
      supabase.from("members").select("*").eq("group_id", membership.group_id),
      supabase.from("participations").select("*").eq("period_id", period.id),
      supabase.from("activities").select("*").eq("period_id", period.id).eq("status", "approved"),
    ]);

  const capChf = period.settings_snapshot.cap_chf;
  const periodDays = period.settings_snapshot.period_days;
  const sports = sportsFromSnapshot(period.settings_snapshot);

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
    const points = totalPointsFor(
      memberActivities.map((a) => ({
        sportKey: a.sport_type,
        distanceKm: Number(a.distance_km),
        movingTimeMin: (a.moving_time_s ?? 0) / 60,
      })),
      sports
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

  // The catch-up calculator: turn an abstract deficit into a concrete
  // workout. "4.2 points behind" is a number; "40 Minuten Joggen" is a plan.
  let catchUp: CatchUp | null = null;
  if (myRow && myRow.status !== "withdrawn") {
    const myIdx = ranked.findIndex((r) => r.memberId === myRow.memberId);
    const ahead = myIdx > 0 ? ranked[myIdx - 1] : null;
    if (ahead) {
      // Enough to pass, not merely tie: one tenth of a point beyond.
      const pointsNeeded = Math.max(0.1, ahead.points - myRow.points + 0.1);
      const suggestions = sports
        .filter((sp) => sp.rate > 0)
        .map((sp) => {
          const amount = pointsNeeded / sp.rate;
          return {
            label: sp.label,
            amount: sp.unit === "km" ? `${amount.toFixed(1)} km` : `${Math.ceil(amount)} min`,
            effortMin: sp.unit === "km" ? amount * (sp.key === "run" ? 6 : 3) : amount,
          };
        })
        .sort((a, b) => a.effortMin - b.effortMin)
        .slice(0, 3)
        .map(({ label, amount }) => ({ label, amount }));

      catchUp = {
        aheadName: ahead.displayName,
        pointsNeeded,
        suggestions,
        aheadIsLeader: ahead.isRecordHolder,
      };
    }
  }
  const me: MyStanding | null = myRow
    ? {
        catchUp,
        memberId: myRow.memberId,
        displayName: myRow.displayName,
        points: myRow.points,
        owed: myRow.owed,
        status: myRow.status,
        isRecordHolder: myRow.isRecordHolder,
        behind: Math.max(0, result.record - myRow.points),
        rank: ranked.findIndex((r) => r.memberId === myRow.memberId) + 1,
        of: ranked.length,
      }
    : null;

  // The feed: what happened lately, so opening the app during a quiet
  // week still shows a living contest rather than a static table.
  const memberById2 = new Map(((members as Member[] | null) ?? []).map((m) => [m.id, m]));
  const nowMs = Date.now();
  const feed: FeedItem[] = (((activities as Activity[] | null) ?? []) as Activity[])
    .slice()
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    .slice(0, 6)
    .map((a) => {
      const scorable = {
        sportKey: a.sport_type,
        distanceKm: Number(a.distance_km),
        movingTimeMin: (a.moving_time_s ?? 0) / 60,
      };
      return {
        displayName: memberById2.get(a.member_id)?.display_name ?? "?",
        sportLabel: sportByKey(a.sport_type, sports)?.label ?? a.sport_type,
        amount: formatAmount(scorable, sports),
        points: pointsForScorable(scorable, sports),
        daysAgo: Math.floor((nowMs - new Date(a.started_at).getTime()) / 86400000),
        isMe: a.member_id === membership.id,
      };
    });

  return {
    feed,
    freshlySettled,
    sports,
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
