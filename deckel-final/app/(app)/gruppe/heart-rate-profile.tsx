"use client";

import { useActionState, useState } from "react";
import { setHeartRateProfile, type ProfileState } from "@/lib/actions/profile";

const initial: ProfileState = { status: "idle" };

/**
 * Ruhepuls & Maximalpuls -- optional, aber wer sie eintraegt, wird bei
 * Kraft-/Zeit-Sportarten relativ zur eigenen Herzfrequenzreserve bewertet
 * statt nach festen bpm-Schwellen. Fair unabhaengig davon, ob jemand von
 * Natur aus einen tiefen oder hohen Puls hat.
 */
export function HeartRateProfile({
  restingHr,
  maxHr,
}: {
  restingHr: number | null;
  maxHr: number | null;
}) {
  const [state, formAction, pending] = useActionState(setHeartRateProfile, initial);
  const [editing, setEditing] = useState(false);

  const hatProfil = restingHr != null && maxHr != null;

  if (!editing) {
    return (
      <div className="text-sm">
        {hatProfil ? (
          <p className="text-ink-soft">
            Ruhepuls <span className="text-ink font-medium">{restingHr}</span>,
            Maximalpuls <span className="text-ink font-medium">{maxHr}</span>.
            Kraft- und Zeit-Sportarten werden relativ dazu bewertet.
          </p>
        ) : (
          <p className="text-ink-soft leading-relaxed">
            Noch nicht hinterlegt. Ohne diese Werte läuft die
            Anstrengungswertung bei Kraft & Co. auf festen Schwellen statt
            relativ zu deinem eigenen Puls.
          </p>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="btn btn-secondary text-xs mt-2"
        >
          {hatProfil ? "Ändern" : "Eintragen"}
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-ink-soft text-xs">Ruhepuls</span>
          <input
            type="number"
            name="resting_hr"
            defaultValue={restingHr ?? ""}
            step="any"
            min="25"
            max="120"
            inputMode="numeric"
            placeholder="z. B. 52"
            className="field num mt-1 w-full"
          />
        </label>
        <label className="block">
          <span className="text-ink-soft text-xs">Maximalpuls</span>
          <input
            type="number"
            name="max_hr"
            defaultValue={maxHr ?? ""}
            step="any"
            min="100"
            max="230"
            inputMode="numeric"
            placeholder="z. B. 200"
            className="field num mt-1 w-full"
          />
        </label>
      </div>

      <p className="text-xs text-ink-soft leading-relaxed">
        Es zählen nur beide Werte zusammen — ein einzelner verschiebt die
        Spanne und wird ignoriert. Woher die Zahl kommt, ist egal: Uhr,
        Pulsrechner oder Schätzung. Beide leer lassen entfernt dein Profil.
      </p>

      {state.status === "error" && <p className="text-accent">{state.message}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn btn-primary text-xs flex-1">
          {pending ? "…" : "Speichern"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="btn btn-quiet text-xs"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
