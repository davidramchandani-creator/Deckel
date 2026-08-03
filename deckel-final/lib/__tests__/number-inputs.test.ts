import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { SPORTS_CATALOG } from "../sports";

/**
 * Regression guard for a bug that made both forms unsubmittable.
 *
 * HTML5 validates a number input as `min + n * step`. With min="0.01" and
 * step="0.05", the rate 1.00 is NOT a valid value -- the browser silently
 * refuses to submit with "please enter a valid value", even though the
 * field looks fine. Every default rate except 0.06 was rejected.
 *
 * Rule enforced here: any number input carrying BOTH a numeric min and a
 * numeric step must actually accept the values the app puts in it.
 */

function collectTsx(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectTsx(full, acc);
    else if (entry.endsWith(".tsx")) acc.push(full);
  }
  return acc;
}

function isStepValid(value: number, min: number, step: number): boolean {
  const n = (value - min) / step;
  return Math.abs(n - Math.round(n)) < 1e-9;
}

describe("number inputs accept the values the app uses", () => {
  it("no number input pairs a numeric step with an incompatible min", () => {
    const offenders: string[] = [];

    for (const file of collectTsx(join(process.cwd(), "app"))) {
      const src = readFileSync(file, "utf8");
      // crude but effective: look at each <input ...> block
      for (const m of src.matchAll(/<input[\s\S]*?\/>/g)) {
        const tag = m[0];
        if (!/type="number"/.test(tag)) continue;
        const step = tag.match(/step="([\d.]+)"/)?.[1];
        const min = tag.match(/min="([\d.]+)"/)?.[1];
        if (!step || !min) continue; // step="any" or dynamic -> safe
        // A fixed step is only safe when min is a multiple of step.
        if (!isStepValid(Number(min), 0, Number(step))) {
          offenders.push(`${file}: min=${min} step=${step}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("every catalog rate would pass a step=0.01 field", () => {
    for (const sport of SPORTS_CATALOG) {
      expect(isStepValid(sport.rate, 0.01, 0.01)).toBe(true);
    }
  });

  it("documents the original failure so it cannot silently return", () => {
    // The exact combination that shipped broken.
    expect(isStepValid(1.0, 0.01, 0.05)).toBe(false);
    expect(isStepValid(0.25, 0.01, 0.05)).toBe(false);
    expect(isStepValid(45, 0.1, 1)).toBe(false);
  });
});
