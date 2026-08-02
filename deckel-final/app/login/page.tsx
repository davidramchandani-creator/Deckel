"use client";

import { useActionState, useState } from "react";
import {
  sendMagicLink,
  verifyEmailCode,
  type AuthActionState,
} from "@/lib/actions/auth";
import { Sheet } from "@/components/receipt";

const initialState: AuthActionState = { status: "idle" };

export default function LoginPage() {
  const [sendState, sendAction, sending] = useActionState(sendMagicLink, initialState);
  const [verifyState, verifyAction, verifying] = useActionState(
    verifyEmailCode,
    initialState
  );
  const [resetting, setResetting] = useState(false);

  const email = verifyState.email ?? sendState.email ?? "";
  const showCodeStep = sendState.status === "sent" && !resetting;
  const message = verifyState.message ?? sendState.message;

  return (
    <main className="flex-1 flex items-center justify-center p-5">
      <div className="w-full max-w-sm">
        <Sheet className="perforated-top space-y-4">
          <div>
            <h1 className="text-lg font-medium mb-1">Pace or Pay</h1>
            <p className="text-sm text-ink-soft leading-relaxed">
              {showCodeStep
                ? `Wir haben dir einen Code an ${email} geschickt. Gib ihn hier ein.`
                : "Team-Lauf-Challenge. Melde dich mit deiner E-Mail-Adresse an — ein Passwort brauchst du nicht."}
            </p>
          </div>

          {showCodeStep ? (
            <form action={verifyAction} className="space-y-3">
              <input type="hidden" name="email" value={email} />
              <label className="block">
                <span className="text-sm text-ink-soft">Code aus der E-Mail</span>
                <input
                  type="text"
                  name="token"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={10}
                  required
                  autoFocus
                  placeholder="12345678"
                  className="field mt-1 num text-center tracking-[0.25em]"
                />
              </label>

              {message && <p className="text-sm text-accent">{message}</p>}

              <button
                type="submit"
                disabled={verifying}
                className="btn btn-primary w-full"
              >
                {verifying ? "Wird geprüft…" : "Anmelden"}
              </button>

              <button
                type="button"
                onClick={() => setResetting(true)}
                className="btn btn-quiet w-full text-xs"
              >
                Andere Adresse verwenden
              </button>

              <p className="text-xs text-ink-soft leading-relaxed">
                In derselben E-Mail steht auch ein Link. Der funktioniert im
                Browser — wenn du Pace or Pay als App installiert hast, nimm besser
                den Code, sonst landest du wieder im Browser.
              </p>
            </form>
          ) : (
            <form action={sendAction} className="space-y-3">
              <label className="block">
                <span className="text-sm text-ink-soft">E-Mail</span>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  defaultValue={email}
                  placeholder="du@firma.ch"
                  className="field mt-1"
                />
              </label>

              {sendState.status === "error" && (
                <p className="text-sm text-accent">{sendState.message}</p>
              )}

              <button
                type="submit"
                disabled={sending}
                className="btn btn-primary w-full"
              >
                {sending ? "Wird gesendet…" : "Code schicken"}
              </button>
            </form>
          )}
        </Sheet>
      </div>
    </main>
  );
}
