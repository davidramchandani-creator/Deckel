import { describe, expect, it } from "vitest";
import {
  DEFAULT_HANDICAP,
  HANDICAP_PRESETS,
  applyHandicap,
  currentTier,
  handicapFromSnapshot,
  marginalGain,
  rawNeededFor,
  type HandicapConfig,
} from "../sports";

const moderat: HandicapConfig = {
  enabled: true,
  bracket: 10,
  factors: HANDICAP_PRESETS.moderat, // 1 / 0.75 / 0.5 / 0.25
};

describe("Staffelung: Grundrechnung", () => {
  it("erste Stufe zaehlt voll", () => {
    expect(applyHandicap(10, moderat)).toBe(10);
    expect(applyHandicap(5, moderat)).toBe(5);
  });

  it("folgt den Stufen wie eine Steuertabelle", () => {
    expect(applyHandicap(20, moderat)).toBe(17.5); // 10 + 10x0.75
    expect(applyHandicap(30, moderat)).toBe(22.5); // + 10x0.5
    expect(applyHandicap(40, moderat)).toBe(25);   // + 10x0.25
  });

  it("alles ueber der letzten Stufe behaelt deren Faktor", () => {
    expect(applyHandicap(60, moderat)).toBe(30);   // 25 + 20x0.25
    expect(applyHandicap(80, moderat)).toBe(35);
  });

  it("abgeschaltet aendert nichts", () => {
    const off = { ...moderat, enabled: false };
    for (const v of [0, 7.5, 42, 137]) expect(applyHandicap(v, off)).toBe(v);
  });

  it("negative oder null Punkte bleiben null", () => {
    expect(applyHandicap(0, moderat)).toBe(0);
    expect(applyHandicap(-5, moderat)).toBe(0);
  });
});

describe("Staffelung: keine tote Zone", () => {
  it("mehr Rohpunkte ergeben IMMER mehr effektive Punkte", () => {
    for (const preset of Object.values(HANDICAP_PRESETS)) {
      const cfg = { enabled: true, bracket: 10, factors: preset };
      let prev = -1;
      for (let raw = 0; raw <= 300; raw += 0.5) {
        const eff = applyHandicap(raw, cfg);
        expect(eff).toBeGreaterThan(prev);
        prev = eff;
      }
    }
  });

  it("der Grenzertrag bleibt immer positiv", () => {
    for (let raw = 0; raw <= 200; raw += 5) {
      expect(marginalGain(raw, 1, moderat)).toBeGreaterThan(0);
    }
  });

  it("der Grenzertrag sinkt mit steigender Punktzahl", () => {
    const early = marginalGain(0, 5, moderat);
    const mid = marginalGain(15, 5, moderat);
    const late = marginalGain(35, 5, moderat);
    expect(mid).toBeLessThan(early);
    expect(late).toBeLessThan(mid);
  });
});

describe("Staffelung: staucht das Feld", () => {
  it("doppelter Aufwand ergibt deutlich weniger als doppelten Vorsprung", () => {
    const schwach = applyHandicap(20, moderat);
    const stark = applyHandicap(40, moderat);
    expect(stark - schwach).toBeLessThan(20 - 0); // roher Abstand waere 20
    expect(stark - schwach).toBe(7.5);
  });

  it("staerkere Voreinstellung staucht staerker", () => {
    const abstand = (factors: number[]) => {
      const cfg = { enabled: true, bracket: 10, factors };
      return applyHandicap(40, cfg) - applyHandicap(20, cfg);
    };
    expect(abstand(HANDICAP_PRESETS.stark)).toBeLessThan(abstand(HANDICAP_PRESETS.moderat));
    expect(abstand(HANDICAP_PRESETS.moderat)).toBeLessThan(abstand(HANDICAP_PRESETS.sanft));
  });
});

describe("Umkehrung fuer den Ueberhol-Rechner", () => {
  it("rawNeededFor ist die Umkehrung von applyHandicap", () => {
    for (const eff of [1, 5, 10, 17.5, 22.5, 25, 30]) {
      const raw = rawNeededFor(eff, moderat);
      expect(applyHandicap(raw, moderat)).toBeCloseTo(eff, 2);
    }
  });

  it("ohne Staffelung ist roh gleich effektiv", () => {
    const off = { ...moderat, enabled: false };
    expect(rawNeededFor(12.3, off)).toBe(12.3);
  });
});

describe("Stufenanzeige", () => {
  it("nennt die richtige Stufe und wann die naechste beginnt", () => {
    expect(currentTier(5, moderat)).toEqual({ tier: 0, factor: 1, nextAt: 10 });
    expect(currentTier(15, moderat)).toEqual({ tier: 1, factor: 0.75, nextAt: 20 });
    expect(currentTier(25, moderat)).toEqual({ tier: 2, factor: 0.5, nextAt: 30 });
  });

  it("die letzte Stufe hat kein Ende mehr", () => {
    expect(currentTier(99, moderat).nextAt).toBeNull();
  });
});

describe("Snapshot-Verhalten", () => {
  it("alte Perioden ohne Staffelung bleiben unveraendert", () => {
    const cfg = handicapFromSnapshot({});
    expect(cfg.enabled).toBe(false);
    expect(applyHandicap(40, cfg)).toBe(40);
  });

  it("faellt auf sinnvolle Werte zurueck wenn die Konfiguration luecken hat", () => {
    const cfg = handicapFromSnapshot({ handicap: { enabled: true } });
    expect(cfg.bracket).toBe(DEFAULT_HANDICAP.bracket);
    expect(cfg.factors.length).toBeGreaterThan(0);
  });
});
