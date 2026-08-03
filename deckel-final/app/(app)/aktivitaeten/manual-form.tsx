"use client";

import { useActionState, useState } from "react";
import { submitManualActivity, type ManualState } from "@/lib/actions/manual";
import type { SportDef } from "@/lib/sports";

const initial: ManualState = { status: "idle" };

/**
 * Manual entry. The unit follows the chosen sport -- kilometres for
 * distance sports, minutes for time sports -- so nobody has to work out
 * what the group's rules expect.
 */
export function ManualForm({
  periodId,
  sports,
  periodStart,
  needsApproval,
}: {
  periodId: string;
  sports: SportDef[];
  periodStart: string;
  needsApproval: boolean;
}) {
  const [state, formAction, pending] = useActionState(submitManualActivity, initial);
  const [sportKey, setSportKey] = useState(sports[0]?.key ?? "run");
  const sport = sports.find((s) => s.key === sportKey) ?? sports[0];
  const today = new Date().toISOString().slice(0, 10);

  if (state.status === "sent") {
    return (
      <div className="space-y-2">
        <p className="text-sm">
          {needsApproval
            ? "Eingetragen. Deine Gruppe muss es noch bestätigen — bis dahin zählt es nicht."
            : "Eingetragen und gezählt."}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn btn-secondary w-full text-sm"
        >
          Noch einen Eintrag
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3 text-sm">
      <input type="hidden" name="period_id" value={periodId} />
      <input type="hidden" name="unit" value={sport?.unit ?? "km"} />

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-ink-soft">Sportart</span>
          <select
            name="sport_type"
            className="field mt-1"
            value={sportKey}
            onChange={(e) => setSportKey(e.target.value)}
          >
            {sports.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-ink-soft">
            {sport?.unit === "min" ? "Dauer" : "Distanz"}
          </span>
          <div className="flex items-center gap-1.5 mt-1">
            <input
              type="number"
              name="value"
              step={sport?.unit === "min" ? "1" : "0.1"}
              min="0.1"
              inputMode="decimal"
              required
              className="field num"
              placeholder={sport?.unit === "min" ? "45" : "5.0"}
            />
            <span className="text-xs text-ink-faint w-8">{sport?.unit}</span>
          </div>
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

      <label className="block">
        <span className="text-ink-soft">Notiz für die Gruppe (optional)</span>
        <input
          type="text"
          name="note"
          maxLength={80}
          placeholder="z.B. Uhr war leer"
          className="field mt-1"
        />
      </label>

      {state.status === "error" && <p className="text-accent">{state.message}</p>}

      <button type="submit" disabled={pending} className="btn btn-secondary w-full">
        {pending ? "Wird eingetragen…" : "Eintragen"}
      </button>

      <p className="text-xs text-ink-soft leading-relaxed">
        {needsApproval
          ? "Manuelle Einträge müssen von der Mehrheit der anderen bestätigt werden, bevor sie zählen. Bis dahin stehen sie sichtbar als „wartet auf Bestätigung“ da."
          : "Du bist allein in dieser Gruppe — dein Eintrag zählt sofort."}
      </p>
    </form>
  );
}
