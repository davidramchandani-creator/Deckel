import { describe, it, expect } from "vitest";
import {
  HANDICAP_PRESETS,
  DEFAULT_HANDICAP,
  applyHandicap,
  marginalGain,
  rawNeededFor,
  currentTier,
  handicapFromSnapshot,
  type HandicapConfig,
} from "../sports";

const moderat: HandicapConfig = {
  enabled: true,
  bracket: 10,
  factors: HANDICAP_PRESETS.moderat,
};

describe("applyHandicap", () => {
  it("laesst alles unveraendert, wenn die Staffelung aus ist", () => {
    expect(applyHandicap(42, { ...moderat, enabled: false })).toBe(42);
  });

  it("gibt nie negative Punkte zurueck", () => {
    expect(applyHandicap(-5, moderat)).toBe(0);
    expect(applyHandicap(-5, { ...moderat, enabled: false })).toBe(0);
  });

  it("zaehlt die erste Stufe voll", () => {
    expect(applyHandicap(10, moderat)).toBe(10);
    expect(applyHandicap(7.5, moderat)).toBe(7.5);
  });

  it("staffelt die zweite Stufe auf 75 Prozent", () => {
    expect(applyHandicap(20, moderat)).toBe(17.5);
  });

  it("staffelt ueber mehrere Stufen hinweg", () => {
    expect(applyHandicap(40, moderat)).toBe(25);
  });

  it("wendet den letzten Faktor auf alles darueber an", () => {
    expect(applyHandicap(80, moderat)).toBe(35);
  });
});

describe("Monotonie", () => {
  // Die wichtigste Eigenschaft ueberhaupt: mehr Aufwand muss IMMER mehr
  // Punkte geben. Gaebe es irgendwo eine flache Stelle, waere Training
  // dort wertlos -- genau der Fehler, den min(cap, deficit) frueher hatte.
  for (const name of Object.keys(HANDICAP_PRESETS)) {
    it("ist streng steigend beim Preset " + name, () => {
      const cfg: HandicapConfig = {
        enabled: true,
        bracket: 10,
        factors: HANDICAP_PRESETS[name],
      };
      let prev = -1;
      for (let raw = 0; raw <= 300; raw += 0.5) {
        const eff = applyHandicap(raw, cfg);
        expect(eff).toBeGreaterThan(prev);
        prev = eff;
      }
    });
  }

  it("gibt nie mehr effektive als rohe Punkte", () => {
    for (let raw = 0; raw <= 200; raw += 2.5) {
      expect(applyHandicap(raw, moderat)).toBeLessThanOrEqual(raw + 1e-9);
    }
  });
});

describe("marginalGain", () => {
  it("ist in der ersten Stufe eins zu eins", () => {
    expect(marginalGain(0, 5, moderat)).toBe(5);
  });

  it("wird kleiner, je weiter vorne man liegt", () => {
    const vorne = marginalGain(0, 5, moderat);
    const mitte = marginalGain(20, 5, moderat);
    const hinten = marginalGain(60, 5, moderat);
    expect(mitte).toBeLessThan(vorne);
    expect(hinten).toBeLessThan(mitte);
    expect(hinten).toBeGreaterThan(0);
  });
});

describe("rawNeededFor", () => {
  // applyHandicap rundet auf zwei Stellen, darum ist die Umkehrung nicht
  // bitgenau. Ueber alle Werte bis 300 liegt der Fehler unter 0.02 Punkten
  // -- fuer den Ueberhol-Rechner voellig unerheblich.
  it("ist die Umkehrung von applyHandicap", () => {
    for (const raw of [0, 3, 10, 17.5, 25, 40, 63, 120]) {
      const eff = applyHandicap(raw, moderat);
      expect(rawNeededFor(eff, moderat)).toBeCloseTo(raw, 1);
    }
  });

  it("weicht ueber den ganzen Bereich nie mehr als 0.05 Punkte ab", () => {
    for (let raw = 0; raw <= 300; raw += 0.25) {
      const back = rawNeededFor(applyHandicap(raw, moderat), moderat);
      expect(Math.abs(back - raw)).toBeLessThan(0.05);
    }
  });

  it("ist ohne Staffelung die Identitaet", () => {
    expect(rawNeededFor(33, { ...moderat, enabled: false })).toBe(33);
  });

  it("braucht mehr Rohpunkte, je hoeher das Ziel", () => {
    expect(rawNeededFor(30, moderat)).toBeGreaterThan(rawNeededFor(20, moderat));
  });
});

describe("currentTier", () => {
  it("meldet Stufe 0 und den naechsten Sprung", () => {
    const t = currentTier(4, moderat);
    expect(t.tier).toBe(0);
    expect(t.factor).toBe(1);
    expect(t.nextAt).toBe(10);
  });

  it("hat auf der letzten Stufe keinen naechsten Sprung mehr", () => {
    const t = currentTier(95, moderat);
    expect(t.factor).toBe(0.25);
    expect(t.nextAt).toBeNull();
  });

  it("ist neutral, wenn die Staffelung aus ist", () => {
    const t = currentTier(95, { ...moderat, enabled: false });
    expect(t.tier).toBe(0);
    expect(t.factor).toBe(1);
    expect(t.nextAt).toBeNull();
  });
});

describe("handicapFromSnapshot", () => {
  it("faellt auf aus zurueck, wenn nichts gespeichert ist", () => {
    expect(handicapFromSnapshot({}).enabled).toBe(false);
    expect(handicapFromSnapshot({ handicap: null }).enabled).toBe(false);
  });

  it("repariert eine unbrauchbare Stufengroesse", () => {
    const cfg = handicapFromSnapshot({ handicap: { enabled: true, bracket: 0 } });
    expect(cfg.bracket).toBe(DEFAULT_HANDICAP.bracket);
    expect(cfg.factors.length).toBeGreaterThan(0);
  });

  it("uebernimmt gespeicherte Werte", () => {
    const cfg = handicapFromSnapshot({
      handicap: { enabled: true, bracket: 25, factors: HANDICAP_PRESETS.stark },
    });
    expect(cfg.bracket).toBe(25);
    expect(cfg.factors).toEqual(HANDICAP_PRESETS.stark);
  });
});
