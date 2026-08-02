"use client";

import { useEffect, useState } from "react";

/**
 * Teaches people how to install the app, because iOS gives no prompt of
 * its own -- "Add to Home Screen" is buried in the share sheet and nobody
 * finds it unaided.
 *
 * Three cases:
 *  - already installed  -> render nothing
 *  - Android/Chrome     -> the browser offers a real install prompt, so use it
 *  - iOS Safari         -> show the manual steps, with the share glyph drawn
 *
 * Dismissal is remembered so it never nags twice.
 */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pop-install-dismissed";

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function ShareGlyph() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "inline-block", verticalAlign: "-2px" }}
    >
      <path d="M12 3v13" />
      <path d="M8.5 6.5 12 3l3.5 3.5" />
      <path d="M6 12H4.5v8h15v-8H18" />
    </svg>
  );
}

export function InstallPrompt() {
  const [state, setState] = useState<"hidden" | "ios" | "android">("hidden");
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      setState("ios");
      return;
    }

    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
      setState("android");
    }

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setState("hidden");
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setState("hidden");
  }

  if (state === "hidden") return null;

  return (
    <div className="sheet p-4 border-dashed">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h2 className="text-sm font-medium">Als App installieren</h2>
        <button
          type="button"
          onClick={dismiss}
          className="btn btn-quiet text-xs -mt-1 -mr-1"
          aria-label="Hinweis ausblenden"
        >
          Später
        </button>
      </div>

      {state === "android" ? (
        <>
          <p className="text-sm text-ink-soft mb-3 leading-relaxed">
            Dann liegt Pace or Pay wie eine normale App auf dem
            Startbildschirm — ohne Browser-Leiste, mit Benachrichtigungen.
          </p>
          <button type="button" onClick={install} className="btn btn-primary w-full">
            Jetzt installieren
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-soft mb-3 leading-relaxed">
            In zwei Schritten liegt Pace or Pay wie eine normale App auf dem
            Home-Bildschirm — ohne Browser-Leiste. Benachrichtigungen gehen
            am iPhone auch erst danach.
          </p>
          <ol className="text-sm space-y-2">
            <li className="flex gap-2.5">
              <span className="num text-ink-faint">1</span>
              <span>
                Unten in Safari auf <ShareGlyph /> <strong>Teilen</strong> tippen
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="num text-ink-faint">2</span>
              <span>
                In der Liste nach unten scrollen bis{" "}
                <strong>Zum Home-Bildschirm</strong>
              </span>
            </li>
          </ol>
          <p className="text-xs text-ink-faint mt-3">
            Klappt nur in Safari — Chrome auf dem iPhone kann das nicht.
          </p>
        </>
      )}
    </div>
  );
}
