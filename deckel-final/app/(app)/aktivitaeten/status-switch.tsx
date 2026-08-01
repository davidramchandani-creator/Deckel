"use client";

import { useState, useTransition } from "react";
import { clearSick, reportSick, withdraw } from "@/lib/actions/participation";
import type { ParticipationStatus } from "@/lib/types";

export function StatusSwitch({
  periodId,
  status,
}: {
  periodId: string;
  status: ParticipationStatus;
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

  return (
    <div className="space-y-2">
      <div className="flex gap-2 text-sm">
        <button
          type="button"
          disabled={pending || status === "active"}
          onClick={() => run(clearSick)}
          className={`flex-1 border px-2 py-1.5 ${
            status === "active" ? "border-ink bg-ink text-paper" : "border-ink/30"
          } disabled:opacity-50`}
        >
          Aktiv
        </button>
        <button
          type="button"
          disabled={pending || status === "sick"}
          onClick={() => run(reportSick)}
          className={`flex-1 border px-2 py-1.5 ${
            status === "sick" ? "border-ink bg-ink text-paper" : "border-ink/30"
          } disabled:opacity-50`}
        >
          Krank
        </button>
        <button
          type="button"
          disabled={pending || status === "withdrawn"}
          onClick={() => run(withdraw)}
          className={`flex-1 border px-2 py-1.5 ${
            status === "withdrawn" ? "border-ink bg-ink text-paper" : "border-ink/30"
          } disabled:opacity-50`}
        >
          Abmelden
        </button>
      </div>
      {error && <p className="text-xs text-red-800">{error}</p>}
    </div>
  );
}
