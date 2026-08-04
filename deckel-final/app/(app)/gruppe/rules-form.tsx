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

const PRESET_LABEL: Record<string, string> = {
  sanft: "Sanft — wer vorne liegt, wird leicht gebremst",
  moderat: "Moderat — spürbar, aber Vorsprung bleibt Vorsprung",
  stark: "Stark — Ausreissen ist praktisch unmöglich",
};

/** Erkennt aus gespeicherten Faktoren, welches Preset gewählt war. */
function presetOf(factors: number[] | null | undefined): string {
  if (!factors) return "moderat";
  const hit = Object.keys(HANDICAP_PRESETS).find(
    (k) => HANDICAP_PRESETS[k].join(",") === factors.join(",")
  );
  return hit ?? "moderat";
}

/**
 * The whole rulebook in one form: period, cap, the progressive handicap,
 * and which sports count at what rate. Distance sports score per kilometre,
 * time sports per minute -- that is how yoga and strength training can
 * compete with running at all.
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

  // Die Staffelung wird live vorgeschaut, darum liegt sie im State und
  // nicht nur als defaultValue im Formular.
  const [hOn, setHOn] = useState(handicap?.enabled ?? false);
  const [hPreset, setHPreset] = useState(presetOf(handicap?.factors));
  const [hBracket, setHBracket] = useState(
    handicap?.bracket && handicap.bracket > 0
      ? handicap.bracket
      : DEFAULT_HANDICAP.bracket
  );

  const factors = HANDICAP_PRESETS[hPreset] ?? HANDICAP_PRESETS.moderat;
  const bracket = Number.isFinite(hBracket) && hBracket > 0 ? hBracket : DEFAULT_HANDICAP.bracket;
  const previewCfg: HandicapConfig = { enabled: true, bracket, factors };

  // Ein Beispiel, das durch alle Stufen läuft -- so sieht man sofort,
  // was die Einstellung praktisch bedeutet.
  const sampleRaw = bracket * factors.length;
  const sampleEff = applyHandicap(sampleRaw, previewCfg);

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

      <div className="rule-dashed pt-3">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            name="handicap_enabled"
            checked={hOn}
            onChange={(e) => setHOn(e.target.checked)}
            className="h-4 w-4 mt-0.5 accent-[var(--ink)]"
          />
          <span>
            <span className="label block">Staffelung</span>
            <span className="text-xs text-ink-soft leading-relaxed block mt-0.5">
              Je mehr Punkte jemand schon hat, desto weniger bringt der
              nächste dazu. Wer vorne liegt, muss mehr tun, um den Abstand
              zu halten — und Aufholen bleibt realistisch.
            </span>
          </span>
        </label>

        {hOn && (
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="text-ink-soft text-xs">Stärke</span>
              <select
                name="handicap_preset"
                value={hPreset}
                onChange={(e) => setHPreset(e.target.value)}
                className="field mt-1"
              >
                {Object.keys(HANDICAP_PRESETS).map((k) => (
                  <option key={k} value={k}>
                    {PRESET_LABEL[k] ?? k}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-ink-soft text-xs">Stufengrösse (Punkte)</span>
              <input
                type="number"
                name="handicap_bracket"
                value={hBracket}
                onChange={(e) => setHBracket(Number(e.target.value))}
                step="any"
                min="1"
                max="200"
                inputMode="decimal"
                className="field num mt-1 w-28 text-right"
              />
            </label>

            <div className="text-xs text-ink-soft leading-relaxed">
              <span className="label block mb-1">So zählt es dann</span>
              <ul>
                {factors.map((f, i) => {
                  const from = i * bracket;
                  const to = (i + 1) * bracket;
                  const last = i === factors.length - 1;
                  return (
                    <li key={i} className="flex justify-between tabular-nums">
                      <span>
                        {last
                          ? "ab " + from.toLocaleString("de-CH") + " Punkten"
                          : from.toLocaleString("de-CH") +
                            "–" +
                            to.toLocaleString("de-CH") +
                            " Punkte"}
                      </span>
                      <span className="text-ink-faint">
                        zählen {Math.round(f * 100)}%
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2">
                Beispiel: wer {sampleRaw.toLocaleString("de-CH")} Punkte
                erarbeitet, steht mit{" "}
                <span className="tabular-nums">
                  {sampleEff.toLocaleString("de-CH")}
                </span>{" "}
                in der Rangliste.
              </p>
            </div>
          </div>
        )}
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
