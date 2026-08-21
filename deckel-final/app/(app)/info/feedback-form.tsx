"use client";

import { useActionState, useState } from "react";
import { submitFeedback, type FeedbackState } from "@/lib/actions/feedback";

const initial: FeedbackState = { status: "idle" };

const KATEGORIEN = [
  { key: "punkte", label: "Punkteverteilung" },
  { key: "bug", label: "Fehler" },
  { key: "idee", label: "Idee" },
  { key: "sonstiges", label: "Sonstiges" },
] as const;

/**
 * Feedback-Formular auf der Info-Seite.
 *
 * Gerade nach der Punkte-Umstellung soll die Schwelle fuer Rueckmeldungen
 * so tief wie moeglich sein: Kategorie antippen, zwei Saetze, senden --
 * keine Mail-App, kein Kontextwechsel.
 *
 * Bewusst echte <button>-Elemente plus ein verstecktes Feld statt
 * ausgeblendeter Radios in umschliessenden <label>s: Letzteres liess sich
 * auf dem iPhone nicht zuverlaessig antippen. Ein Button ist ein Button --
 * mit garantierter Trefferflaeche und ohne Umweg ueber die Label-Zuordnung.
 * Aus demselben Grund haengt der Text am Feld ueber htmlFor statt es zu
 * umschliessen.
 */
export function FeedbackForm() {
  const [state, formAction, pending] = useActionState(submitFeedback, initial);
  const [category, setCategory] = useState<string>(KATEGORIEN[0].key);

  if (state.status === "sent") {
    return (
      <p className="text-sm text-ink-soft leading-relaxed">
        Danke! Deine Rückmeldung ist angekommen und wird gelesen.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3 text-sm">
      <input type="hidden" name="category" value={category} />

      <div>
        <span className="text-ink-soft text-xs">Worum geht es?</span>
        <div className="grid grid-cols-2 gap-1 mt-1">
          {KATEGORIEN.map((k) => (
            <button
              key={k.key}
              type="button"
              onClick={() => setCategory(k.key)}
              aria-pressed={category === k.key}
              className={`btn text-xs w-full ${
                category === k.key ? "btn-primary" : "btn-secondary"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="feedback-message" className="text-ink-soft text-xs">
          Deine Rückmeldung
        </label>
        <textarea
          id="feedback-message"
          name="message"
          required
          minLength={3}
          maxLength={2000}
          rows={4}
          placeholder="Was funktioniert gut, was stört, was fehlt?"
          className="field mt-1 w-full resize-y"
        />
      </div>

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
