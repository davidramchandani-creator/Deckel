import { createAdminClient } from "@/lib/supabase/server-admin";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { computeSettlement, type Participant } from "@/lib/rules";
import { sportsFromSnapshot, totalPointsFor, applyHandicap, handicapFromSnapshot } from "@/lib/sports";
import { NextResponse, type NextRequest } from "next/server";
import { sendPushToMembers } from "@/lib/push";

export const maxDuration = 60;

/**
 * Period close (00:15 daily).
 *
 * For every open period whose end date has passed:
 *  1. Compute the settlement from the period's OWN settings_snapshot --
 *     never the group's current settings, so a later rule change cannot
 *     retroactively alter what someone already owes.
 *  2. Freeze one settlements row per member.
 *  3. Mark the period settled and open the successor.
 *
 * Idempotent: settlements are upserted on (period_id, member_id) and the
 * period is only picked up while status = 'open'.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const closed: string[] = [];

  const { data: duePeriods } = await admin
    .from("periods")
    .select("*")
    .eq("status", "open")
    .lt("ends_on", today);

  for (const period of duePeriods ?? []) {
    const snapshot = period.settings_snapshot as {
      period_days: number;
      bike_factor: number;
      cap_chf: number;
      currency: string;
      sports?: Record<string, { rate: number; enabled: boolean }> | null;
      handicap?: { enabled: boolean; bracket: number; factors: number[] } | null;
    };
    const sports = sportsFromSnapshot(snapshot);
    const handicap = handicapFromSnapshot(snapshot);

    const { data: members } = await admin
      .from("members")
      .select("id")
      .eq("group_id", period.group_id);

    const { data: participations } = await admin
      .from("participations")
      .select("member_id, status, sick_from_day")
      .eq("period_id", period.id);

    const { data: activities } = await admin
      .from("activities")
      .select("member_id, sport_type, distance_km, moving_time_s")
      .eq("period_id", period.id)
      .eq("status", "approved");

    const byMember = new Map<
      string,
      { sportKey: string; distanceKm: number; movingTimeMin: number }[]
    >();
    for (const a of activities ?? []) {
      const list = byMember.get(a.member_id) ?? [];
      list.push({
        sportKey: a.sport_type,
        distanceKm: Number(a.distance_km),
        movingTimeMin: (a.moving_time_s ?? 0) / 60,
      });
      byMember.set(a.member_id, list);
    }

    const partByMember = new Map(
      (participations ?? []).map((p) => [
        p.member_id,
        { status: p.status as Participant["status"], sickFromDay: p.sick_from_day ?? undefined },
      ])
    );

    const participants: Participant[] = (members ?? []).map((m) => {
      const participation = partByMember.get(m.id);
      return {
        memberId: m.id,
        points: applyHandicap(totalPointsFor(byMember.get(m.id) ?? [], sports), handicap),
        status: participation?.status ?? "active",
        sickFromDay: participation?.sickFromDay,
      };
    });

    const result = computeSettlement(participants, snapshot.cap_chf, snapshot.period_days);

    if (result.lines.length > 0) {
      await admin.from("settlements").upsert(
        result.lines.map((line) => ({
          period_id: period.id,
          member_id: line.memberId,
          points: line.points,
          cap_applied: line.capApplied,
          owed_chf: line.owed,
        })),
        { onConflict: "period_id,member_id" }
      );
    }

    await admin
      .from("periods")
      .update({ status: "settled", settled_at: new Date().toISOString() })
      .eq("id", period.id);

    // Open the successor period, carrying forward the group's *current*
    // settings (a rule change takes effect from the next period onward).
    const { data: currentSettings } = await admin
      .from("group_settings")
      .select("*")
      .eq("group_id", period.group_id)
      .order("valid_from", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextDays = currentSettings?.period_days ?? snapshot.period_days;
    const nextStart = new Date(`${period.ends_on}T00:00:00Z`);
    nextStart.setUTCDate(nextStart.getUTCDate() + 1);
    const nextEnd = new Date(nextStart);
    nextEnd.setUTCDate(nextEnd.getUTCDate() + nextDays - 1);

    const { data: existingNext } = await admin
      .from("periods")
      .select("id")
      .eq("group_id", period.group_id)
      .eq("status", "open")
      .limit(1)
      .maybeSingle();

    if (!existingNext) {
      await admin.from("periods").insert({
        group_id: period.group_id,
        starts_on: nextStart.toISOString().slice(0, 10),
        ends_on: nextEnd.toISOString().slice(0, 10),
        settings_snapshot: {
          period_days: nextDays,
          bike_factor: currentSettings?.bike_factor ?? snapshot.bike_factor,
          cap_chf: currentSettings?.cap_chf ?? snapshot.cap_chf,
          currency: currentSettings?.currency ?? snapshot.currency,
          // Rule changes -- including which sports count -- take effect here,
          // at the period boundary, and nowhere else.
          sports: currentSettings?.sports ?? snapshot.sports ?? null,
          handicap: currentSettings?.handicap ?? snapshot.handicap ?? null,
        },
        status: "open",
      });
    }

    // Tell everyone what the period cost them, while it is still fresh.
    const currency = snapshot.currency;
    await Promise.all(
      result.lines.map((line) =>
        sendPushToMembers([line.memberId], {
          title: "Periode abgerechnet",
          body:
            line.owed > 0
              ? `Du zahlst ${currency} ${line.owed.toFixed(2)} in den Topf.`
              : "Du zahlst nichts — stark gelaufen.",
          url: "/archiv",
          tag: `settled-${period.id}`,
        })
      )
    );

    closed.push(period.id);
  }

  return NextResponse.json({ ok: true, closed: closed.length, periodIds: closed });
}
