"use client";

import { useActionState, useState } from "react";
import { setParticipation, type ProfileState } from "@/lib/actions/profile";

const initial: ProfileState = { status: "idle" };

export type PartStatus = "active" | "sick" | "withdrawn";

/**
 * Ferienmodus.
 *
 * Der Deckel richtet sich nach dem Meldetag: wer an Tag 3 von 14 meldet,
 * riskiert noch 3/14. Deshalb steht der konkrete Betrag auf dem Knopf --
 * "anteiliger Deckel" sagt niemandem etwas, "noch CHF 4.30 statt 20.—"
 * schon.
 */
export function Participation({
  groupId,
  current,
  sickFromDay,
  currentDay,
  periodDays,
  capChf,
}: {
  groupId: string;
  current: PartStatus;
  sickFromDay: number | null;
  currentDay: number;
  periodDays: number;
  capChf: number;
}) {
  const [state, formAction, pending] = useActionState(setParticipation, initial);
  const [confirming, setConfirming] = useState<PartStatus | null>(null);

  const heute = Math.round((currentDay / periodDays) * capChf * 100) / 100;
  const gemeldet =
    sickFromDay != null
      ? Math.round((sickFromDay / periodDays) * capChf * 100) / 100
      : null;
  const chf = (n: number) =>
    "CHF " + n.toFixed(2).replace(".00", ".—");

  const OPTIONS: {
    key: PartStatus;
    label: string;
    hint: string;
    warn?: boolean;
  }[] = [
    {
      key: "active",
      label: "Ich bin dabei",
      hint: "Voller Deckel, volle Wertung — der Normalfall.",
    },
    {
      key: "sick",
      label: "Ferien oder krank",
      hint:
        "Dein Deckel sinkt ab heute auf " +
        chf(heute) +
        " statt " +
        chf(capChf) +
        ". Punkte sammelst du weiter, falls du doch loslaufen willst.",
    },
    {
      key: "withdrawn",
      label: "Diese Periode aussetzen",
      hint:
        "Du zahlst nichts, zaehlst aber auch nicht mit — auch nicht für den Rekord.",
      warn: true,
    },
  ];

  return (
    <div className="text-sm">
      {current === "sick" && gemeldet != null && (
        <p className="text-xs text-ink-soft mb-3 leading-relaxed">
          Gemeldet an Tag {sickFromDay} von {periodDays}. Dein Deckel für
          diese Periode liegt bei {chf(gemeldet)}.
        </p>
      )}
      {current === "withdrawn" && (
        <p className="text-xs text-ink-soft mb-3 leading-relaxed">
          Du setzt diese Periode aus und zahlst nichts.
        </p>
      )}

      <ul>
        {OPTIONS.map((o) => {
          const aktiv = current === o.key;
          const braucheBestaetigung = o.key !== "active" && !aktiv;
          return (
            <li key={o.key} className="rule-single first:border-t-0 py-2">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <span className={aktiv ? "font-medium" : ""}>{o.label}</span>
                  {aktiv && (
                    <span className="text-xs text-ink-faint"> · aktuell</span>
                  )}
                  <p className="text-xs text-ink-soft leading-relaxed mt-0.5">
                    {o.hint}
                  </p>
                </div>

                {!aktiv &&
                  (confirming === o.key ? (
                    <form action={formAction} className="flex gap-1 shrink-0">
                      <input type="hidden" name="group_id" value={groupId} />
                      <input type="hidden" name="status" value={o.key} />
                      <button
                        type="submit"
                        disabled={pending}
                        className="btn btn-primary text-xs"
                      >
                        {pending ? "…" : "Sicher"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(null)}
                        className="btn btn-quiet text-xs"
                      >
                        Abbrechen
                      </button>
                    </form>
                  ) : braucheBestaetigung ? (
                    <button
                      type="button"
                      onClick={() => setConfirming(o.key)}
                      className={
                        "btn text-xs shrink-0 " +
                        (o.warn ? "btn-quiet" : "btn-secondary")
                      }
                    >
                      Wählen
                    </button>
                  ) : (
                    <form action={formAction} className="shrink-0">
                      <input type="hidden" name="group_id" value={groupId} />
                      <input type="hidden" name="status" value={o.key} />
                      <button
                        type="submit"
                        disabled={pending}
                        className="btn btn-secondary text-xs"
                      >
                        {pending ? "…" : "Zurück"}
                      </button>
                    </form>
                  ))}
              </div>
            </li>
          );
        })}
      </ul>

      {state.status === "error" && (
        <p className="text-accent mt-2">{state.message}</p>
      )}

      <p className="text-xs text-ink-soft mt-3 leading-relaxed">
        Später melden hilft weniger: der Deckel richtet sich nach dem Tag,
        an dem du dich meldest, nicht rückwirkend nach Periodenbeginn.
      </p>
    </div>
  );
}
