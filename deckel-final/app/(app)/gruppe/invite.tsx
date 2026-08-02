"use client";

import { useState } from "react";

/**
 * Sharing an invite should be one tap, not "type these eight characters
 * into the other person's phone". Uses the native share sheet where it
 * exists (every modern phone), falls back to clipboard.
 */
export function InviteShare({ inviteCode }: { inviteCode: string }) {
  const [copied, setCopied] = useState(false);

  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/einladung?code=${inviteCode}`
      : "";

  const message =
    `Mach mit bei Pace or Pay — unsere Lauf-Challenge.\n\n` +
    `${link}\n\n` +
    `Tipp: Link in Safari öffnen, dann Teilen → Zum Home-Bildschirm. ` +
    `Dann hast du es als App.`;

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Pace or Pay", text: message, url: link });
        return;
      } catch {
        // user cancelled the share sheet -- fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={share} className="btn btn-primary w-full">
        Einladung teilen
      </button>
      {copied && (
        <p className="text-xs text-ink-soft text-center">Link kopiert.</p>
      )}
      <p className="text-xs text-ink-soft text-center">
        Oder Code weitergeben: <span className="num text-ink">{inviteCode}</span>
      </p>
    </div>
  );
}
