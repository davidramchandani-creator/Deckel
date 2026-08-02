"use client";

import { useActionState } from "react";
import { updateGroupRules, type ProfileState } from "@/lib/actions/profile";

const initial: ProfileState = { status: "idle" };

export function RulesForm({
  groupId,
  periodDays,
  bikeFactor,
  capChf,
}: {
  groupId: string;
  periodDays: number;
  bikeFactor: number;
  capChf: number;
}) {
  const [state, formAction, pending] = useActionState(updateGroupRules, initial);

  return (
    <form action={formAction} className="space-y-3 text-sm">
      <input type="hidden" name="group_id" value={groupId} />

      <label className="block">
        <span className="text-ink-soft">Periodenlänge</span>
        <select name="period_days" defaultValue={periodDays} className="field mt-1">
          <option value={14}>14 Tage</option>
          <option value={21}>21 Tage</option>
          <option value={28}>28 Tage</option>
        </select>
      </label>

      <label className="block">
        <span className="text-ink-soft">Velo-Faktor</span>
        <select name="bike_factor" defaultValue={bikeFactor} className="field mt-1">
          <option value={0.2}>0.20 — Velo zählt wenig</option>
          <option value={0.25}>0.25 — Standard</option>
          <option value={0.3}>0.30 — Velo zählt mehr</option>
        </select>
      </label>

      <label className="block">
        <span className="text-ink-soft">Deckel pro Person</span>
        <select name="cap_chf" defaultValue={capChf} className="field mt-1">
          <option value={10}>CHF 10.—</option>
          <option value={15}>CHF 15.—</option>
          <option value={20}>CHF 20.—</option>
        </select>
      </label>

      {state.status === "error" && (
        <p className="text-accent">{state.message}</p>
      )}

      <button type="submit" disabled={pending} className="btn btn-secondary w-full">
        {pending ? "Wird gespeichert…" : "Regeln speichern"}
      </button>

      <p className="text-xs text-ink-soft">
        Änderungen gelten ab der nächsten Periode. Die laufende Abrechnung
        bleibt unverändert — sonst könnte man die Regeln ändern, während man
        zurückliegt.
      </p>
    </form>
  );
}
