"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type AuthActionState = {
  status: "idle" | "sent" | "error";
  message?: string;
  email?: string;
};

/**
 * Sends a login email containing BOTH a tappable link and a 6-digit code.
 *
 * The code matters more than the link on mobile. An installed PWA has its
 * own cookie store, separate from Safari — so tapping a link in Mail logs
 * you into the browser and leaves the installed app still logged out.
 * Typing the code inside the app keeps the whole flow in one place.
 */
export async function sendMagicLink(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { status: "error", message: "Bitte eine gültige E-Mail-Adresse eingeben." };
  }

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: appUrl ? { emailRedirectTo: `${appUrl}/auth/callback` } : undefined,
  });

  if (error) {
    return { status: "error", message: error.message, email };
  }
  return { status: "sent", email };
}

/** Verifies the 6-digit code from the email and establishes the session. */
export async function verifyEmailCode(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("token") ?? "").replace(/\s/g, "");

  if (!email) {
    return { status: "error", message: "E-Mail-Adresse fehlt. Fordere den Code neu an." };
  }
  if (token.length < 6) {
    return { status: "sent", email, message: "Der Code besteht aus 6 Ziffern." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });

  if (error) {
    return {
      status: "sent",
      email,
      message: error.message.toLowerCase().includes("expired")
        ? "Dieser Code ist abgelaufen. Fordere einen neuen an."
        : "Code stimmt nicht. Nochmal versuchen?",
    };
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
