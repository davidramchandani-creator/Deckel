"use client";

import { useActionState } from "react";
import { submitFeedback, type FeedbackState } from "@/lib/actions/feedback";

const initial: FeedbackState = { status: "idle" };

const KATEGORIEN = [
  { key: "punkte", label: "Punkteverteilung" },
  { key: "bug", label: "Fehler" },
  { key: "idee", label: "Idee" },
  { key: "sonstiges", label: "Sonstiges" },
];

/**
 * Feedback-Formular auf der Info-Seite.
 *
 * Gerade nach der Punkte-Umstellung soll die Schwelle fuer Rueckmeldungen
 * so tief wie moeglich sein: Kategorie antippen, zwei Saetze, senden --
 * keine Mail-App, kein Kontextwechsel.
 */
export function FeedbackForm() {
  const [state, formAction, pending] = useActionState(submitFeedback, initial);

  if (state.status === "sent") {
    return (
      <p className="text-sm text-ink-soft leading-relaxed">
        Danke! Deine Rückmeldung ist angekommen und wird gelesen.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3 text-sm">
      <div>
        <span className="text-ink-soft text-xs">Worum geht es?</span>
        <div className="grid grid-cols-2 gap-1 mt-1">
          {KATEGORIEN.map((k, i) => (
            <label key={k.key} className="cursor-pointer">
              <input
                type="radio"
                name="category"
                value={k.key}
                defaultChecked={i === 0}
                className="peer sr-only"
              />
              <span className="btn btn-secondary text-xs w-full peer-checked:bg-[var(--ink)] peer-checked:text-[var(--paper-card)] peer-checked:border-[var(--ink)]">
                {k.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="text-ink-soft text-xs">Deine Rückmeldung</span>
        <textarea
          name="message"
          required
          minLength={3}
          maxLength={2000}
          rows={4}
          placeholder="Was funktioniert gut, was stört, was fehlt?"
          className="field mt-1 w-full resize-y"
        />
      </label>

      {state.status === "error" && (
        <p className="text-accent">{state.message}</p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? "Wird gesendet…" : "Senden"}
      </button>

      <p className="text-xs text-ink-faint leading-relaxed">
        Geht direkt an Dave — mit deinem Namen, damit er nachfragen kann.
      </p>
    </form>
  );
}
