import { createAdminClient } from "@/lib/supabase/server-admin";
import { fetchActivity, getValidAccessToken, toActivityRow } from "@/lib/strava/client";

/**
 * Finds the open period for a member's group that contains `startedAt`.
 * Activities outside any open period are stored with period_id = null so
 * they still exist for auditing but do not score.
 */
async function findPeriodForActivity(
  admin: ReturnType<typeof createAdminClient>,
  groupId: string,
  startedAt: string
): Promise<string | null> {
  const day = startedAt.slice(0, 10);
  const { data } = await admin
    .from("periods")
    .select("id")
    .eq("group_id", groupId)
    .lte("starts_on", day)
    .gte("ends_on", day)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Processes one queued webhook event.
 *
 * Idempotent by construction: activity upserts key on the unique
 * strava_activity_id, and the event row is stamped processed_at when
 * finished. Safe to call twice on the same event id.
 */
export async function processWebhookEvent(eventId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: event } = await admin
    .from("strava_webhook_events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();

  if (!event || event.processed_at) return;

  await admin
    .from("strava_webhook_events")
    .update({ attempts: (event.attempts ?? 0) + 1 })
    .eq("id", eventId);

  try {
    // Athlete deauthorised the app: drop their tokens. Their existing
    // activities stay -- the period they already ran in should not
    // silently re-score because they disconnected.
    if (event.object_type === "athlete") {
      if (event.updates?.authorized === "false") {
        const { data: member } = await admin
          .from("members")
          .select("id")
          .eq("strava_athlete_id", event.owner_id)
          .maybeSingle();
        if (member) {
          await admin.from("strava_tokens").delete().eq("member_id", member.id);
          await admin.from("members").update({ strava_athlete_id: null }).eq("id", member.id);
        }
      }
      await admin
        .from("strava_webhook_events")
        .update({ processed_at: new Date().toISOString(), process_error: null })
        .eq("id", eventId);
      return;
    }

    if (event.object_type !== "activity") {
      await admin
        .from("strava_webhook_events")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", eventId);
      return;
    }

    // A delete event also arrives when an athlete flips an activity to
    // "Only You" under activity:read scope. Either way it must leave the
    // standings.
    if (event.aspect_type === "delete") {
      await admin.from("activities").delete().eq("strava_activity_id", event.object_id);
      await admin
        .from("strava_webhook_events")
        .update({ processed_at: new Date().toISOString(), process_error: null })
        .eq("id", eventId);
      return;
    }

    const { data: member } = await admin
      .from("members")
      .select("id, group_id")
      .eq("strava_athlete_id", event.owner_id)
      .maybeSingle();

    if (!member) {
      // Athlete isn't in any group here -- nothing to do, but mark it done
      // so it doesn't get retried forever.
      await admin
        .from("strava_webhook_events")
        .update({
          processed_at: new Date().toISOString(),
          process_error: "no member for athlete",
        })
        .eq("id", eventId);
      return;
    }

    const accessToken = await getValidAccessToken(admin, member.id);
    const activity = await fetchActivity(accessToken, event.object_id);

    if (!activity) {
      // Gone from Strava's side -- treat like a delete.
      await admin.from("activities").delete().eq("strava_activity_id", event.object_id);
      await admin
        .from("strava_webhook_events")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", eventId);
      return;
    }

    const periodId = await findPeriodForActivity(admin, member.group_id, activity.start_date);
    const row = toActivityRow(activity, member.id, periodId);

    if (!row) {
      // Sport type we don't score (swim, walk, ...). If it was previously
      // a scored type and got edited, remove the stale row.
      await admin.from("activities").delete().eq("strava_activity_id", activity.id);
    } else {
      await admin.from("activities").upsert(row, { onConflict: "strava_activity_id" });
    }

    await admin
      .from("strava_webhook_events")
      .update({ processed_at: new Date().toISOString(), process_error: null })
      .eq("id", eventId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin
      .from("strava_webhook_events")
      .update({ process_error: message })
      .eq("id", eventId);
    throw err;
  }
}
