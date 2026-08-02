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
export function Explainer({
  periodDays,
  bikeFactor,
  cap,
  currency,
}: {
  periodDays: number;
  bikeFactor: number;
  cap: number;
  currency: string;
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
            <p>
              1 km Laufen ergibt 1.0 Punkt. 1 km Velo ergibt{" "}
              {bikeFactor.toFixed(2)} Punkte. Schwimmen, Spazieren und alles
              andere zählt nicht.
            </p>
          </div>

          <div>
            <p className="text-ink font-medium mb-1">Was du zahlst</p>
            <p>
              Massgebend ist der Abstand zur besten Person. Liegst du 5 Punkte
              zurück, zahlst du {currency} 5.00. Wer vorne liegt, zahlt nichts.
              Mehr als {currency} {cap.toFixed(2)} zahlt aber niemand, egal wie
              gross der Rückstand ist.
            </p>
          </div>

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
