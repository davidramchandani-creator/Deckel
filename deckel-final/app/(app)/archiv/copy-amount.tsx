"use client";

import { useState } from "react";

/** Copies the amount + reference so paying via TWINT/banking is one paste. */
export function CopyAmount({
  amount,
  currency,
  adminName,
  groupName,
}: {
  amount: number;
  currency: string;
  adminName: string | null;
  groupName: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = `${currency} ${amount.toFixed(2)}${adminName ? ` an ${adminName}` : ""} — Pace or Pay ${groupName}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <button type="button" onClick={copy} className="btn btn-quiet text-xs">
      {copied ? "kopiert ✓" : "Betrag kopieren"}
    </button>
  );
}
