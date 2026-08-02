import { createClient } from "@supabase/supabase-js";

/**
 * Plain supabase-js client, pinned to the implicit flow.
 *
 * Why not @supabase/ssr's createServerClient: it hardcodes
 * `flowType: "pkce"` *after* spreading the caller's auth options, so any
 * flowType passed in is silently discarded. PKCE issues a `pkce_`-prefixed
 * token that can only be redeemed with a verifier held in the requesting
 * browser -- which makes a typed-in 6-digit code impossible to redeem, and
 * breaks opening the link on a second device.
 *
 * This client only mints and redeems the code. The resulting session is
 * handed to the cookie-writing SSR client afterwards, so cookies still
 * behave exactly as before.
 */
export function createOtpClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "implicit",
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}
