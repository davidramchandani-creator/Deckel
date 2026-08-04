import { createAdminClient } from "@/lib/supabase/server-admin";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { processWebhookEvent } from "@/lib/strava/process";
import { fetchAthleteActivities, getValidAccessToken, toActivityRow, tokenMemberForAthlete } from "@/lib/strava/client";
import { sportsFromSnapshot, totalPointsFor, applyHandicap, handicapFromSnapshot } from "@/lib/sports";
import { computeSettlement, type Participant } from "@/lib/rules";
import { sendPushToMembers } from "@/lib/push";
import { NextResponse, type NextRequest } from "next/server";

export const maxDuration = 60;

/**
 * Nightly reconcile (03:00).
 *
 * Two jobs, in order:
 *  1. Drain any webhook events that were queued but never processed --
 *     covers cold starts, crashes, and Strava giving up after 3 retries.
 *  2. Re-pull every connected member's activities for the current open
 *     period and upsert them, so a webhook that never arrived at all
 *     still lands within 24h.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const report = {
    drained: 0,
    drainErrors: 0,
    membersSynced: 0,
    activitiesUpserted: 0,
    syncErrors: 0,
  };

  // 1. Drain the webhook inbox.
  const { data: pending } = await admin
    .from("strava_webhook_events")
    .select("id")
    .is("processed_at", null)
    .lt("attempts", 5)
    .order("received_at", { ascending: true })
    .limit(200);

  for (const event of pending ?? []) {
    try {
      await processWebhookEvent(event.id);
      report.drained++;
    } catch {
      report.drainErrors++;
    }
  }

  // 2. Full reconcile for every open period.
  const { data: periods } = await admin
    .from("periods")
    .select("id, group_id, starts_on, ends_on, settings_snapshot")
    .eq("status", "open");

  for (const period of periods ?? []) {
    const sports = sportsFromSnapshot(period.settings_snapshot ?? {});
    const { data: members } = await admin
      .from("members")
      .select("id, strava_athlete_id")
      .eq("group_id", period.group_id)
      .not("strava_athlete_id", "is", null);

    const afterTs = Math.floor(new Date(`${period.starts_on}T00:00:00Z`).getTime() / 1000);
    const beforeTs = Math.floor(new Date(`${period.ends_on}T23:59:59Z`).getTime() / 1000);

    for (const member of members ?? []) {
      try {
        // The token may live on another of this user's memberships.
        const tokenMember = await tokenMemberForAthlete(admin, member.strava_athlete_id!);
        if (!tokenMember) {
          report.syncErrors++;
          continue;
        }
        const accessToken = await getValidAccessToken(admin, tokenMember);
        const activities = await fetchAthleteActivities(accessToken, afterTs, beforeTs);
        const rows = activities
          .map((a) => toActivityRow(a, member.id, period.id, sports))
          .filter((r): r is NonNullable<typeof r> => r !== null);

        if (rows.length > 0) {
          await admin.from("activities").upsert(rows, { onConflict: "member_id,strava_activity_id" });
          report.activitiesUpserted += rows.length;
        }
        report.membersSynced++;
      } catch (err) {
        console.error("sync failed for member", member.id, err);
        report.syncErrors++;
      }
    }
  }

  // --- Endspurt: exactly 2 days before a period ends, one push per
  // member with their personal stake. Runs inside the nightly cron, so it
  // fires once -- the day check can only be true on one morning.
  let endspurtSent = 0;
  for (const period of periods ?? []) {
    const daysLeft = Math.round(
      (new Date(`${period.ends_on}T00:00:00Z`).getTime() -
        new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime()) /
        86400000
    );
    if (daysLeft !== 2) continue;

    const sports = sportsFromSnapshot(period.settings_snapshot ?? {});
    const handicap = handicapFromSnapshot(period.settings_snapshot ?? {});
    const snapshot = period.settings_snapshot as {
      cap_chf: number;
      period_days: number;
      currency?: string;
    };

    const [{ data: allMembers }, { data: acts }, { data: parts }] = await Promise.all([
      admin.from("members").select("id, display_name").eq("group_id", period.group_id),
      admin
        .from("activities")
        .select("member_id, sport_type, distance_km, moving_time_s")
        .eq("period_id", period.id)
        .eq("status", "approved"),
      admin
        .from("participations")
        .select("member_id, status, sick_from_day")
        .eq("period_id", period.id),
    ]);

    const byMember = new Map<string, { sportKey: string; distanceKm: number; movingTimeMin: number }[]>();
    for (const a of acts ?? []) {
      const list = byMember.get(a.member_id) ?? [];
      list.push({
        sportKey: a.sport_type,
        distanceKm: Number(a.distance_km),
        movingTimeMin: (a.moving_time_s ?? 0) / 60,
      });
      byMember.set(a.member_id, list);
    }
    const partBy = new Map(
      (parts ?? []).map((pt) => [
        pt.member_id,
        { status: pt.status as Participant["status"], sickFromDay: pt.sick_from_day ?? undefined },
      ])
    );

    const participants: Participant[] = (allMembers ?? []).map((m) => ({
      memberId: m.id,
      points: applyHandicap(totalPointsFor(byMember.get(m.id) ?? [], sports), handicap),
      status: partBy.get(m.id)?.status ?? "active",
      sickFromDay: partBy.get(m.id)?.sickFromDay,
    }));

    const result = computeSettlement(participants, snapshot.cap_chf, snapshot.period_days);
    const currency = snapshot.currency ?? "CHF";

    for (const line of result.lines) {
      if (line.status === "withdrawn") continue;
      await sendPushToMembers([line.memberId], {
        title: "Endspurt — noch 2 Tage",
        body: line.isRecordHolder
          ? "Du führst. Halte durch, dann zahlst du nichts."
          : `Stand jetzt zahlst du ${currency} ${line.owed.toFixed(2)}. Jeder Punkt drückt den Betrag.`,
        url: "/",
        tag: `endspurt-${period.id}`,
      });
      endspurtSent++;
    }
  }

  return NextResponse.json({ ok: true, endspurtSent, ...report });
}
