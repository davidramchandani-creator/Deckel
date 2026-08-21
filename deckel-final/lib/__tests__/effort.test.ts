import { describe, it, expect } from "vitest";
import { effortFactor, pointsForScorable, type HeartRateProfile } from "../sports";

const dave: HeartRateProfile = { restingHr: 52, maxHr: 200 };

describe("effortFactor", () => {
  it("ist neutral ohne Pulsdaten", () => {
    expect(effortFactor(null, dave)).toBe(1);
    expect(effortFactor(undefined, null)).toBe(1);
    expect(effortFactor(0, dave)).toBe(1);
  });

  it("faellt ohne Profil auf feste bpm-Schwellen zurueck", () => {
    expect(effortFactor(80, null)).toBe(0.6);
    expect(effortFactor(96, null)).toBe(0.8);
    expect(effortFactor(110, null)).toBe(1.0);
    expect(effortFactor(130, null)).toBe(1.25);
    expect(effortFactor(150, null)).toBe(1.5);
  });

  it("rechnet mit Profil relativ zur Herzfrequenzreserve", () => {
    // (96.6-52)/(200-52) = 30.1% -> Zone 25-40%
    expect(effortFactor(96.6, dave)).toBe(0.8);
    // (150-52)/(200-52) = 66.2% -> Zone 55-70%
    expect(effortFactor(150, dave)).toBe(1.25);
  });

  it("ist niemals fallend bei steigendem Puls -- weder mit noch ohne Profil", () => {
    for (const profile of [null, dave]) {
      let prev = -1;
      for (let hr = 30; hr <= 220; hr++) {
        const f = effortFactor(hr, profile);
        expect(f).toBeGreaterThanOrEqual(prev);
        prev = f;
      }
    }
  });

  it("ignoriert ein unbrauchbares Profil (max <= resting) und faellt zurueck", () => {
    expect(effortFactor(96, { restingHr: 100, maxHr: 90 })).toBe(
      effortFactor(96, null)
    );
  });
});

describe("pointsForScorable mit Anstrengungsfaktor", () => {
  const sports = [
    { key: "gym", label: "Kraft", unit: "min" as const, rate: 0.15, stravaTypes: [], enabled: true },
    { key: "run", label: "Laufen", unit: "km" as const, rate: 1.0, stravaTypes: [], enabled: true },
  ];

  it("laesst Distanz-Sportarten unangetastet -- kein Puls-Einfluss", () => {
    const a = { sportKey: "run", distanceKm: 10, movingTimeMin: 40, avgHeartrate: 170 };
    expect(pointsForScorable(a, sports, dave)).toBe(10);
    expect(pointsForScorable(a, sports, null)).toBe(10);
  });

  it("skaliert Zeit-Sportarten mit dem Anstrengungsfaktor", () => {
    const a = { sportKey: "gym", distanceKm: 0, movingTimeMin: 60, avgHeartrate: 96.6 };
    // 60 * 0.15 * 0.8 = 7.2
    expect(pointsForScorable(a, sports, dave)).toBeCloseTo(7.2, 2);
  });

  it("wertet ohne Pulsdaten neutral -- wie bisher", () => {
    const a = { sportKey: "gym", distanceKm: 0, movingTimeMin: 60, avgHeartrate: null };
    expect(pointsForScorable(a, sports, dave)).toBe(9);
  });
});
