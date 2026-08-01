import { createAdminClient } from "@/lib/supabase/server-admin";
import { processWebhookEvent } from "@/lib/strava/process";
import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";

/**
 * Subscription validation. Strava issues a GET with hub.challenge when
 * the subscription is created and expects the challenge echoed back as
 * JSON within 2 seconds.
 *
 * Note the query parameter names contain literal dots ("hub.challenge"),
 * they are not nested objects.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
    return NextResponse.json({ "hub.challenge": challenge });
  }

  return NextResponse.json({ error: "verification failed" }, { status: 403 });
}

/**
 * Event delivery.
 *
 * Strava demands a 200 within 2 seconds and gives up after 3 attempts, so
 * the request path does the cheapest durable thing possible -- one insert
 * of the raw payload -- and returns. The actual Strava API round-trip
 * happens in `after()`, and /api/cron/sync re-sweeps anything still
 * unprocessed, so a cold start or a crash can't silently drop a run.
 */
export async function POST(request: NextRequest) {
  let payload: {
    object_type?: string;
    object_id?: number;
    aspect_type?: string;
    owner_id?: number;
    subscription_id?: number;
    event_time?: number;
    updates?: Record<string, string>;
  };

  try {
    payload = await request.json();
  } catch {
    // Malformed body: ack anyway so Strava stops retrying something that
    // will never parse.
    return NextResponse.json({ received: true });
  }

  if (!payload.object_type || !payload.object_id || !payload.aspect_type || !payload.owner_id) {
    return NextResponse.json({ received: true });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("strava_webhook_events")
      .upsert(
        {
          object_type: payload.object_type,
          object_id: payload.object_id,
          aspect_type: payload.aspect_type,
          owner_id: payload.owner_id,
          subscription_id: payload.subscription_id ?? null,
          event_time: payload.event_time
            ? new Date(payload.event_time * 1000).toISOString()
            : null,
          updates: payload.updates ?? null,
          raw: payload,
        },
        { onConflict: "object_type,object_id,aspect_type,event_time", ignoreDuplicates: true }
      )
      .select("id")
      .maybeSingle();

    if (!error && data?.id) {
      const eventId = data.id;
      after(async () => {
        try {
          await processWebhookEvent(eventId);
        } catch (err) {
          console.error("Deferred webhook processing failed", eventId, err);
        }
      });
    }
  } catch (err) {
    // Never fail the ack -- a 500 here just triggers pointless retries.
    // The event is either queued (and the cron will pick it up) or, in the
    // worst case, reconciled by the nightly full sync.
    console.error("Webhook enqueue failed", err);
  }

  return NextResponse.json({ received: true });
}
