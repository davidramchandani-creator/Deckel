"use client";

import { useActionState } from "react";
import { setDisplayName, type ProfileState } from "@/lib/actions/profile";
import { Sheet } from "@/components/receipt";

const initial: ProfileState = { status: "idle" };

export function NameForm({ current }: { current: string }) {
  const [state, formAction, pending] = useActionState(setDisplayName, initial);

  return (
    <Sheet className="perforated-top space-y-4">
      <div>
        <h1 className="text-lg font-medium mb-1">Wie heisst du?</h1>
        <p className="text-sm text-ink-soft leading-relaxed">
          Dieser Name steht auf der Rangliste. Deine Kolleg:innen sollen dich
          erkennen — die E-Mail-Adresse sieht dort niemand gern.
        </p>
      </div>

      <form action={formAction} className="space-y-3">
        <input
          type="text"
          name="display_name"
          required
          minLength={2}
          maxLength={40}
          autoFocus
          defaultValue={current}
          placeholder="z.B. Dave R."
          className="field"
        />
        {state.status === "error" && (
          <p className="text-sm text-accent">{state.message}</p>
        )}
        <button type="submit" disabled={pending} className="btn btn-primary w-full">
          {pending ? "Wird gespeichert…" : "Speichern"}
        </button>
      </form>
    </Sheet>
  );
}
