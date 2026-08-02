"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Taximeter effect: the amount ticks up to its real value like a fare
 * counter. Numbers use tabular figures, so nothing shifts while counting.
 *
 * Honors prefers-reduced-motion by rendering the final value immediately.
 */
export function CountUp({
  value,
  prefix = "",
  decimals = 2,
  durationMs = 650,
}: {
  value: number;
  prefix?: string;
  decimals?: number;
  durationMs?: number;
}) {
  const [display, setDisplay] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) {
      setDisplay(value);
      return;
    }
    done.current = true;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }

    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // ease-out cubic: fast start, settles gently -- like a meter stopping.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return (
    <span className="num">
      {prefix}
      {display.toFixed(decimals)}
    </span>
  );
}
