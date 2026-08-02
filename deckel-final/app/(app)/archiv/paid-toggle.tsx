"use client";

import { useState, useTransition } from "react";
import { setSettlementPaid } from "@/lib/actions/settlements";

export function PaidToggle({
  settlementId,
  initialPaid,
}: {
  settlementId: string;
  initialPaid: boolean;
}) {
  const [paid, setPaid] = useState(initialPaid);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const next = !paid;
        setPaid(next);
        startTransition(async () => {
          const result = await setSettlementPaid(settlementId, next);
          if (result.status === "error") setPaid(!next);
        });
      }}
      className={`text-xs ${paid ? "stamp" : "underline underline-offset-2 text-ink-soft"} disabled:opacity-50`}
      aria-pressed={paid}
    >
      {paid ? "bezahlt" : "offen"}
    </button>
  );
}
