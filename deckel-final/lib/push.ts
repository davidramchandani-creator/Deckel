import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/server-admin";

/**
 * Web push delivery.
 *
 * Server-only: needs VAPID_PRIVATE_KEY. Subscriptions that come back 404
 * or 410 are dead (app uninstalled, permission revoked) and get pruned so
 * the table doesn't fill with corpses.
 */

let configured = false;

function configure(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:paceorpay@example.com";
  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export interface PushMessage {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/** Send to every device registered for the given members. */
export async function sendPushToMembers(
  memberIds: string[],
  message: PushMessage
): Promise<{ sent: number; pruned: number }> {
  if (memberIds.length === 0) return { sent: 0, pruned: 0 };
  if (!configure()) return { sent: 0, pruned: 0 };

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("member_id", memberIds);

  if (!subs || subs.length === 0) return { sent: 0, pruned: 0 };

  const payload = JSON.stringify(message);
  const dead: string[] = [];
  let sent = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(s.id);
      }
    })
  );

  if (dead.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", dead);
  }

  return { sent, pruned: dead.length };
}
