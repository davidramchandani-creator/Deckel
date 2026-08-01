"use client";

import { useActionState } from "react";
import { addManualActivity, type ActionState } from "@/lib/actions/participation";

const initialState: ActionState = { status: "idle" };

export function ManualEntryForm({ periodId }: { periodId: string }) {
  const [state, formAction, pending] = useActionState(addManualActivity, initialState);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-2 text-sm">
      <input type="hidden" name="period_id" value={periodId} />
      <div className="flex gap-2">
        <select
          name="sport_type"
          className="flex-1 border border-ink/30 bg-paper px-2 py-1.5"
          defaultValue="run"
        >
          <option value="run">Lauf</option>
          <option value="bike">Velo</option>
        </select>
        <input
          type="number"
          name="distance_km"
          step="0.1"
          min="0.1"
          placeholder="km"
          required
          className="w-24 border border-ink/30 bg-paper px-2 py-1.5"
        />
      </div>
      <input
        type="date"
        name="started_at"
        defaultValue={today}
        max={today}
        required
        className="w-full border border-ink/30 bg-paper px-2 py-1.5"
      />
      {state.status === "error" && <p className="text-xs text-red-800">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full border border-ink px-2 py-1.5 disabled:opacity-50"
      >
        {pending ? "Wird eingetragen..." : "Manuell eintragen"}
      </button>
    </form>
  );
}
