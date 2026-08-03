"use client";

import { useActionState, useState } from "react";
import { applyRulesNow, type RulesNowState } from "@/lib/actions/rules-now";

const initial: RulesNowState = { status: "idle" };

/**
 * Admin override: apply saved rules to the running period immediately.
 *
 * Behind a confirmation because it does the one thing the per-period
 * freeze exists to prevent -- changing the rules of a game in progress.
 * Fine when the group agreed to it, unfair when it is unilateral, so the
 * wording says so plainly.
 */
export function ApplyRulesNow({ groupId }: { groupId: string }) {
  const [state, formAction, pending] = useActionState(applyRulesNow, initial);
  const [confirming, setConfirming] = useState(false);

  if (state.status === "done") {
    return (
      <p className="text-sm">
        Die Regeln gelten jetzt auch für die laufende Periode. Die Rangliste
        wurde neu gerechnet.
      </p>
    );
  }

  if (!confirming) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="btn btn-secondary w-full text-sm"
        >
          Regeln sofort übernehmen
        </button>
        <p className="text-xs text-ink-soft leading-relaxed">
          Normalerweise gelten Änderungen erst ab der nächsten Periode. Hiermit
          ziehst du sie auf die laufende vor.
        </p>
        {state.status === "error" && (
          <p className="text-xs text-accent">{state.message}</p>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="group_id" value={groupId} />
      <p className="text-sm leading-relaxed">
        Das ändert die <strong>laufende</strong> Abrechnung.
      </p>
      <p className="text-xs text-ink-soft leading-relaxed">
        Neu aktivierte Sportarten zählen rückwirkend für die ganze Periode,
        deaktivierte fallen weg, und alle Beträge werden neu berechnet. Das ist
        genau das, wovor die Regel-Einfrierung sonst schützt — mach es nur,
        wenn die Gruppe einverstanden ist.
      </p>

      {state.status === "error" && (
        <p className="text-xs text-accent">{state.message}</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="btn btn-secondary flex-1 text-sm"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary flex-1 text-sm"
        >
          {pending ? "…" : "Ja, jetzt übernehmen"}
        </button>
      </div>
    </form>
  );
}
