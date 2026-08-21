"use client";

import { useState } from "react";
import { effortFactor, type SportDef } from "@/lib/sports";

/**
 * Der Punkte-Rechner: Sportart waehlen, Regler ziehen, Punkte sehen.
 *
 * Die beste Erklaerung des Punktesystems ist keine Erklaerung, sondern
 * ausprobieren. Wer dreimal den Regler bewegt hat, versteht das System
 * besser als nach zehn Absaetzen Text -- inklusive des Puls-Faktors, der
 * bei Zeit-Sportarten live mitrechnet.
 */
export function Calculator({ sports }: { sports: SportDef[] }) {
  const [key, setKey] = useState(sports[0]?.key ?? "run");
  const [menge, setMenge] = useState(10);
  const [puls, setPuls] = useState<"locker" | "normal" | "hart">("normal");

  const sport = sports.find((s) => s.key === key) ?? sports[0];
  if (!sport) return null;

  const istKm = sport.unit === "km";

  // Drei greifbare Stufen statt eines bpm-Reglers: niemand weiss auswendig,
  // welcher Puls "hart" ist -- aber jeder weiss, ob die Einheit hart war.
  // Intern wird ein Puls simuliert, der beim Standard-Profil (60/190)
  // sicher in der jeweiligen Zone landet.
  const pulsWert =
    sport.hrReference == null
      ? null
      : {
          locker: 60 + 130 * sport.hrReference * 0.55,
          normal: 60 + 130 * sport.hrReference * 1.0,
          hart: 60 + 130 * sport.hrReference * 1.5,
        }[puls];

  const faktor = istKm ? 1 : effortFactor(pulsWert, null, sport.hrReference);
  const punkte = istKm
    ? menge * sport.rate
    : Math.round(menge * sport.rate * faktor * 100) / 100;

  // Uebersetzung in die Referenz-Waehrung: wieviel Laufen ist das?
  const laufKm = Math.round(punkte * 10) / 10;

  const max = istKm ? (sport.key === "bike" || sport.key === "ebike" ? 80 : 25) : 180;
  const schritt = istKm ? 0.5 : 5;

  const wechselSport = (k: string) => {
    const neu = sports.find((s) => s.key === k);
    setKey(k);
    // Beim Wechsel km<->min eine sinnvolle Ausgangsmenge setzen.
    if (neu && neu.unit !== sport.unit) setMenge(neu.unit === "km" ? 10 : 60);
  };

  return (
    <div className="text-sm">
      <label className="block mb-3">
        <span className="text-ink-soft text-xs">Sportart</span>
        <select
          value={key}
          onChange={(e) => wechselSport(e.target.value)}
          className="field mt-1"
        >
          {sports.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block mb-3">
        <span className="text-ink-soft text-xs">
          {istKm ? "Distanz" : "Dauer"}:{" "}
          <span className="text-ink num">
            {menge} {istKm ? "km" : "min"}
          </span>
        </span>
        <input
          type="range"
          min={istKm ? 1 : 10}
          max={max}
          step={schritt}
          value={menge}
          onChange={(e) => setMenge(Number(e.target.value))}
          className="w-full mt-1 accent-[var(--ink)]"
        />
      </label>

      {!istKm && sport.hrReference != null && (
        <div className="mb-3">
          <span className="text-ink-soft text-xs">Wie hart war die Einheit?</span>
          <div className="grid grid-cols-3 gap-1 mt-1">
            {(["locker", "normal", "hart"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPuls(p)}
                aria-pressed={puls === p}
                className={`btn text-xs ${puls === p ? "btn-primary" : "btn-secondary"}`}
              >
                {p}
              </button>
            ))}
          </div>
          {/* Die Begriffe in Zahlen uebersetzen, pro Sportart: "hart" heisst
              beim Krafttraining einen anderen Puls als beim Fussball. Basis
              sind die Standardannahmen (Ruhepuls 60, Maximalpuls 190) --
              mit eigenem Profil verschieben sich die Grenzen entsprechend. */}
          {(() => {
            const grenze = (q: number) => Math.round(60 + 130 * sport.hrReference! * q);
            const text = {
              locker: `locker heisst hier: Ø-Puls unter ~${grenze(0.9)}`,
              normal: `normal heisst hier: Ø-Puls etwa ${grenze(0.9)}–${grenze(1.1)}`,
              hart: `hart heisst hier: Ø-Puls über ~${grenze(1.3)}`,
            }[puls];
            return <p className="text-xs text-ink-faint mt-1.5">{text}</p>;
          })()}
        </div>
      )}

      <div className="rule-dashed pt-3 mt-1">
        <div className="flex items-baseline">
          <span className="text-ink-soft">
            {menge} {istKm ? "km" : "min"} {sport.label}
            {!istKm && faktor !== 1 && (
              <span className="text-ink-faint"> × {faktor}</span>
            )}
          </span>
          <span className="leader" aria-hidden="true" />
          <span className="num text-lg font-medium">
            {punkte.toFixed(1)} P
          </span>
        </div>
        <p className="text-xs text-ink-faint mt-1">
          entspricht {laufKm.toFixed(1)} km Laufen
        </p>
      </div>
    </div>
  );
}
