"use client";

import { useState } from "react";

/**
 * The rules, in the app, in plain language.
 *
 * The single biggest complaint about the first version was that it showed
 * numbers without ever saying what game was being played. This sits on the
 * leaderboard, collapsed by default, and explains it in the group's own
 * terms using their actual configured values.
 */
import type { SportDef, HandicapConfig } from "@/lib/sports";
import { applyHandicap } from "@/lib/sports";

export function Explainer({
  periodDays,
  sports,
  cap,
  currency,
  handicap,
}: {
  periodDays: number;
  sports: SportDef[];
  cap: number;
  currency: string;
  handicap?: HandicapConfig;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rule-dashed pt-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="btn btn-quiet text-sm w-full justify-between"
        aria-expanded={open}
      >
        <span>Wie funktioniert Pace or Pay?</span>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="text-sm text-ink-soft space-y-3 mt-3 leading-relaxed">
          <p>
            Ihr lauft und fahrt {periodDays} Tage lang gegeneinander. Wer am Ende
            am wenigsten Punkte hat, zahlt am meisten — aber nie mehr als der
            Deckel.
          </p>

          <div>
            <p className="text-ink font-medium mb-1">Punkte</p>
            <ul className="space-y-0.5">
              {sports.map((sp) => (
                <li key={sp.key} className="flex items-baseline">
                  <span>{sp.label}</span>
                  <span className="leader" aria-hidden="true" />
                  <span className="num">
                    {sp.rate} P/{sp.unit === "km" ? "km" : "min"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1.5">
              Alles andere zählt nicht. Alle Aktivitäten kommen direkt aus
              Strava — von Hand eintragen geht nicht, damit für alle dasselbe
              gilt.
            </p>
          </div>

          <div>
            <p className="text-ink font-medium mb-1">Was du zahlst</p>
            <p>
              Massgebend ist dein Rückstand auf die beste Person — im
              Verhältnis. Wer vorne liegt, zahlt nichts. Wer gar nichts macht,
              zahlt den vollen Deckel von {currency} {cap.toFixed(2)}. Alle
              dazwischen zahlen anteilig: bei halbem Rückstand den halben
              Deckel. Darum lohnt sich jeder Punkt — immer, egal wie weit
              hinten du liegst.
            </p>
          </div>

          {handicap?.enabled && (
            <div>
              <p className="text-ink font-medium mb-1">Staffelung</p>
              <p>
                Damit sich niemand absetzen kann, zählen Punkte mit
                steigender Zahl weniger — wie Steuerstufen. Die ersten{" "}
                {handicap.bracket} Punkte zählen voll, danach wird es
                stufenweise zäher:
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {[1, 2, 4].map((m) => {
                  const raw = handicap.bracket * m;
                  return (
                    <li key={raw} className="flex items-baseline">
                      <span className="num">{raw} roh</span>
                      <span className="leader" aria-hidden="true" />
                      <span className="num">
                        {applyHandicap(raw, handicap).toFixed(1)} effektiv
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-1.5">
                Mehr Aufwand bringt trotzdem immer mehr Punkte — nur eben
                nicht mehr im gleichen Tempo.
              </p>
            </div>
          )}

          <div>
            <p className="text-ink font-medium mb-1">Krank oder abgemeldet</p>
            <p>
              Wer krank wird, zahlt nur anteilig für die Tage, die schon
              vergangen sind. Abmelden geht nur vor dem Start einer Periode —
              danach bleibt nur „krank“.
            </p>
          </div>

          <div>
            <p className="text-ink font-medium mb-1">Der Topf</p>
            <p>
              Alle Beträge zusammen ergeben den Topf. Am Ende der Periode wird
              abgerechnet, die Beträge werden eingefroren und ihr geht zusammen
              essen.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
