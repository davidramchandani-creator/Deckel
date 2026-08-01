import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Manage the Strava webhook subscription from inside the app, so nobody
 * has to run curl to get the app working.
 *
 * Only a group admin may call this, and the client secret never leaves
 * the server -- it is read from the environment here and posted directly
 * to Strava.
 */

const PUSH_SUBSCRIPTIONS = "https://www.strava.com/api/v3/push_subscriptions";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from("members")
    .select("id, role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  return member ?? null;
}

function missingEnv(): string[] {
  return (
    [
      ["STRAVA_CLIENT_ID", process.env.STRAVA_CLIENT_ID],
      ["STRAVA_CLIENT_SECRET", process.env.STRAVA_CLIENT_SECRET],
      ["STRAVA_WEBHOOK_VERIFY_TOKEN", process.env.STRAVA_WEBHOOK_VERIFY_TOKEN],
      ["NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL],
    ] as const
  )
    .filter(([, value]) => !value)
    .map(([name]) => name);
}

/** Show the current subscription, if any. */
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Nur Admins." }, { status: 403 });
  }

  const missing = missingEnv();
  if (missing.length > 0) {
    return NextResponse.json({ error: "Fehlende Variablen", missing }, { status: 400 });
  }

  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    client_secret: process.env.STRAVA_CLIENT_SECRET!,
  });

  const res = await fetch(`${PUSH_SUBSCRIPTIONS}?${params}`);
  const body = await res.json().catch(() => null);
  return NextResponse.json({ ok: res.ok, subscriptions: body }, { status: res.ok ? 200 : 400 });
}

/** Create the subscription. Strava calls our webhook GET to verify. */
export async function POST() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Nur Admins." }, { status: 403 });
  }

  const missing = missingEnv();
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error:
          "Diese Umgebungsvariablen fehlen noch in Vercel: " + missing.join(", "),
        missing,
      },
      { status: 400 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!.replace(/\/$/, "");

  const form = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    client_secret: process.env.STRAVA_CLIENT_SECRET!,
    callback_url: `${appUrl}/api/strava/webhook`,
    verify_token: process.env.STRAVA_WEBHOOK_VERIFY_TOKEN!,
  });

  const res = await fetch(PUSH_SUBSCRIPTIONS, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    return NextResponse.json(
      {
        error:
          "Strava hat die Registrierung abgelehnt. Haeufigste Ursache: es gibt " +
          "schon eine Subscription (nur eine pro App erlaubt), oder die " +
          "Callback-Domain in den Strava-Einstellungen passt nicht zur App-URL.",
        stravaResponse: body,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, subscription: body });
}

/** Remove the subscription (needed before re-registering). */
export async function DELETE(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Nur Admins." }, { status: 403 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id fehlt" }, { status: 400 });
  }

  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    client_secret: process.env.STRAVA_CLIENT_SECRET!,
  });

  const res = await fetch(`${PUSH_SUBSCRIPTIONS}/${id}?${params}`, { method: "DELETE" });
  return NextResponse.json({ ok: res.status === 204 }, { status: res.status === 204 ? 200 : 400 });
}
