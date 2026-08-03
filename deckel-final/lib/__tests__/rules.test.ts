import { describe, expect, it } from "vitest";
import {
  computeSettlement,
  currentPeriodDay,
  proratedCap,

} from "../rules";

describe("currentPeriodDay", () => {
  it("is day 1 on the start date", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    expect(currentPeriodDay(start, start, 14)).toBe(1);
  });

  it("clamps to periodDays once elapsed", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    expect(currentPeriodDay(start, new Date("2026-03-01T00:00:00Z"), 14)).toBe(14);
  });

  it("never goes below 1", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    expect(currentPeriodDay(start, new Date("2025-12-01T00:00:00Z"), 14)).toBe(1);
  });
});

describe("proratedCap", () => {
  it("matches the spec example: day 3 of 14, cap 15 -> 3.21", () => {
    expect(proratedCap(15, 3, 14)).toBeCloseTo(3.21, 2);
  });
  it("gives the full cap on the last day", () => {
    expect(proratedCap(15, 14, 14)).toBe(15);
  });
});

describe("proportional settlement", () => {
  it("leader pays nothing", () => {
    const r = computeSettlement(
      [
        { memberId: "a", points: 12, status: "active" },
        { memberId: "b", points: 7, status: "active" },
      ],
      15, 14
    );
    expect(r.lines.find((l) => l.memberId === "a")?.owed).toBe(0);
  });

  it("deficit is charged in proportion to the record", () => {
    const r = computeSettlement(
      [
        { memberId: "a", points: 12, status: "active" },
        { memberId: "b", points: 7, status: "active" },
      ],
      15, 14
    );
    expect(r.lines.find((l) => l.memberId === "b")?.owed).toBe(6.25); // 15 x 5/12
  });

  it("zero points costs the full cap", () => {
    const r = computeSettlement(
      [
        { memberId: "lead", points: 30, status: "active" },
        { memberId: "c", points: 0, status: "active" },
      ],
      15, 14
    );
    expect(r.lines.find((l) => l.memberId === "c")?.owed).toBe(15);
  });

  it("no dead zone: more effort always lowers the bill", () => {
    const owed = (pts: number) =>
      computeSettlement(
        [
          { memberId: "lead", points: 40, status: "active" },
          { memberId: "x", points: pts, status: "active" },
        ],
        15, 14
      ).lines.find((l) => l.memberId === "x")!.owed;

    expect(owed(5)).toBeLessThan(owed(2));
    expect(owed(20)).toBeLessThan(owed(5));
    expect(owed(39)).toBeLessThan(owed(20));
  });

  it("sick members get a prorated cap", () => {
    const r = computeSettlement(
      [
        { memberId: "lead", points: 20, status: "active" },
        { memberId: "d", points: 0, status: "sick", sickFromDay: 3 },
      ],
      15, 14
    );
    const d = r.lines.find((l) => l.memberId === "d");
    expect(d?.capApplied).toBeCloseTo(3.21, 2);
    expect(d?.owed).toBeCloseTo(3.21, 2);
  });

  it("withdrawn members are excluded from the record and pay nothing", () => {
    const r = computeSettlement(
      [
        { memberId: "e", points: 100, status: "withdrawn" },
        { memberId: "f", points: 10, status: "active" },
        { memberId: "g", points: 6, status: "active" },
      ],
      15, 14
    );
    expect(r.record).toBe(10);
    expect(r.lines.find((l) => l.memberId === "e")?.owed).toBe(0);
    expect(r.lines.find((l) => l.memberId === "g")?.owed).toBe(6); // 15 x 4/10
  });

  it("everyone tied -> pot is zero", () => {
    const r = computeSettlement(
      [
        { memberId: "a", points: 10, status: "active" },
        { memberId: "b", points: 10, status: "active" },
      ],
      15, 14
    );
    expect(r.pot).toBe(0);
  });

  it("nobody moved -> record 0, nobody owes", () => {
    const r = computeSettlement(
      [
        { memberId: "a", points: 0, status: "active" },
        { memberId: "b", points: 0, status: "active" },
      ],
      15, 14
    );
    expect(r.record).toBe(0);
    expect(r.pot).toBe(0);
  });
});
