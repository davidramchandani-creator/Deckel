import { createAdminClient } from "@/lib/supabase/server-admin";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { processWebhookEvent } from "@/lib/strava/process";
import { fetchAthleteActivities, getValidAccessToken, toActivityRow } from "@/lib/strava/client";
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
    .select("id, group_id, starts_on, ends_on")
    .eq("status", "open");

  for (const period of periods ?? []) {
    const { data: members } = await admin
      .from("members")
      .select("id")
      .eq("group_id", period.group_id)
      .not("strava_athlete_id", "is", null);

    const afterTs = Math.floor(new Date(`${period.starts_on}T00:00:00Z`).getTime() / 1000);
    const beforeTs = Math.floor(new Date(`${period.ends_on}T23:59:59Z`).getTime() / 1000);

    for (const member of members ?? []) {
      try {
        const accessToken = await getValidAccessToken(admin, member.id);
        const activities = await fetchAthleteActivities(accessToken, afterTs, beforeTs);
        const rows = activities
          .map((a) => toActivityRow(a, member.id, period.id))
          .filter((r): r is NonNullable<typeof r> => r !== null);

        if (rows.length > 0) {
          await admin.from("activities").upsert(rows, { onConflict: "strava_activity_id" });
          report.activitiesUpserted += rows.length;
        }
        report.membersSynced++;
      } catch (err) {
        console.error("sync failed for member", member.id, err);
        report.syncErrors++;
      }
    }
  }

  return NextResponse.json({ ok: true, ...report });
}
