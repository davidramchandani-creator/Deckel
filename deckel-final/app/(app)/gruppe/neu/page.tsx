"use client";

import { useActionState } from "react";
import { createGroup, type GroupActionState } from "@/lib/actions/groups";
import { Sheet } from "@/components/receipt";

const initialState: GroupActionState = { status: "idle" };

export default function NeueGruppePage() {
  const [state, formAction, pending] = useActionState(createGroup, initialState);

  return (
    <Sheet className="perforated-top space-y-4">
      <div>
        <h1 className="text-lg font-medium mb-1">Neue Gruppe</h1>
        <p className="text-sm text-ink-soft">
          Du wirst Admin und kannst die Regeln festlegen. Die erste Periode
          startet sofort und läuft 14 Tage.
        </p>
      </div>

      <form action={formAction} className="space-y-3">
        <label className="block text-sm">
          <span className="text-ink-soft">Name der Gruppe</span>
          <input
            type="text"
            name="name"
            required
            autoFocus
            placeholder="z.B. Team Buchhaltung"
            className="field mt-1"
          />
        </label>

        <label className="block text-sm">
          <span className="text-ink-soft">Dein Name</span>
          <input
            type="text"
            name="display_name"
            required
            minLength={2}
            maxLength={40}
            placeholder="z.B. Dave R."
            className="field mt-1"
          />
        </label>

        {state.status === "error" && (
          <p className="text-sm text-accent">{state.message}</p>
        )}

        <button type="submit" disabled={pending} className="btn btn-primary w-full">
          {pending ? "Wird erstellt…" : "Gruppe erstellen"}
        </button>
      </form>
    </Sheet>
  );
}
