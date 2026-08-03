"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "pop-push-nudge-dismissed";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Asks for notification permission where people actually are -- on the
 * leaderboard -- rather than hiding it in settings.
 *
 * Never nags: hidden once subscribed, once dismissed, and on iOS until the
 * app is on the home screen (Apple only allows push for installed PWAs, so
 * asking earlier would just fail).
 */
export function PushNudge({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, setState] = useState<"hidden" | "ask" | "ios-first">("hidden");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (isIOS && !standalone) {
      setState("ios-first");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission === "denied") return;

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (!sub) setState("ask");
      })
      .catch(() => {});
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setState("hidden");
  }

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        if (permission === "denied") dismiss();
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setState("hidden");
    } catch {
      /* leave the card up so they can retry */
    } finally {
      setBusy(false);
    }
  }

  if (state === "hidden") return null;

  return (
    <div className="sheet p-4 border-dashed">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h2 className="text-sm font-medium">Benachrichtigungen einschalten</h2>
        <button
          type="button"
          onClick={dismiss}
          className="btn btn-quiet text-xs -mt-1 -mr-1"
          aria-label="Hinweis ausblenden"
        >
          Später
        </button>
      </div>

      {state === "ios-first" ? (
        <p className="text-sm text-ink-soft leading-relaxed">
          Am iPhone gehen Benachrichtigungen erst, wenn die App auf dem
          Home-Bildschirm liegt. Teilen-Symbol antippen, dann „Zum
          Home-Bildschirm“ — danach erscheint hier der Schalter.
        </p>
      ) : (
        <>
          <ul className="text-sm text-ink-soft space-y-1 mb-3 leading-relaxed">
            <li>· wenn dich jemand überholt</li>
            <li>· wenn ein Eintrag auf deine Bestätigung wartet</li>
            <li>· zwei Tage vor Schluss mit deinem Stand</li>
          </ul>
          <button
            type="button"
            onClick={enable}
            disabled={busy}
            className="btn btn-primary w-full"
          >
            {busy ? "Einen Moment…" : "Einschalten"}
          </button>
        </>
      )}
    </div>
  );
}
