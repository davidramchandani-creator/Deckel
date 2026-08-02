"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

type State = "loading" | "unsupported" | "needs-install" | "off" | "on" | "denied";

export function PushToggle({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      // iOS only exposes push once the app is on the homescreen.
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as { standalone?: boolean }).standalone === true;
      setState(isIOS && !standalone ? "needs-install" : "unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setState(res.ok ? "on" : "off");
    } catch {
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return null;

  if (state === "needs-install") {
    return (
      <p className="text-xs text-ink-soft">
        Für Benachrichtigungen musst du Pace or Pay zuerst zum Home-Bildschirm
        hinzufügen: unten auf „Teilen“ tippen, dann „Zum Home-Bildschirm“.
        Danach erscheint hier der Schalter.
      </p>
    );
  }

  if (state === "unsupported") {
    return (
      <p className="text-xs text-ink-soft">
        Dieser Browser unterstützt keine Benachrichtigungen.
      </p>
    );
  }

  if (state === "denied") {
    return (
      <p className="text-xs text-ink-soft">
        Benachrichtigungen sind für diese Seite blockiert. Das lässt sich nur
        in den Browser-Einstellungen wieder erlauben.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={state === "on" ? disable : enable}
        className={`btn w-full ${state === "on" ? "btn-secondary" : "btn-primary"}`}
      >
        {busy
          ? "Einen Moment…"
          : state === "on"
            ? "Benachrichtigungen ausschalten"
            : "Benachrichtigungen einschalten"}
      </button>
      <p className="text-xs text-ink-soft">
        {state === "on"
          ? "Du wirst benachrichtigt, wenn dich jemand überholt und wenn eine Periode abgerechnet wird."
          : "Erfahre, wenn dich jemand überholt oder die Periode endet."}
      </p>
    </div>
  );
}
