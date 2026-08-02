import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Magic-link landing point.
 *
 * Two things matter here and both were wrong before:
 *
 * 1. Session cookies must be written onto the *response object we return*.
 *    Setting them via next/headers `cookies()` and then returning a fresh
 *    NextResponse.redirect() silently drops them -- the exchange succeeds,
 *    no session cookie is sent, and the app bounces the user straight back
 *    to /login with no visible error.
 *
 * 2. Supabase sends `code` for the PKCE flow, but `token_hash` + `type`
 *    when the PKCE verifier cookie isn't available (for example when the
 *    mail is opened on a different device than it was requested from).
 *    Handle both, otherwise cross-device logins are impossible.
 *
 * Any failure now redirects with the real reason in the query string
 * instead of a generic error, so problems are diagnosable from the URL bar.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const cookieStoreForInvite = await cookies();
  const inviteCode = cookieStoreForInvite.get("pop-invite")?.value;
  const next = inviteCode
    ? `/gruppe/beitreten?code=${encodeURIComponent(inviteCode)}`
    : (searchParams.get("next") ?? "/");

  const successRedirect = NextResponse.redirect(new URL(next, origin));
  if (inviteCode) successRedirect.cookies.delete("pop-invite");

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Write onto the response we are about to return -- this is the
          // part that makes the session actually stick.
          cookiesToSet.forEach(({ name, value, options }) =>
            successRedirect.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  function fail(reason: string) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return successRedirect;
    return fail(error.message);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return successRedirect;
    return fail(error.message);
  }

  return fail("kein code und kein token_hash in der URL");
}
