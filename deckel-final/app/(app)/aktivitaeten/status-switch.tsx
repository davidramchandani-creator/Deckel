"use client";

import { useState, useTransition } from "react";
import { clearSick, reportSick, withdraw } from "@/lib/actions/participation";
import type { ParticipationStatus } from "@/lib/types";

/**
 * Status is the part people argue about, so each option says plainly what
 * it costs before it is chosen -- and "abmelden" explains why it is
 * unavailable once a period is running rather than just failing.
 */
export function StatusSwitch({
  periodId,
  status,
  periodStarted,
}: {
  periodId: string;
  status: ParticipationStatus;
  periodStarted: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: (periodId: string) => Promise<{ status: string; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action(periodId);
      if (result.status === "error") setError(result.message ?? "Fehler");
    });
  }

  const options = [
    {
      key: "active" as const,
      label: "Dabei",
      hint: "Du machst mit, voller Deckel.",
      onClick: () => run(clearSick),
    },
    {
      key: "sick" as const,
      label: "Krank",
      hint: "Dein Deckel wird anteilig gekürzt.",
      onClick: () => run(reportSick),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => {
          const selected = status === o.key;
          return (
            <button
              key={o.key}
              type="button"
              disabled={pending || selected}
              onClick={o.onClick}
              aria-pressed={selected}
              className={`btn ${selected ? "btn-primary" : "btn-secondary"} flex-col items-start text-left`}
            >
              <span>{o.label}</span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-ink-soft">
        {status === "sick"
          ? "Du bist krank gemeldet. Der Tag der Meldung zählt — rückdatieren geht nicht."
          : status === "withdrawn"
            ? "Du bist für diese Periode abgemeldet und zahlst nichts."
            : "Du bist dabei. Wenn du krank wirst, melde es hier — dein Deckel wird dann anteilig gekürzt."}
      </p>

      {status !== "withdrawn" && (
        <div className="rule-dashed pt-3">
          {periodStarted ? (
            <p className="text-xs text-ink-soft">
              Ganz abmelden geht nur, bevor eine Periode startet. Solange sie
              läuft, bleibt nur „krank“ — sonst könnte man sich abmelden,
              sobald man zurückliegt.
            </p>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(withdraw)}
              className="btn btn-quiet text-xs"
            >
              Für diese Periode abmelden
            </button>
          )}
        </div>
      )}

      {error && <p className="text-xs text-accent">{error}</p>}
    </div>
  );
}
