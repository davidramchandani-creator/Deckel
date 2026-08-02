"use server";

import { createClient } from "@/lib/supabase/server";
import { createOtpClient } from "@/lib/supabase/server-otp";
import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";

export type AuthActionState = {
  status: "idle" | "sent" | "error";
  message?: string;
  email?: string;
};

/**
 * Sends a login email containing a 6-digit code (and a link, for browsers).
 *
 * Deliberately does NOT pass emailRedirectTo: doing so switches Supabase to
 * the PKCE flow, whose token is bound to a verifier in the requesting
 * browser. A code typed into an installed app could never redeem it.
 */
export async function sendMagicLink(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { status: "error", message: "Bitte eine gültige E-Mail-Adresse eingeben." };
  }

  const supabase = await createOtpClient();
  const { error } = await supabase.auth.signInWithOtp({ email });

  if (error) {
    const wait = error.message.match(/after (\d+) seconds/);
    if (wait) {
      return {
        status: "error",
        email,
        message: `Bitte ${wait[1]} Sekunden warten, dann nochmal versuchen.`,
      };
    }
    return { status: "error", message: error.message, email };
  }

  return { status: "sent", email };
}

/**
 * Redeems the 6-digit code.
 *
 * GoTrue labels the token differently depending on whether the address is
 * new, confirmed, or being re-authenticated ("magiclink", "email",
 * "recovery"). Rather than guess, try each -- only one can match, and a
 * wrong guess costs a single failed lookup.
 */
export async function verifyEmailCode(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("token") ?? "").replace(/\D/g, "");

  if (!email) {
    return { status: "error", message: "E-Mail-Adresse fehlt. Fordere den Code neu an." };
  }
  if (token.length !== 6) {
    return { status: "sent", email, message: "Der Code besteht aus 6 Ziffern." };
  }

  const supabase = await createOtpClient();
  const types: EmailOtpType[] = ["email", "magiclink", "recovery"];

  for (const type of types) {
    const { error } = await supabase.auth.verifyOtp({ email, token, type });
    if (!error) {
      redirect("/");
    }
  }

  return {
    status: "sent",
    email,
    message:
      "Dieser Code passt nicht. Nimm die neueste E-Mail — ältere Codes werden ungültig, sobald du einen neuen anforderst.",
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
