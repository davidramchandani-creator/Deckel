import { createClient } from "@/lib/supabase/server";
import { buildAuthorizeUrl } from "@/lib/strava/client";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";

/**
 * Kicks off the Strava OAuth flow. A random `state` is stored in an
 * httpOnly cookie and echoed back by Strava so the callback can prove the
 * response belongs to this browser session (CSRF protection).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/login", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
    );
  }

  if (!process.env.STRAVA_CLIENT_ID) {
    return NextResponse.json(
      { error: "STRAVA_CLIENT_ID ist nicht gesetzt." },
      { status: 500 }
    );
  }

  const state = crypto.randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("strava_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(buildAuthorizeUrl(state));
}
