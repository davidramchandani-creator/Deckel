"use client";

import { useState } from "react";

/**
 * Aufklappbarer Detailblock.
 *
 * Die Info-Seite war eine Textwueste -- niemand liest zehn Absaetze, um zu
 * verstehen, warum er CHF 4.30 zahlt. Das Wesentliche steht jetzt sichtbar
 * und visuell da, alles Weitere liegt hier drunter und wird nur geoeffnet,
 * wenn es jemanden wirklich interessiert.
 */
export function Detail({
  summary,
  children,
}: {
  summary: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rule-single first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 py-3 text-left text-sm"
      >
        <span className={open ? "font-medium" : ""}>{summary}</span>
        <span
          aria-hidden="true"
          className={`text-ink-faint shrink-0 transition-transform duration-200 ${
            open ? "rotate-45" : ""
          }`}
        >
          +
        </span>
      </button>

      {open && (
        <div className="text-sm text-ink-soft leading-relaxed space-y-2 pb-3 -mt-1">
          {children}
        </div>
      )}
    </div>
  );
}
