"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/**
 * Pull-to-refresh.
 *
 * An installed PWA has no browser chrome, so iOS gives you no reload
 * gesture at all -- the only way to refresh was to close and reopen the
 * app. This restores the gesture people already expect.
 *
 * Deliberately conservative: only engages when the page is already scrolled
 * to the top and the drag is clearly vertical, so it never fights normal
 * scrolling or a horizontal swipe.
 */

const TRIGGER = 70;   // px of pull needed to fire
const MAX = 110;      // px the indicator can travel

export function PullToRefresh({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const active = useRef(false);

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      // Only from the very top, and never mid-refresh.
      if (window.scrollY > 0 || refreshing) return;
      startY.current = e.touches[0].clientY;
      active.current = false;
    }

    function onTouchMove(e: TouchEvent) {
      if (startY.current === null || refreshing) return;
      const dy = e.touches[0].clientY - startY.current;

      if (dy <= 0) {
        startY.current = null;
        return;
      }
      // Require a deliberate pull before taking over the gesture.
      if (!active.current && dy < 12) return;
      active.current = true;

      if (e.cancelable) e.preventDefault();
      // Resistance: the further you pull, the slower it moves.
      setPull(Math.min(MAX, dy * 0.5));
    }

    async function onTouchEnd() {
      if (startY.current === null) return;
      const reached = pull >= TRIGGER;
      startY.current = null;
      active.current = false;

      if (reached) {
        setRefreshing(true);
        setPull(TRIGGER);
        router.refresh();
        // Give the server render a beat, then settle back.
        setTimeout(() => {
          setRefreshing(false);
          setPull(0);
        }, 900);
      } else {
        setPull(0);
      }
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [pull, refreshing, router]);

  const ready = pull >= TRIGGER;

  return (
    <>
      <div
        aria-hidden={!refreshing}
        className="flex items-end justify-center overflow-hidden"
        style={{
          height: pull,
          transition: startY.current === null ? "height 220ms ease-out" : "none",
        }}
      >
        <div className="pb-2 flex items-center gap-2 text-xs text-ink-soft">
          <span
            className={`inline-block h-3 w-3 rounded-full border border-ink-soft border-t-transparent ${
              refreshing ? "animate-spin" : ""
            }`}
            style={{
              transform: refreshing ? undefined : `rotate(${pull * 3}deg)`,
            }}
          />
          <span>
            {refreshing
              ? "Wird aktualisiert…"
              : ready
                ? "Loslassen zum Aktualisieren"
                : "Zum Aktualisieren ziehen"}
          </span>
        </div>
      </div>

      <div
        style={{
          transform: `translateY(${pull * 0.25}px)`,
          transition: startY.current === null ? "transform 220ms ease-out" : "none",
        }}
      >
        {children}
      </div>
    </>
  );
}
