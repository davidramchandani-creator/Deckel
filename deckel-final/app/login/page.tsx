"use client";

import { useActionState } from "react";
import { sendMagicLink, type AuthActionState } from "@/lib/actions/auth";

const initialState: AuthActionState = { status: "idle" };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(sendMagicLink, initialState);

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm border border-ink/20 bg-paper-dark/40 p-6">
        <h1 className="text-lg tracking-tight mb-1">Deckel</h1>
        <p className="text-sm text-ink-soft mb-6">
          Team-Lauf-Challenge. Melde dich per Magic Link an.
        </p>

        {state.status === "sent" ? (
          <p className="text-sm">
            {state.message} Oeffne dein Postfach und klick auf den Link.
          </p>
        ) : (
          <form action={formAction} className="space-y-3">
            <label className="block text-sm">
              E-Mail
              <input
                type="email"
                name="email"
                required
                placeholder="du@firma.ch"
                className="mt-1 w-full border border-ink/30 bg-paper px-2 py-1.5 text-sm outline-none focus:border-ink"
              />
            </label>
            {state.status === "error" && (
              <p className="text-sm text-red-800">{state.message}</p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="w-full border border-ink bg-ink text-paper px-2 py-1.5 text-sm disabled:opacity-50"
            >
              {pending ? "Wird gesendet..." : "Link schicken"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
