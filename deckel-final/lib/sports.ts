/**
 * The sports engine.
 *
 * Every sport is defined by a unit and a rate:
 *
 *   - unit "km":  points = kilometres x rate   (running, cycling, swimming)
 *   - unit "min": points = minutes x rate      (strength, yoga -- no distance)
 *
 * The catalog below is the menu; each group's admin decides which sports
 * count and at what rate. The chosen config is frozen into every period's
 * settings_snapshot, so mid-period rule changes never reshuffle standings.
 *
 * Rates are calibrated so an hour of honest effort lands in a similar
 * points range across sports (roughly 8-12 P/h), with running as the
 * reference at 1.00 P/km.
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
  { key: "run", label: "Laufen", unit: "km", rate: 1.0,
    stravaTypes: ["Run", "TrailRun", "VirtualRun"], enabled: true },
  { key: "bike", label: "Velo", unit: "km", rate: 0.25,
    stravaTypes: ["Ride", "VirtualRide", "GravelRide", "MountainBikeRide"], enabled: true },
  { key: "swim", label: "Schwimmen", unit: "km", rate: 3.0,
    stravaTypes: ["Swim"], enabled: false },
  { key: "hike", label: "Wandern", unit: "km", rate: 0.5,
    stravaTypes: ["Hike"], enabled: false },
  { key: "walk", label: "Spazieren", unit: "km", rate: 0.3,
    stravaTypes: ["Walk"], enabled: false },
  { key: "row", label: "Rudern & Paddeln", unit: "km", rate: 0.6,
    stravaTypes: ["Rowing", "VirtualRow", "Kayaking", "Canoeing", "StandUpPaddling"], enabled: false },
  { key: "skate", label: "Skaten", unit: "km", rate: 0.35,
    stravaTypes: ["InlineSkate", "IceSkate"], enabled: false },
  { key: "wintersport", label: "Langlauf & Ski", unit: "km", rate: 0.5,
    stravaTypes: ["NordicSki", "BackcountrySki", "Snowshoe", "RollerSki"], enabled: false },
  { key: "strength", label: "Krafttraining", unit: "min", rate: 0.15,
    stravaTypes: ["WeightTraining", "Workout", "Crossfit", "HighIntensityIntervalTraining"], enabled: false },
  { key: "yoga", label: "Yoga & Pilates", unit: "min", rate: 0.1,
    stravaTypes: ["Yoga", "Pilates"], enabled: false },
  { key: "racket", label: "Racketsport", unit: "min", rate: 0.15,
    stravaTypes: ["Tennis", "Badminton", "Squash", "Pickleball", "TableTennis", "Racquetball", "Padel"], enabled: false },
  { key: "football", label: "Fussball & Teamsport", unit: "min", rate: 0.15,
    stravaTypes: ["Soccer"], enabled: false },
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
}

/** Points for one activity under the given sports config. Unknown sports score 0. */
export function pointsForScorable(a: ScorableActivity, sports: SportDef[]): number {
  const sport = sportByKey(a.sportKey, sports);
  if (!sport) return 0;
  return sport.unit === "km" ? a.distanceKm * sport.rate : a.movingTimeMin * sport.rate;
}

export function totalPointsFor(activities: ScorableActivity[], sports: SportDef[]): number {
  return activities.reduce((sum, a) => sum + pointsForScorable(a, sports), 0);
}

/** "12.5 km" or "45 min" depending on the sport's unit. */
export function formatAmount(a: ScorableActivity, sports: SportDef[]): string {
  const sport = sportByKey(a.sportKey, sports);
  if (sport?.unit === "min") return `${Math.round(a.movingTimeMin)} min`;
  return `${a.distanceKm.toFixed(1)} km`;
}
