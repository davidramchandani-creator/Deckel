"use client";

import { useActionState } from "react";
import { joinGroup, type GroupActionState } from "@/lib/actions/groups";

const initialState: GroupActionState = { status: "idle" };

export default function GruppeBeitretenPage() {
  const [state, formAction, pending] = useActionState(joinGroup, initialState);

  return (
    <div className="space-y-4">
      <h1 className="text-sm tracking-tight">Gruppe beitreten</h1>
      <form action={formAction} className="space-y-3">
        <label className="block text-sm">
          Einladungscode
          <input
            type="text"
            name="invite_code"
            required
            placeholder="z.B. a1b2c3d4"
            className="mt-1 w-full border border-ink/30 bg-paper px-2 py-1.5 text-sm outline-none focus:border-ink"
          />
        </label>
        <label className="block text-sm">
          Dein Name
          <input
            type="text"
            name="display_name"
            required
            placeholder="Vorname Nachname"
            className="mt-1 w-full border border-ink/30 bg-paper px-2 py-1.5 text-sm outline-none focus:border-ink"
          />
        </label>
        {state.status === "error" && <p className="text-sm text-red-800">{state.message}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full border border-ink bg-ink text-paper px-2 py-1.5 text-sm disabled:opacity-50"
        >
          {pending ? "Wird beigetreten..." : "Beitreten"}
        </button>
      </form>
    </div>
  );
}
