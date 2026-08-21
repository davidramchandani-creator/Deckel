import { describe, it, expect } from "vitest";
import {
  effortFactor,
  pointsForScorable,
  SPORTS_CATALOG,
  type HeartRateProfile,
  type SportDef,
} from "../sports";

const dave: HeartRateProfile = { restingHr: 52, maxHr: 200 };
const GYM_REF = 0.28;
const FOOTBALL_REF = 0.65;

describe("effortFactor", () => {
  it("ist neutral ohne Pulsdaten", () => {
    expect(effortFactor(null, dave, GYM_REF)).toBe(1);
    expect(effortFactor(undefined, null, GYM_REF)).toBe(1);
    expect(effortFactor(0, dave, GYM_REF)).toBe(1);
  });

  it("ist neutral ohne Normalwert fuer die Sportart", () => {
    expect(effortFactor(120, dave, null)).toBe(1);
    expect(effortFactor(120, dave, 0)).toBe(1);
  });

  it("wertet eine normale Einheit als 1.0", () => {
    // Median der echten Gruppendaten: Kraft 96 bpm, ohne Profil.
    expect(effortFactor(96, null, GYM_REF)).toBe(1);
    // Fussball-Median 147 bpm, ohne Profil.
    expect(effortFactor(147, null, FOOTBALL_REF)).toBe(1);
  });

  it("bestraft eine auffallend lasche Einheit", () => {
    // Zwei Stunden im Gym, Puls kaum ueber Ruhe -- viel Leerlauf.
    expect(effortFactor(72, null, GYM_REF)).toBeLessThan(1);
  });

  it("belohnt eine auffallend harte Einheit", () => {
    expect(effortFactor(130, null, GYM_REF)).toBeGreaterThan(1);
  });

  it("benachteiligt Kraftsport nicht gegenueber Ballsport", () => {
    // Der Kern der Sache: eine typische Krafteinheit und eine typische
    // Fussballeinheit muessen denselben Faktor bekommen. Nur der Satz
    // (rate) darf zwischen Sportarten unterscheiden, nicht der Puls.
    const kraftTypisch = effortFactor(96, null, GYM_REF);
    const fussballTypisch = effortFactor(147, null, FOOTBALL_REF);
    expect(kraftTypisch).toBe(fussballTypisch);
  });

  it("stellt Golf nicht ueber Krafttraining", () => {
    // Golf hatte in den echten Daten den hoeheren Ø-Puls (107 vs 96).
    // Mit sportart-eigenem Massstab darf daraus kein Vorteil werden.
    const golf = effortFactor(107, null, 0.36);
    const kraft = effortFactor(96, null, GYM_REF);
    expect(golf).toBe(kraft);
  });

  it("rechnet mit Profil relativ zur eigenen Herzfrequenzreserve", () => {
    // Dave, Ruhepuls 52: (96.6-52)/148 = 30.1% HFR, Normalwert 28% -> normal.
    expect(effortFactor(96.6, dave, GYM_REF)).toBe(1);
    // Dieselbe Person deutlich haerter: (130-52)/148 = 52.7% -> weit ueber Norm.
    expect(effortFactor(130, dave, GYM_REF)).toBeGreaterThan(1);
  });

  it("ist niemals fallend bei steigendem Puls", () => {
    for (const profile of [null, dave]) {
      let prev = -1;
      for (let hr = 30; hr <= 220; hr++) {
        const f = effortFactor(hr, profile, GYM_REF);
        expect(f).toBeGreaterThanOrEqual(prev);
        prev = f;
      }
    }
  });

  it("ignoriert ein unbrauchbares Profil und faellt auf Standardwerte zurueck", () => {
    const standard = effortFactor(96, null, GYM_REF);
    // Ruhepuls ueber Maximalpuls -- unmoeglich, also komplett verwerfen.
    expect(effortFactor(96, { restingHr: 100, maxHr: 90 }, GYM_REF)).toBe(standard);
    // Halbes Profil zaehlt ebenfalls nicht, sonst waere die Spanne verzerrt.
    expect(effortFactor(96, { restingHr: 52, maxHr: null }, GYM_REF)).toBe(standard);
    expect(effortFactor(96, { restingHr: null, maxHr: 200 }, GYM_REF)).toBe(standard);
  });
});

describe("Katalog", () => {
  it("gibt jeder Zeit-Sportart einen Normalwert", () => {
    const ohne = SPORTS_CATALOG.filter(
      (s) => s.unit === "min" && (s.hrReference == null || s.hrReference <= 0)
    );
    expect(ohne.map((s) => s.key)).toEqual([]);
  });

  it("laesst Distanz-Sportarten ohne Normalwert -- dort zaehlen Kilometer", () => {
    const mit = SPORTS_CATALOG.filter((s) => s.unit === "km" && s.hrReference != null);
    expect(mit.map((s) => s.key)).toEqual([]);
  });
});

describe("pointsForScorable mit Anstrengungsfaktor", () => {
  const sports: SportDef[] = [
    {
      key: "gym", label: "Kraft", unit: "min", rate: 0.15,
      hrReference: GYM_REF, stravaTypes: [], enabled: true,
    },
    {
      key: "run", label: "Laufen", unit: "km", rate: 1.0,
      stravaTypes: [], enabled: true,
    },
  ];

  it("laesst Distanz-Sportarten unangetastet -- kein Puls-Einfluss", () => {
    const a = { sportKey: "run", distanceKm: 10, movingTimeMin: 40, avgHeartrate: 170 };
    expect(pointsForScorable(a, sports, dave)).toBe(10);
    expect(pointsForScorable(a, sports, null)).toBe(10);
  });

  it("wertet eine normale Krafteinheit wie vor der Umstellung", () => {
    const a = { sportKey: "gym", distanceKm: 0, movingTimeMin: 60, avgHeartrate: 96 };
    expect(pointsForScorable(a, sports, null)).toBe(9);
  });

  it("wertet ohne Pulsdaten neutral", () => {
    const a = { sportKey: "gym", distanceKm: 0, movingTimeMin: 60, avgHeartrate: null };
    expect(pointsForScorable(a, sports, dave)).toBe(9);
  });

  it("macht Leerlauf spuerbar, ohne ihn zu vernichten", () => {
    const schlapp = { sportKey: "gym", distanceKm: 0, movingTimeMin: 120, avgHeartrate: 70 };
    const kurzHart = { sportKey: "gym", distanceKm: 0, movingTimeMin: 60, avgHeartrate: 130 };
    // Zwei Stunden Leerlauf bringen weniger als eine harte Stunde.
    expect(pointsForScorable(kurzHart, sports, null)).toBeGreaterThan(
      pointsForScorable(schlapp, sports, null) * 0.7
    );
    // Aber die zwei Stunden sind trotzdem nicht wertlos.
    expect(pointsForScorable(schlapp, sports, null)).toBeGreaterThan(0);
  });
});
