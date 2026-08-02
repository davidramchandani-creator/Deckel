"use client";

import { useActionState } from "react";
import { addManualActivity, type ActionState } from "@/lib/actions/participation";

const initialState: ActionState = { status: "idle" };

export function ManualEntryForm({
  periodId,
  bikeFactor,
  periodStart,
}: {
  periodId: string;
  bikeFactor: number;
  periodStart: string;
}) {
  const [state, formAction, pending] = useActionState(addManualActivity, initialState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-3 text-sm">
      <input type="hidden" name="period_id" value={periodId} />

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-ink-soft">Was</span>
          <select name="sport_type" className="field mt-1" defaultValue="run">
            <option value="run">Lauf — 1.00 P/km</option>
            <option value="bike">Velo — {bikeFactor.toFixed(2)} P/km</option>
          </select>
        </label>

        <label className="block">
          <span className="text-ink-soft">Distanz</span>
          <input
            type="number"
            name="distance_km"
            step="0.1"
            min="0.1"
            inputMode="decimal"
            placeholder="km"
            required
            className="field mt-1 num"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-ink-soft">Wann</span>
        <input
          type="date"
          name="started_at"
          defaultValue={today}
          min={periodStart}
          max={today}
          required
          className="field mt-1"
        />
      </label>

      {state.status === "error" && <p className="text-accent">{state.message}</p>}

      <button type="submit" disabled={pending} className="btn btn-secondary w-full">
        {pending ? "Wird eingetragen…" : "Eintragen"}
      </button>

      <p className="text-xs text-ink-soft">
        Manuelle Einträge sind für alle sichtbar als solche gekennzeichnet.
        Vertrauen entsteht durch Transparenz, nicht durch Kontrolle.
      </p>
    </form>
  );
}
