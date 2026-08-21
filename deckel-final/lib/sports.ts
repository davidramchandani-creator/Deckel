/**
 * The sports engine.
 *
 * Every sport is defined by a unit and a rate:
 *
 *   - unit "km":  points = kilometres x rate   (running, cycling, swimming)
 *   - unit "min": points = minutes x rate      (gym, yoga -- no distance)
 *
 * The catalog below is the menu; each group's admin decides which sports
 * count and at what rate. The chosen config is frozen into every period's
 * settings_snapshot, so mid-period rule changes never reshuffle standings.
 *
 * Rates are calibrated so an hour of honest effort lands in a similar
 * points range across sports (roughly 8-12 P/h), with running as the
 * reference at 1.00 P/km.
 *
 * For "min" sports, the rate is only the base -- see effortFactor() below
 * for how average heart rate scales it up or down.
 */

export type SportUnit = "km" | "min";

export interface SportDef {
  key: string;
  label: string;
  unit: SportUnit;
  /** Points per unit (per km or per minute). */
  rate: number;
  /** Strava sport_type values that map to this sport. */
  stravaTypes: string[];
  enabled: boolean;
}

export const SPORTS_CATALOG: SportDef[] = [
  // --- distance sports: points per kilometre ---
  { key: "run", label: "Laufen", unit: "km", rate: 1.0,
    stravaTypes: ["Run", "TrailRun", "VirtualRun"], enabled: true },
  { key: "bike", label: "Velo", unit: "km", rate: 0.25,
    stravaTypes: ["Ride", "VirtualRide", "GravelRide", "MountainBikeRide", "Velomobile", "Handcycle"],
    enabled: true },
  // E-bikes get their own, much lower rate -- a motor is not the same
  // effort, and lumping them in with road bikes would be unfair.
  { key: "ebike", label: "E-Bike", unit: "km", rate: 0.1,
    stravaTypes: ["EBikeRide", "EMountainBikeRide"], enabled: false },
  { key: "swim", label: "Schwimmen", unit: "km", rate: 3.0,
    stravaTypes: ["Swim"], enabled: false },
  { key: "hike", label: "Wandern", unit: "km", rate: 0.5,
    stravaTypes: ["Hike"], enabled: false },
  { key: "walk", label: "Spazieren", unit: "km", rate: 0.3,
    stravaTypes: ["Walk", "Wheelchair"], enabled: false },
  { key: "row", label: "Rudern & Paddeln", unit: "km", rate: 0.6,
    stravaTypes: ["Rowing", "VirtualRow", "Kayaking", "Canoeing", "StandUpPaddling"],
    enabled: false },
  { key: "skate", label: "Skaten", unit: "km", rate: 0.35,
    stravaTypes: ["InlineSkate", "IceSkate", "Skateboard"], enabled: false },
  { key: "wintersport", label: "Ski & Snowboard", unit: "km", rate: 0.5,
    stravaTypes: ["NordicSki", "BackcountrySki", "RollerSki", "Snowshoe", "AlpineSki", "Snowboard"],
    enabled: false },

  // --- time sports: points per minute ---
  { key: "gym", label: "Kraft & Fitness", unit: "min", rate: 0.15,
    stravaTypes: ["WeightTraining", "Workout", "Crossfit", "HighIntensityIntervalTraining", "Elliptical", "StairStepper"],
    enabled: false },
  { key: "yoga", label: "Yoga & Pilates", unit: "min", rate: 0.1,
    stravaTypes: ["Yoga", "Pilates"], enabled: false },
  // Racketsport war frueher ein einziger Sammeleintrag. Das machte Tennis
  // unauffindbar -- wer "Tennis" sucht, sucht nicht nach "Racketsport" --
  // und warf ausserdem Tischtennis mit Squash in einen Topf, obwohl die
  // Belastung voellig verschieden ist.
  { key: "tennis", label: "Tennis", unit: "min", rate: 0.15,
    stravaTypes: ["Tennis", "Pickleball"], enabled: false },
  { key: "squash", label: "Squash", unit: "min", rate: 0.18,
    stravaTypes: ["Squash", "Racquetball"], enabled: false },
  { key: "badminton", label: "Badminton", unit: "min", rate: 0.15,
    stravaTypes: ["Badminton"], enabled: false },
  { key: "tabletennis", label: "Tischtennis", unit: "min", rate: 0.1,
    stravaTypes: ["TableTennis"], enabled: false },
  { key: "football", label: "Fussball", unit: "min", rate: 0.15,
    stravaTypes: ["Soccer"], enabled: false },
  { key: "climb", label: "Klettern", unit: "min", rate: 0.15,
    stravaTypes: ["RockClimbing"], enabled: false },
  { key: "watersport", label: "Surfen & Segeln", unit: "min", rate: 0.12,
    stravaTypes: ["Surfing", "Kitesurf", "Windsurf", "Sail"], enabled: false },
  // Golf wurde nach Dauer kalibriert -- bei Golf ist die Dauer aber
  // groesstenteils Warten. Mit 0.06 P/min brachte eine 4-Stunden-Runde
  // 14.4 Punkte, so viel wie 14.4 km Laufen. Eine 18-Loch-Runde zu Fuss
  // sind etwa 9 km Gehen, also rund 3 Punkte -- daher 0.02.
  { key: "golf", label: "Golf", unit: "min", rate: 0.02,
    stravaTypes: ["Golf"], enabled: false },
];

/** JSON shape stored in group_settings.sports and settings_snapshot.sports. */
export type SportsConfig = Record<string, { rate: number; enabled: boolean }>;

export function defaultSportsConfig(): SportsConfig {
  const out: SportsConfig = {};
  for (const s of SPORTS_CATALOG) out[s.key] = { rate: s.rate, enabled: s.enabled };
  return out;
}

/**
 * Resolve the effective sports list from a period snapshot.
 *
 * Older periods predate the sports engine and only carry bike_factor.
 * They resolve to the original run/bike rules, so historic and running
 * periods score exactly as they always did.
 */
export function sportsFromSnapshot(snapshot: {
  bike_factor?: number;
  sports?: SportsConfig | null;
}): SportDef[] {
  const config = snapshot.sports;
  if (!config) {
    return SPORTS_CATALOG.filter((s) => s.key === "run" || s.key === "bike").map(
      (s) => ({
        ...s,
        enabled: true,
        rate: s.key === "bike" ? (snapshot.bike_factor ?? 0.25) : 1.0,
      })
    );
  }
  return SPORTS_CATALOG.filter((s) => config[s.key]?.enabled).map((s) => ({
    ...s,
    enabled: true,
    rate: config[s.key].rate,
  }));
}

/** Map a raw Strava sport_type onto an enabled sport, or null if it doesn't count. */
export function classifyBySports(
  stravaType: string,
  sports: SportDef[]
): SportDef | null {
  return sports.find((s) => s.stravaTypes.includes(stravaType)) ?? null;
}

export function sportByKey(key: string, sports: SportDef[]): SportDef | null {
  return sports.find((s) => s.key === key) ?? null;
}

export interface ScorableActivity {
  sportKey: string;
  distanceKm: number;
  movingTimeMin: number;
  /** Strava's average_heartrate for this activity, wenn vorhanden. */
  avgHeartrate?: number | null;
}

/**
 * Persoenlicher Ruhepuls/Maximalpuls -- Eigenschaft der Person, nicht der
 * Gruppe. Kommt aus members.resting_hr / members.max_hr.
 */
export interface HeartRateProfile {
  restingHr: number | null;
  maxHr: number | null;
}

/* ------------------------------------------------------------------
 * Anstrengungsfaktor fuer Zeit-Sportarten.
 *
 * Bei Distanz-Sportarten (Laufen, Velo, ...) ist Tempo egal -- ein
 * lockerer Erholungslauf bekommt schon durch die Kilometer die richtige
 * (volle) Wertung. Bei Zeit-Sportarten (Kraft, Yoga, Racketsport, ...)
 * ist Zeit dagegen die einzige Groesse, und Zeit laesst sich mit Pausen
 * strecken -- zwei Stunden mit viel Leerlauf zaehlen sonst gleich viel
 * wie eine durchgehend geforderte Stunde.
 *
 * Der Puls-Durchschnitt der ganzen Aktivitaet loest genau das: eine
 * Session mit vielen kurzen, harten Saetzen und normalen Pausen bleibt
 * im Schnitt hoch; eine Session, die grossteils Leerlauf war, faellt ab.
 * Absichtlich NICHT bestraft wird "hat Pausen gemacht" an sich -- jedes
 * vernuenftige Krafttraining hat welche.
 *
 * Zwei Massstaebe:
 *  - Mit hinterlegtem Ruhepuls/Maximalpuls: relativ zur eigenen
 *    Herzfrequenzreserve (Karvonen) -- fair unabhaengig vom individuellen
 *    Ruhepuls.
 *  - Ohne Profil: feste bpm-Schwellen als Rueckfall. Schwaecher, aber
 *    besser als nichts.
 *
 * Fehlt der Puls ganz (kein Gurt, manueller Eintrag): Faktor 1 (neutral)
 * -- weder Bonus noch Strafe.
 *
 * Erster Entwurf, kalibriert an echten Trainingsdaten der Gruppe.
 * Absichtlich nachjustierbar, sobald mehr Sessions vorliegen.
 * ------------------------------------------------------------------ */

interface EffortZone {
  max: number;
  factor: number;
}

const EFFORT_ZONES_ABSOLUTE_BPM: EffortZone[] = [
  { max: 90, factor: 0.6 },
  { max: 105, factor: 0.8 },
  { max: 120, factor: 1.0 },
  { max: 140, factor: 1.25 },
  { max: Infinity, factor: 1.5 },
];

const EFFORT_ZONES_PERCENT_HRR: EffortZone[] = [
  { max: 25, factor: 0.6 },
  { max: 40, factor: 0.8 },
  { max: 55, factor: 1.0 },
  { max: 70, factor: 1.25 },
  { max: Infinity, factor: 1.5 },
];

function zoneFactor(value: number, zones: EffortZone[]): number {
  for (const z of zones) {
    if (value < z.max) return z.factor;
  }
  return zones[zones.length - 1].factor;
}

/**
 * Anstrengungsfaktor fuer eine Aktivitaet mit gegebenem Ø-Puls.
 * Ohne Pulsdaten: 1 (neutral). Mit Profil: relativ (%HFR). Ohne Profil,
 * aber mit Puls: absolute bpm-Schwellen.
 */
export function effortFactor(
  avgHeartrate: number | null | undefined,
  profile?: HeartRateProfile | null
): number {
  if (avgHeartrate == null || avgHeartrate <= 0) return 1;

  const restingHr = profile?.restingHr;
  const maxHr = profile?.maxHr;
  if (restingHr != null && maxHr != null && maxHr > restingHr) {
    const pctHrr = ((avgHeartrate - restingHr) / (maxHr - restingHr)) * 100;
    return zoneFactor(Math.max(0, pctHrr), EFFORT_ZONES_PERCENT_HRR);
  }

  return zoneFactor(avgHeartrate, EFFORT_ZONES_ABSOLUTE_BPM);
}

/** Points for one activity under the given sports config. Unknown sports score 0. */
export function pointsForScorable(
  a: ScorableActivity,
  sports: SportDef[],
  profile?: HeartRateProfile | null
): number {
  const sport = sportByKey(a.sportKey, sports);
  if (!sport) return 0;
  if (sport.unit === "km") return a.distanceKm * sport.rate;
  const factor = effortFactor(a.avgHeartrate, profile);
  return Math.round(a.movingTimeMin * sport.rate * factor * 100) / 100;
}

export function totalPointsFor(
  activities: ScorableActivity[],
  sports: SportDef[],
  profile?: HeartRateProfile | null
): number {
  return activities.reduce((sum, a) => sum + pointsForScorable(a, sports, profile), 0);
}

/** "12.5 km" or "45 min" depending on the sport's unit. */
export function formatAmount(a: ScorableActivity, sports: SportDef[]): string {
  const sport = sportByKey(a.sportKey, sports);
  if (sport?.unit === "min") return `${Math.round(a.movingTimeMin)} min`;
  return `${a.distanceKm.toFixed(1)} km`;
}

/* ------------------------------------------------------------------
 * Progressive Punkte-Staffelung ("Bremse")
 *
 * Ziel: niemand soll davonziehen koennen. Je hoeher die eigene
 * Punktzahl, desto weniger bringt der naechste Punkt -- nach demselben
 * Prinzip wie Steuerstufen.
 *
 * Bewusst nur von der EIGENEN Rohpunktzahl abhaengig, nicht vom Abstand
 * zu anderen. Dadurch ist der Wert einer Aktivitaet vorhersehbar und
 * aendert sich nie rueckwirkend, wenn jemand anderes etwas eintraegt.
 * ------------------------------------------------------------------ */

export interface HandicapConfig {
  enabled: boolean;
  /** Groesse einer Stufe in Rohpunkten. */
  bracket: number;
  /** Faktor je Stufe. Der letzte Wert gilt fuer alles darueber. */
  factors: number[];
}

export const HANDICAP_PRESETS: Record<string, number[]> = {
  sanft: [1, 0.85, 0.7, 0.55],
  moderat: [1, 0.75, 0.5, 0.25],
  stark: [1, 0.6, 0.35, 0.15],
};

export const DEFAULT_HANDICAP: HandicapConfig = {
  enabled: false,
  bracket: 10,
  factors: HANDICAP_PRESETS.moderat,
};

export function handicapFromSnapshot(snapshot: {
  handicap?: Partial<HandicapConfig> | null;
}): HandicapConfig {
  const h = snapshot.handicap;
  if (!h || !h.enabled) return { ...DEFAULT_HANDICAP, enabled: false };
  return {
    enabled: true,
    bracket: h.bracket && h.bracket > 0 ? h.bracket : DEFAULT_HANDICAP.bracket,
    factors:
      Array.isArray(h.factors) && h.factors.length > 0
        ? h.factors
        : DEFAULT_HANDICAP.factors,
  };
}

/**
 * Rechnet Rohpunkte in effektive Punkte um.
 *
 * Streng monoton steigend: mehr Rohpunkte ergeben immer mehr effektive
 * Punkte. Das ist die entscheidende Eigenschaft -- ohne sie gaebe es
 * wieder eine tote Zone, in der Anstrengung nichts mehr bringt.
 */
export function applyHandicap(rawPoints: number, cfg: HandicapConfig): number {
  if (!cfg.enabled || rawPoints <= 0) return Math.max(0, rawPoints);

  let remaining = rawPoints;
  let effective = 0;
  let tier = 0;

  while (remaining > 0) {
    const factor = cfg.factors[Math.min(tier, cfg.factors.length - 1)];
    const slice = Math.min(remaining, cfg.bracket);
    effective += slice * factor;
    remaining -= slice;
    tier++;
  }

  return Math.round(effective * 100) / 100;
}

/** Wieviel effektive Punkte bringen die naechsten `delta` Rohpunkte? */
export function marginalGain(
  currentRaw: number,
  delta: number,
  cfg: HandicapConfig
): number {
  return (
    Math.round(
      (applyHandicap(currentRaw + delta, cfg) - applyHandicap(currentRaw, cfg)) * 100
    ) / 100
  );
}

/**
 * Umkehrung: wieviel ROHpunkte braucht es, um `targetEffective` effektive
 * Punkte zu erreichen? Wird fuer den Ueberhol-Rechner gebraucht -- der
 * muss ja sagen, wieviele Kilometer noetig sind, nicht wieviele Punkte.
 */
export function rawNeededFor(targetEffective: number, cfg: HandicapConfig): number {
  if (!cfg.enabled) return targetEffective;
  if (targetEffective <= 0) return 0;

  let remaining = targetEffective;
  let raw = 0;
  let tier = 0;

  while (remaining > 0) {
    const factor = cfg.factors[Math.min(tier, cfg.factors.length - 1)];
    const tierCapacity = cfg.bracket * factor;
    if (remaining <= tierCapacity) {
      raw += remaining / factor;
      remaining = 0;
    } else {
      raw += cfg.bracket;
      remaining -= tierCapacity;
    }
    tier++;
    if (tier > 1000) break; // Sicherheitsnetz gegen Endlosschleife
  }

  return Math.round(raw * 100) / 100;
}

/** Die aktuelle Stufe (0-basiert) und ihr Faktor, fuer die Anzeige. */
export function currentTier(
  rawPoints: number,
  cfg: HandicapConfig
): { tier: number; factor: number; nextAt: number | null } {
  if (!cfg.enabled) return { tier: 0, factor: 1, nextAt: null };
  const tier = Math.floor(rawPoints / cfg.bracket);
  const factor = cfg.factors[Math.min(tier, cfg.factors.length - 1)];
  const isLast = tier >= cfg.factors.length - 1;
  return {
    tier,
    factor,
    nextAt: isLast ? null : (tier + 1) * cfg.bracket,
  };
}
