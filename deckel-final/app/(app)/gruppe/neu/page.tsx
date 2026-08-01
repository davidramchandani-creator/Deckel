"use client";

import { useActionState } from "react";
import { createGroup, type GroupActionState } from "@/lib/actions/groups";

const initialState: GroupActionState = { status: "idle" };

export default function NeueGruppePage() {
  const [state, formAction, pending] = useActionState(createGroup, initialState);

  return (
    <div className="space-y-4">
      <h1 className="text-sm tracking-tight">Neue Gruppe</h1>
      <form action={formAction} className="space-y-3">
        <label className="block text-sm">
          Name
          <input
            type="text"
            name="name"
            required
            placeholder="z.B. Team Buchhaltung"
            className="mt-1 w-full border border-ink/30 bg-paper px-2 py-1.5 text-sm outline-none focus:border-ink"
          />
        </label>
        {state.status === "error" && <p className="text-sm text-red-800">{state.message}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full border border-ink bg-ink text-paper px-2 py-1.5 text-sm disabled:opacity-50"
        >
          {pending ? "Wird erstellt..." : "Gruppe erstellen"}
        </button>
      </form>
    </div>
  );
}
