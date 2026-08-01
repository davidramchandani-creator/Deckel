"use client";

import { useState } from "react";

export function WebhookButton() {
  const [state, setState] = useState<"idle" | "busy" | "ok" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  async function register() {
    setState("busy");
    setMessage("");
    try {
      const res = await fetch("/api/strava/subscription", { method: "POST" });
      const body = await res.json();
      if (res.ok) {
        setState("ok");
        setMessage("Strava-Webhook ist registriert. Neue Laeufe kommen jetzt automatisch an.");
      } else {
        setState("error");
        setMessage(body.error ?? "Registrierung fehlgeschlagen.");
      }
    } catch {
      setState("error");
      setMessage("Verbindung zu Strava fehlgeschlagen.");
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={register}
        disabled={state === "busy"}
        className="border border-ink px-3 py-1.5 text-sm disabled:opacity-50"
      >
        {state === "busy" ? "Wird registriert..." : "Strava-Webhook registrieren"}
      </button>
      {message && (
        <p className={`text-xs ${state === "error" ? "text-red-800" : "text-ink-soft"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
