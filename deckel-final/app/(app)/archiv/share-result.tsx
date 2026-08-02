"use client";

import { useState } from "react";

/**
 * Shares the settled period as a text receipt into whatever chat the
 * group lives in. This is the moment the app exists for -- make it easy
 * to drop into the group chat.
 */
export function ShareResult({
  groupName,
  from,
  to,
  pot,
  currency,
  winnerName,
  lines,
}: {
  groupName: string;
  from: string;
  to: string;
  pot: number;
  currency: string;
  winnerName: string | null;
  lines: { name: string; owed: number }[];
}) {
  const [copied, setCopied] = useState(false);

  const rows = lines
    .map((l) =>
      l.owed > 0
        ? `${l.name}: ${currency} ${l.owed.toFixed(2)}`
        : `${l.name}: —`
    )
    .join("\n");

  const text =
    `Pace or Pay — ${groupName}\n` +
    `Abrechnung ${from} bis ${to}\n\n` +
    (winnerName ? `🏆 ${winnerName} zahlt nichts\n\n` : "") +
    `${rows}\n` +
    `${"—".repeat(18)}\n` +
    `Topf: ${currency} ${pot.toFixed(2)} — das Essen ist gesichert.`;

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // cancelled -- fall through
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div>
      <button type="button" onClick={share} className="btn btn-secondary w-full">
        Abrechnung teilen
      </button>
      {copied && (
        <p className="text-xs text-ink-soft text-center mt-1">In die Zwischenablage kopiert.</p>
      )}
    </div>
  );
}
