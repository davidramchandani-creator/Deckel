"use client";

import { useActionState, useState } from "react";
import { updateGroupRules, type ProfileState } from "@/lib/actions/profile";
import {
  SPORTS_CATALOG,
  HANDICAP_PRESETS,
  DEFAULT_HANDICAP,
  applyHandicap,
  type SportsConfig,
  type HandicapConfig,
} from "@/lib/sports";

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
  handicap,
}: {
  groupId: string;
  periodDays: number;
  capChf: number;
  sports: SportsConfig | null;
  handicap: HandicapConfig | null;
}) {
  const [state, formAction, pending] = useActionState(updateGroupRules, initial);
  const [expanded, setExpanded] = useState(false);
  const [hOn, setHOn] = useState(handicap?.enabled ?? false);
  const [hPreset, setHPreset] = useState(() => {
    const f = handicap?.factors;
    if (!f) return "moderat";
    const match = Object.entries(HANDICAP_PRESETS).find(
      ([, v]) => JSON.stringify(v) === JSON.stringify(f)
    );
    return match?.[0] ?? "moderat";
  });
  const [hBracket, setHBracket] = useState(handicap?.bracket ?? DEFAULT_HANDICAP.bracket);

  // Live-Vorschau, damit man sieht was man einstellt.
  const previewCfg: HandicapConfig = {
    enabled: true,
    bracket: hBracket > 0 ? hBracket : 10,
    factors: HANDICAP_PRESETS[hPreset] ?? HANDICAP_PRESETS.moderat,
  };
  const previewRows = [1, 2, 4, 8].map((m) => {
    const raw = previewCfg.bracket * m;
    return { raw, eff: applyHandicap(raw, previewCfg) };
  });

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
                    /* step="any" ist Absicht: mit einem festen step prueft
                       der Browser gueltige Werte als min + n*step, wodurch
                       fast jeder sinnvolle Satz (1.0, 0.25, 0.15) als
                       ungueltig abgelehnt wurde und das Formular sich nicht
                       abschicken liess. */
                    step="any"
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

      <div className="rule-dashed pt-3">
        <label className="flex items-center gap-2 cursor-pointer mb-1">
          <input
            type="checkbox"
            name="handicap_enabled"
            checked={hOn}
            onChange={(e) => setHOn(e.target.checked)}
            className="h-4 w-4 accent-[var(--ink)]"
          />
          <span className="font-medium">Staffelung</span>
        </label>
        <p className="text-xs text-ink-soft leading-relaxed mb-3">
          Je mehr Punkte jemand hat, desto weniger bringt der nächste — wie
          Steuerstufen. Damit kann sich niemand absetzen und alle bleiben im
          Rennen.
        </p>

        {hOn && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-ink-soft">Stärke</span>
                <select
                  name="handicap_preset"
                  value={hPreset}
                  onChange={(e) => setHPreset(e.target.value)}
                  className="field mt-1"
                >
                  <option value="sanft">Sanft</option>
                  <option value="moderat">Moderat</option>
                  <option value="stark">Stark</option>
                </select>
              </label>

              <label className="block">
                <span className="text-ink-soft">Stufe alle</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="number"
                    name="handicap_bracket"
                    value={hBracket}
                    onChange={(e) => setHBracket(Number(e.target.value))}
                    min="1"
                    max="200"
                    step="any"
                    inputMode="decimal"
                    className="field num"
                  />
                  <span className="text-xs text-ink-faint w-4">P</span>
                </div>
              </label>
            </div>

            <div className="bg-paper rounded-sm p-3">
              <p className="label mb-2">So wirkt sich das aus</p>
              <ul className="text-xs">
                {previewRows.map((r) => (
                  <li key={r.raw} className="flex items-baseline py-0.5">
                    <span className="num">{r.raw.toFixed(0)} roh</span>
                    <span className="leader" aria-hidden="true" />
                    <span className="num">{r.eff.toFixed(1)} effektiv</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
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
