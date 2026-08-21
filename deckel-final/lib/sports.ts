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
  /**
   * Typischer Ø-Puls dieser Sportart bei normaler Anstrengung, als Anteil
   * der Herzfrequenzreserve (0-1). Nur fuer Zeit-Sportarten relevant.
   * Siehe effortFactor() -- der Faktor misst die Abweichung hiervon, nicht
   * den absoluten Puls.
   */
  hrReference?: number;
}

/* ------------------------------------------------------------------
 * Die Saetze: eine Stunde Sport soll ueberall aehnlich viel wert sein.
 *
 * Massstab ist der MET-Wert der Sportart (metabolisches Aequivalent,
 * publizierte Richtwerte fuer den Energieverbrauch; 1 MET = Ruhe).
 * Faustregel: Punkte pro Stunde ~ MET. Laufen (~12.5 MET bei 12.4 km/h,
 * dem echten Schnitt dieser Gruppe) bleibt der Anker bei 1.00 P/km --
 * daraus ergeben sich alle anderen Saetze ueber die typische
 * Geschwindigkeit bzw. direkt pro Minute.
 *
 * Wichtig fuers Verstaendnis: bei GPS-Sportarten zaehlt Strava nur die
 * BEWEGUNGSzeit (eine Golfrunde steht mit ~45 min drin, nicht mit 4 h),
 * bei Hallensport dagegen die volle Dauer inklusive Pausen. Deshalb
 * wirken die P/min-Saetze fuer Gym & Co. niedrig -- die Pausen stecken
 * schon in der Zeit, und den Rest regelt der Anstrengungsfaktor unten.
 * ------------------------------------------------------------------ */

export const SPORTS_CATALOG: SportDef[] = [
  // --- distance sports: points per kilometre ---
  // ~12.5 MET / 12.4 km/h (Gruppenschnitt) -> 1.00 P/km. Der Anker.
  { key: "run", label: "Laufen", unit: "km", rate: 1.0,
    stravaTypes: ["Run", "TrailRun", "VirtualRun"], enabled: true },
  // ~8 MET / 24 km/h (Gruppenschnitt) -> 0.33 P/km.
  { key: "bike", label: "Velo", unit: "km", rate: 0.33,
    stravaTypes: ["Ride", "VirtualRide", "GravelRide", "MountainBikeRide", "Velomobile", "Handcycle"],
    enabled: true },
  // E-bikes get their own, much lower rate -- a motor is not the same
  // effort, and lumping them in with road bikes would be unfair.
  // ~4.5 MET / 23 km/h -> 0.20 P/km.
  { key: "ebike", label: "E-Bike", unit: "km", rate: 0.2,
    stravaTypes: ["EBikeRide", "EMountainBikeRide"], enabled: false },
  // ~7 MET / 1.6 km/h (Gruppenschnitt) -> 4.4 P/km. Ja, wirklich: ein
  // Kilometer Schwimmen ist Arbeit fuer eine gute halbe Stunde.
  { key: "swim", label: "Schwimmen", unit: "km", rate: 4.4,
    stravaTypes: ["Swim"], enabled: false },
  // ~5.3 MET / 3.5 km/h -> 1.5 P/km. Vorher stand Wandern kaum ueber
  // Spazieren, obwohl es meist bergauf geht.
  { key: "hike", label: "Wandern", unit: "km", rate: 1.5,
    stravaTypes: ["Hike"], enabled: false },
  // ~3 MET / 4.5 km/h -> 0.65 P/km. Physiologisch korrekt, strategisch
  // die offene Tuer im System: wer viel Zeit hat, kann mit Spazieren
  // Punkte sammeln. Bewusst standardmaessig AUS -- einschalten ist ein
  // informierter Gruppenentscheid.
  { key: "walk", label: "Spazieren", unit: "km", rate: 0.65,
    stravaTypes: ["Walk", "Wheelchair"], enabled: false },
  // ~7 MET / 8 km/h -> 0.9 P/km.
  { key: "row", label: "Rudern & Paddeln", unit: "km", rate: 0.9,
    stravaTypes: ["Rowing", "VirtualRow", "Kayaking", "Canoeing", "StandUpPaddling"],
    enabled: false },
  // ~7.5 MET / 15 km/h -> 0.5 P/km.
  { key: "skate", label: "Skaten", unit: "km", rate: 0.5,
    stravaTypes: ["InlineSkate", "IceSkate", "Skateboard"], enabled: false },
  // Mischwert ~6 MET / 10 km/h -> 0.6 P/km. Langlauf ist haerter,
  // Alpin-Abfahrt leichter als der Satz -- der Sammel-Eintrag ist ein
  // Kompromiss, bis die Gruppe echte Winterdaten hat.
  { key: "wintersport", label: "Ski & Snowboard", unit: "km", rate: 0.6,
    stravaTypes: ["NordicSki", "BackcountrySki", "RollerSki", "Snowshoe", "AlpineSki", "Snowboard"],
    enabled: false },

  // --- time sports: points per minute ---
  //
  // Satz = MET/60, gerundet. Dazu hrReference: der typische Ø-Puls DIESER
  // Sportart (als Anteil der Herzfrequenzreserve). Kraftsport liegt tief,
  // weil schwere Saetze kurz sind und dazwischen pausiert wird -- das ist
  // keine geringere Anstrengung, sondern andere Physiologie. Der
  // Anstrengungsfaktor vergleicht deshalb immer nur innerhalb derselben
  // Sportart. Referenzen fuer Kraft/Golf/Fussball sind an echten
  // Gruppendaten kalibriert (Median Ø-Puls 96/107/147), der Rest ist
  // physiologisch geschaetzt und wird nachjustiert, sobald Daten da sind.
  //
  // ~5.5 MET -> 0.09 P/min. Die Abwertung von 0.15 ist Absicht: eine
  // Stunde Gym stand mit vollen Satzpausen fast gleich hoch wie eine
  // Stunde Laufen in Bewegung.
  { key: "gym", label: "Kraft & Fitness", unit: "min", rate: 0.09, hrReference: 0.28,
    stravaTypes: ["WeightTraining", "Workout", "Crossfit", "HighIntensityIntervalTraining", "Elliptical", "StairStepper"],
    enabled: false },
  // ~3 MET -> 0.05 P/min.
  { key: "yoga", label: "Yoga & Pilates", unit: "min", rate: 0.05, hrReference: 0.18,
    stravaTypes: ["Yoga", "Pilates"], enabled: false },
  // Racketsport war frueher ein einziger Sammeleintrag. Das machte Tennis
  // unauffindbar -- wer "Tennis" sucht, sucht nicht nach "Racketsport" --
  // und warf ausserdem Tischtennis mit Squash in einen Topf, obwohl die
  // Belastung voellig verschieden ist.
  // ~7 MET -> 0.12 P/min.
  { key: "tennis", label: "Tennis", unit: "min", rate: 0.12, hrReference: 0.5,
    stravaTypes: ["Tennis", "Pickleball"], enabled: false },
  // ~9 MET -> 0.15 P/min. Der haerteste Racketsport.
  { key: "squash", label: "Squash", unit: "min", rate: 0.15, hrReference: 0.6,
    stravaTypes: ["Squash", "Racquetball"], enabled: false },
  // ~5.5 MET (Freizeitspiel) -> 0.09 P/min.
  { key: "badminton", label: "Badminton", unit: "min", rate: 0.09, hrReference: 0.48,
    stravaTypes: ["Badminton"], enabled: false },
  // ~4 MET -> 0.07 P/min.
  { key: "tabletennis", label: "Tischtennis", unit: "min", rate: 0.07, hrReference: 0.3,
    stravaTypes: ["TableTennis"], enabled: false },
  // ~7 MET (Freizeitspiel ueber die volle Dauer) -> 0.12 P/min.
  { key: "football", label: "Fussball", unit: "min", rate: 0.12, hrReference: 0.65,
    stravaTypes: ["Soccer"], enabled: false },
  // ~7.5 MET klettern, aber viel Sichern/Stehen -> 0.12 P/min.
  { key: "climb", label: "Klettern", unit: "min", rate: 0.12, hrReference: 0.33,
    stravaTypes: ["RockClimbing"], enabled: false },
  // ~5 MET Mischwert -> 0.08 P/min.
  { key: "watersport", label: "Surfen & Segeln", unit: "min", rate: 0.08, hrReference: 0.33,
    stravaTypes: ["Surfing", "Kitesurf", "Windsurf", "Sail"], enabled: false },
  // ~4.3 MET (zu Fuss, Bag tragen) -> 0.07 P/min. Wirkt hoch verglichen
  // mit frueher (0.02) -- aber Strava zaehlt bei Golf nur die
  // Bewegungszeit, eure Runden stehen mit 22-58 min drin, nicht mit 4 h.
  { key: "golf", label: "Golf", unit: "min", rate: 0.07, hrReference: 0.36,
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
 * Das Problem: bei Distanz-Sportarten ist Tempo egal -- ein lockerer
 * Erholungslauf bekommt ueber die Kilometer schon die richtige (volle)
 * Wertung. Bei Zeit-Sportarten ist Zeit die EINZIGE Groesse, und Zeit
 * laesst sich mit Leerlauf strecken: zwei Stunden im Gym mit 25 Minuten
 * echter Arbeit zaehlen sonst gleich viel wie zwei Stunden Arbeit.
 *
 * Die naheliegende Loesung -- absoluter Ø-Puls -- ist falsch, und zwar
 * messbar. Aus den echten Daten dieser Gruppe (Median Ø-Puls):
 *
 *     Kraft & Fitness   96
 *     Golf             107
 *     Fussball         147
 *
 * Golf liegt ueber Kraftsport. Nicht weil Golf anstrengender waere,
 * sondern weil Golf durchgehendes Gehen ist und Kraftsport aus kurzen,
 * schweren Saetzen mit Pausen besteht. Ein universeller Puls-Massstab
 * wuerde Kraftsport also systematisch bestrafen und Ballsport belohnen --
 * das hat mit Anstrengung nichts zu tun, nur mit Physiologie.
 *
 * Darum wird jede Sportart an IHREM eigenen Normalwert gemessen
 * (SportDef.hrReference). Der Faktor sagt: "wie hart war diese Einheit
 * verglichen mit einer normalen Einheit derselben Sportart?" Ein
 * verschlafenes Krafttraining faellt ab, ein hartes wird belohnt -- aber
 * Kraftsport als Ganzes verliert nicht gegen Fussball. Wie viel eine
 * Sportart grundsaetzlich wert ist, entscheidet allein ihr Satz (rate),
 * und den stellt die Gruppe selbst ein.
 *
 * Zwei Massstaebe fuer den Vergleich:
 *  - Mit hinterlegtem Ruhepuls/Maximalpuls: ueber die eigene
 *    Herzfrequenzreserve (Karvonen) -- fair unabhaengig davon, ob jemand
 *    von Natur aus einen tiefen oder hohen Puls hat.
 *  - Ohne Profil: derselbe Vergleich, aber mit Standardannahmen
 *    (Ruhepuls 60, Maximalpuls 190). Ungenauer, aber nie schlechter als
 *    gar keine Wertung.
 *
 * Fehlt der Puls ganz (kein Gurt, manueller Eintrag): Faktor 1, neutral
 * -- weder Bonus noch Strafe.
 * ------------------------------------------------------------------ */

/** Annahmen fuer alle, die kein eigenes Puls-Profil hinterlegt haben. */
const DEFAULT_RESTING_HR = 60;
const DEFAULT_MAX_HR = 190;

interface EffortZone {
  /** Obergrenze des Verhaeltnisses Ist-Puls zu Normalwert der Sportart. */
  max: number;
  factor: number;
}

/**
 * Abweichung vom Normalwert der Sportart. 1.0 heisst "genau normal".
 * Bewusst breite mittlere Zone: Tagesform, Wetter und Messgenauigkeit
 * schwanken, und dafuer soll niemand Geld zahlen.
 */
const EFFORT_ZONES_RATIO: EffortZone[] = [
  { max: 0.7, factor: 0.7 },
  { max: 0.9, factor: 0.85 },
  { max: 1.1, factor: 1.0 },
  { max: 1.3, factor: 1.2 },
  { max: Infinity, factor: 1.4 },
];

function zoneFactor(value: number, zones: EffortZone[]): number {
  for (const z of zones) {
    if (value < z.max) return z.factor;
  }
  return zones[zones.length - 1].factor;
}

/**
 * Anteil der Herzfrequenzreserve (0-1) fuer einen gemessenen Ø-Puls.
 *
 * Das Profil gilt bewusst nur als Ganzes: entweder beide Werte sind da und
 * ergeben zusammen Sinn, oder es zaehlen beide Standardannahmen. Ein
 * halbes Profil -- echter Ruhepuls, geschaetzter Maximalpuls -- wuerde die
 * Spanne verzerren und je nach Person in eine andere Richtung.
 */
function heartRateReserveFraction(
  avgHeartrate: number,
  profile?: HeartRateProfile | null
): number {
  const usable =
    profile?.restingHr != null &&
    profile.restingHr > 0 &&
    profile.maxHr != null &&
    profile.maxHr > profile.restingHr;

  const resting = usable ? profile!.restingHr! : DEFAULT_RESTING_HR;
  const max = usable ? profile!.maxHr! : DEFAULT_MAX_HR;

  return Math.max(0, (avgHeartrate - resting) / (max - resting));
}

/**
 * Anstrengungsfaktor: wie hart war diese Einheit im Vergleich zu einer
 * normalen Einheit derselben Sportart?
 *
 * Ohne Pulsdaten oder ohne Normalwert fuer die Sportart: 1 (neutral).
 */
export function effortFactor(
  avgHeartrate: number | null | undefined,
  profile?: HeartRateProfile | null,
  hrReference?: number | null
): number {
  if (avgHeartrate == null || avgHeartrate <= 0) return 1;
  if (hrReference == null || hrReference <= 0) return 1;

  const fraction = heartRateReserveFraction(avgHeartrate, profile);
  return zoneFactor(fraction / hrReference, EFFORT_ZONES_RATIO);
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
  const factor = effortFactor(a.avgHeartrate, profile, sport.hrReference);
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
