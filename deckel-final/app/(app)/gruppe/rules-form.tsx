"use client";

import { useActionState, useState } from "react";
import { updateGroupRules, type ProfileState } from "@/lib/actions/profile";
import { SPORTS_CATALOG, type SportsConfig } from "@/lib/sports";

const initial: ProfileState = { status: "idle" };

/**
 * The whole rulebook in one form: period, cap, and which sports count at
 * what rate. Distance sports score per kilometre, time sports per minute --
 * that's how yoga and strength training can compete with running at all.
 */
export function RulesForm({
  groupId,
  periodDays,
  capChf,
  sports,
}: {
  groupId: string;
  periodDays: number;
  capChf: number;
  sports: SportsConfig | null;
}) {
  const [state, formAction, pending] = useActionState(updateGroupRules, initial);
  const [expanded, setExpanded] = useState(false);

  // Current config, falling back to catalog defaults for sports the group
  // has never configured.
  const current = (key: string) =>
    sports?.[key] ??
    (() => {
      const def = SPORTS_CATALOG.find((s) => s.key === key)!;
      return { rate: def.rate, enabled: def.enabled };
    })();

  const visible = expanded
    ? SPORTS_CATALOG
    : SPORTS_CATALOG.filter((s) => current(s.key).enabled);

  return (
    <form action={formAction} className="space-y-4 text-sm">
      <input type="hidden" name="group_id" value={groupId} />

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-ink-soft">Periodenlänge</span>
          <select name="period_days" defaultValue={periodDays} className="field mt-1">
            <option value={7}>7 Tage</option>
            <option value={14}>14 Tage</option>
            <option value={21}>21 Tage</option>
            <option value={28}>28 Tage</option>
          </select>
        </label>

        <label className="block">
          <span className="text-ink-soft">Deckel pro Person</span>
          <select name="cap_chf" defaultValue={capChf} className="field mt-1">
            <option value={5}>CHF 5.—</option>
            <option value={10}>CHF 10.—</option>
            <option value={15}>CHF 15.—</option>
            <option value={20}>CHF 20.—</option>
            <option value={30}>CHF 30.—</option>
            <option value={50}>CHF 50.—</option>
          </select>
        </label>
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-1">
          <span className="label">Sportarten</span>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="btn btn-quiet text-xs"
          >
            {expanded ? "Nur aktive zeigen" : "Alle Sportarten zeigen"}
          </button>
        </div>

        <ul>
          {visible.map((def) => {
            const cfg = current(def.key);
            return (
              <li key={def.key} className="rule-single first:border-t-0 py-2">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 flex-1 cursor-pointer">
                    <input
                      type="checkbox"
                      name={`sport_${def.key}_enabled`}
                      defaultChecked={cfg.enabled}
                      className="h-4 w-4 accent-[var(--ink)]"
                    />
                    <span>{def.label}</span>
                  </label>
                  <input
                    type="number"
                    name={`sport_${def.key}_rate`}
                    defaultValue={cfg.rate}
                    step="0.05"
                    min="0.01"
                    max="10"
                    inputMode="decimal"
                    className="field num w-24 text-right"
                    aria-label={`Punkte pro ${def.unit === "km" ? "Kilometer" : "Minute"} für ${def.label}`}
                  />
                  <span className="text-xs text-ink-faint w-12">
                    P/{def.unit === "km" ? "km" : "min"}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Disabled sports still need their fields submitted so rates survive. */}
        {!expanded &&
          SPORTS_CATALOG.filter((s) => !current(s.key).enabled).map((def) => {
            const cfg = current(def.key);
            return (
              <input
                key={def.key}
                type="hidden"
                name={`sport_${def.key}_rate`}
                value={cfg.rate}
              />
            );
          })}
      </div>

      {state.status === "error" && <p className="text-accent">{state.message}</p>}

      <button type="submit" disabled={pending} className="btn btn-secondary w-full">
        {pending ? "Wird gespeichert…" : "Regeln speichern"}
      </button>

      <p className="text-xs text-ink-soft leading-relaxed">
        Distanzsport zählt pro Kilometer, Zeitsport pro Minute. Änderungen
        gelten ab der nächsten Periode — die laufende Abrechnung bleibt
        unverändert, sonst könnte man die Regeln ändern, während man
        zurückliegt.
      </p>
    </form>
  );
}
