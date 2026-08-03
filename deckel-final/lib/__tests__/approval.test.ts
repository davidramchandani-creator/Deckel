import { describe, expect, it } from "vitest";

/**
 * Mirrors the majority rule implemented in vote_activity():
 *   needed = max(1, ceil(others / 2))
 *   approved when yes >= needed
 *   rejected when no > others - needed  (approval became impossible)
 *
 * Kept here as executable documentation of the threshold everyone will
 * argue about, and to lock the edge cases.
 */
function resolve(others: number, yes: number, no: number): string {
  const needed = Math.max(1, Math.ceil(others / 2));
  if (yes >= needed) return "approved";
  if (no > others - needed) return "rejected";
  return "pending";
}

describe("manual entry approval threshold", () => {
  it("a solo group needs nobody -- handled at submit time", () => {
    expect(Math.max(1, Math.ceil(0 / 2))).toBe(1);
  });

  it("two members: the one other person decides", () => {
    expect(resolve(1, 1, 0)).toBe("approved");
    expect(resolve(1, 0, 1)).toBe("rejected");
    expect(resolve(1, 0, 0)).toBe("pending");
  });

  it("three members: one of two others is enough", () => {
    expect(resolve(2, 1, 0)).toBe("approved");
    expect(resolve(2, 0, 1)).toBe("pending"); // the second can still approve
    expect(resolve(2, 0, 2)).toBe("rejected");
  });

  it("five members: two of four others carry it", () => {
    expect(resolve(4, 2, 0)).toBe("approved");
    expect(resolve(4, 1, 1)).toBe("pending");
    expect(resolve(4, 1, 3)).toBe("rejected");
  });

  it("rejection only once approval is arithmetically impossible", () => {
    // 4 others, need 2. Two rejections still leave two possible yes votes.
    expect(resolve(4, 0, 2)).toBe("pending");
    expect(resolve(4, 0, 3)).toBe("rejected");
  });

  it("never demands more approvals than there are people", () => {
    for (let others = 1; others <= 12; others++) {
      const needed = Math.max(1, Math.ceil(others / 2));
      expect(needed).toBeLessThanOrEqual(others);
      expect(needed).toBeGreaterThan(0);
    }
  });
});
