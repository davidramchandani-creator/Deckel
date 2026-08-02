import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for the email login flow, pinned to the implicit flow.
 *
 * The default PKCE flow issues a `pkce_`-prefixed token that can only be
 * redeemed together with a verifier held in the browser that started the
 * request. That makes two things impossible:
 *
 *   - typing a 6-digit code from the email into the app
 *   - opening the link on a different device than it was requested from
 *
 * The implicit flow issues a plain token instead, which verifyOtp can
 * redeem from email + code alone. That is exactly what an installed PWA
 * needs, since it has its own cookie store separate from the browser.
 */
export async function createOtpClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { flowType: "implicit" },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component render -- middleware refreshes instead.
          }
        },
      },
    }
  );
}
