import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { exchangeCodeForTokens } from "@/lib/strava/client";
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";

/**
 * Strava OAuth return leg. Exchanges the code for tokens server-side (the
 * client secret never leaves the server) and stores them in
 * strava_tokens, which is service-role only -- no client can read it.
 */
export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { searchParams } = new URL(request.url);

  const error = searchParams.get("error");
  if (error) {
    return NextResponse.redirect(`${appUrl}/aktivitaeten?strava=denied`);
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const scope = searchParams.get("scope");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("strava_oauth_state")?.value;
  cookieStore.delete("strava_oauth_state");

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${appUrl}/aktivitaeten?strava=state_mismatch`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${appUrl}/login`);
  }

  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!member) {
    return NextResponse.redirect(`${appUrl}/gruppe`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const admin = createAdminClient();

    // The token MUST be stored before the athlete id is stamped anywhere.
    // Getting this order wrong -- or ignoring the error -- leaves a member
    // marked as connected with no token behind it: the app claims "Strava
    // verbunden" while every activity silently fails to import.
    const { error: tokenError } = await admin.from("strava_tokens").upsert({
      member_id: member.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(tokens.expires_at * 1000).toISOString(),
      scope: tokens.scope ?? scope,
      revoked_at: null, // a fresh grant heals a previously dead connection
    });

    if (tokenError) {
      console.error("Strava token could not be stored", tokenError);
      return NextResponse.redirect(`${appUrl}/aktivitaeten?strava=token_failed`);
    }

    // Verify it is really there before telling the user they are connected.
    const { data: stored } = await admin
      .from("strava_tokens")
      .select("member_id")
      .eq("member_id", member.id)
      .maybeSingle();

    if (!stored) {
      return NextResponse.redirect(`${appUrl}/aktivitaeten?strava=token_failed`);
    }

    if (tokens.athlete?.id) {
      // Only now stamp the athlete on every membership of this user, so one
      // connect scores in all their groups.
      const { error: memberError } = await admin
        .from("members")
        .update({ strava_athlete_id: tokens.athlete.id })
        .eq("user_id", user.id);
      if (memberError) {
        console.error("athlete id could not be stamped", memberError);
      }
    }

    return NextResponse.redirect(`${appUrl}/aktivitaeten?strava=connected`);
  } catch (err) {
    console.error("Strava callback failed", err);
    return NextResponse.redirect(`${appUrl}/aktivitaeten?strava=error`);
  }
}
