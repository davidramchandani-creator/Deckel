"use server";

import { createClient } from "@/lib/supabase/server";

export type AuthActionState = { status: "idle" | "sent" | "error"; message?: string };

/**
 * Sends a magic link to the given email. No password is ever collected or
 * stored -- Supabase Auth handles the whole flow.
 */
export async function sendMagicLink(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email || !email.includes("@")) {
    return { status: "error", message: "Bitte eine gueltige E-Mail-Adresse eingeben." };
  }

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${appUrl}/auth/callback` },
  });

  if (error) {
    return { status: "error", message: error.message };
  }
  return { status: "sent", message: `Link geschickt an ${email}.` };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
