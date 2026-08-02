"use server";

import { createClient } from "@/lib/supabase/server";
import { createOtpClient } from "@/lib/supabase/server-otp";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

/** Where to land after login: a pending invite outranks the leaderboard. */
async function postLoginTarget(): Promise<string> {
  const cookieStore = await cookies();
  const code = cookieStore.get("pop-invite")?.value;
  if (code) {
    cookieStore.delete("pop-invite");
    return `/gruppe/beitreten?code=${encodeURIComponent(code)}`;
  }
  return "/";
}
import type { EmailOtpType } from "@supabase/supabase-js";

export type AuthActionState = {
  status: "idle" | "sent" | "error";
  message?: string;
  email?: string;
};

/**
 * Sends a login email containing a 6-digit code (and a link, for browsers).
 *
 * Uses the plain client on purpose -- see lib/supabase/server-otp.ts. No
 * emailRedirectTo either: passing one also forces PKCE.
 */
export async function sendMagicLink(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { status: "error", message: "Bitte eine gültige E-Mail-Adresse eingeben." };
  }

  const supabase = createOtpClient();
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
 * Redeems the 6-digit code and establishes the session.
 *
 * GoTrue labels the token differently depending on the account's state
 * ("email", "magiclink", "recovery"), so each is tried in turn. On success
 * the session is written into cookies through the SSR client.
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
  // Supabase's OTP length is a project setting (6-10 digits). This project
  // issues 8. Hardcoding 6 silently truncated the code and sent the wrong
  // number -- so accept the whole documented range instead.
  if (token.length < 6 || token.length > 10) {
    return {
      status: "sent",
      email,
      message: "Der Code besteht aus 6 bis 10 Ziffern. Tipp ihn vollständig ab.",
    };
  }

  const otp = createOtpClient();
  const types: EmailOtpType[] = ["email", "magiclink", "recovery"];
  let lastError = "";

  for (const type of types) {
    const { data, error } = await otp.auth.verifyOtp({ email, token, type });
    if (error) {
      lastError = error.message;
      continue;
    }
    if (data.session) {
      const supabase = await createClient();
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      redirect(await postLoginTarget());
    }
  }

  return {
    status: "sent",
    email,
    message: lastError.toLowerCase().includes("expired")
      ? "Code stimmt nicht oder wurde schon verwendet. Nimm die neueste E-Mail."
      : "Code konnte nicht geprüft werden. Fordere einen neuen an.",
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
