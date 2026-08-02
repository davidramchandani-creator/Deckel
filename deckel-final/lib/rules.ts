/**
 * Pace or Pay rule engine.
 *
 * Pure functions only -- no I/O, no Supabase, no dates-as-strings ambiguity.
 * Everything that decides who owes what lives here so it can be unit tested
 * in isolation and audited without reading the rest of the app.
 */

export type ActivityKind = "run" | "bike";

export type ParticipantStatus = "active" | "sick" | "withdrawn";

/** Strava activity `type` values that count as a run. */
const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);

/** Strava activity `type` values that count as a bike ride. */
const BIKE_TYPES = new Set(["Ride", "VirtualRide", "GravelRide", "MountainBikeRide"]);

/**
 * Classify a raw Strava activity type into a scoring category.
 * Returns null for anything that shouldn't count (swim, walk, workout, ...).
 */
export function classifyActivity(stravaType: string): ActivityKind | null {
  if (RUN_TYPES.has(stravaType)) return "run";
  if (BIKE_TYPES.has(stravaType)) return "bike";
  return null;
}

/**
 * Points earned for a single activity.
 * Run: 1.00 pt/km. Bike: bikeFactor pt/km (default 0.25, configurable 0.20/0.25/0.30).
 */
export function pointsForActivity(
  kind: ActivityKind,
  distanceKm: number,
  bikeFactor: number
): number {
  if (distanceKm < 0) throw new Error("distanceKm must be >= 0");
  return kind === "run" ? distanceKm : distanceKm * bikeFactor;
}

export interface ActivityInput {
  kind: ActivityKind;
  distanceKm: number;
}

/** Sum points for a set of already-classified activities. */
export function totalPoints(activities: ActivityInput[], bikeFactor: number): number {
  return activities.reduce((sum, a) => sum + pointsForActivity(a.kind, a.distanceKm, bikeFactor), 0);
}

/**
 * Current day index within a period, 1-based, clamped to [1, periodDays].
 * `now` and `start` should be at day granularity (midnight) to avoid
 * timezone/partial-day drift; callers pass Date objects already normalized.
 */
export function currentPeriodDay(start: Date, now: Date, periodDays: number): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const raw = Math.floor((now.getTime() - start.getTime()) / msPerDay) + 1;
  return Math.min(Math.max(raw, 1), periodDays);
}

/**
 * Prorated cap for a participant who reported sick on `sickFromDay` of a
 * `periodDays`-long period. Rounded to 2 decimals (currency).
 *
 *   deckel_krank = (meldetag / periodenlaenge) * deckel
 */
export function proratedCap(baseCap: number, sickFromDay: number, periodDays: number): number {
  if (sickFromDay < 1 || sickFromDay > periodDays) {
    throw new Error("sickFromDay must be within [1, periodDays]");
  }
  const raw = (sickFromDay / periodDays) * baseCap;
  return Math.round(raw * 100) / 100;
}

export interface Participant {
  memberId: string;
  points: number;
  status: ParticipantStatus;
  /** Required when status === 'sick'. Day (1-based) the sick report was filed. */
  sickFromDay?: number;
}

export interface SettlementLine {
  memberId: string;
  points: number;
  status: ParticipantStatus;
  /** The cap actually applied to this participant (0 for withdrawn). */
  capApplied: number;
  /** Amount owed in the group currency (e.g. CHF), rounded to 2 decimals. */
  owed: number;
  /** True if this participant is the period's record holder. */
  isRecordHolder: boolean;
}

export interface SettlementResult {
  lines: SettlementLine[];
  record: number;
  pot: number;
}

/**
 * The cap that applies to a participant given their status.
 * Withdrawn participants have no cap because they owe nothing regardless.
 */
export function capForParticipant(
  p: Pick<Participant, "status" | "sickFromDay">,
  baseCap: number,
  periodDays: number
): number {
  switch (p.status) {
    case "withdrawn":
      return 0;
    case "sick":
      if (p.sickFromDay == null) {
        throw new Error("sickFromDay is required for status 'sick'");
      }
      return proratedCap(baseCap, p.sickFromDay, periodDays);
    case "active":
      return baseCap;
  }
}

/**
 * Compute the full settlement for a period.
 *
 *   record    = max(points) over all non-withdrawn participants
 *   schuld(p) = min(deckel(p), max(0, record - points(p)))
 *
 * The record holder always pays 0. Withdrawn participants are excluded
 * from the record calculation and always owe 0, regardless of their points.
 */
export function computeSettlement(
  participants: Participant[],
  baseCap: number,
  periodDays: number
): SettlementResult {
  const contenders = participants.filter((p) => p.status !== "withdrawn");
  const record = contenders.length > 0 ? Math.max(...contenders.map((p) => p.points)) : 0;

  const lines: SettlementLine[] = participants.map((p) => {
    const capApplied = capForParticipant(p, baseCap, periodDays);
    const owedRaw =
      p.status === "withdrawn" ? 0 : Math.min(capApplied, Math.max(0, record - p.points));
    return {
      memberId: p.memberId,
      points: p.points,
      status: p.status,
      capApplied,
      owed: Math.round(owedRaw * 100) / 100,
      isRecordHolder: p.status !== "withdrawn" && p.points === record,
    };
  });

  const pot = Math.round(lines.reduce((sum, l) => sum + l.owed, 0) * 100) / 100;

  return { lines, record, pot };
}

/**
 * Idempotency guard for Strava webhook ingestion: given the set of
 * strava_activity_id values already stored, filter out ones already seen.
 * The real de-dupe also relies on a unique DB constraint on
 * strava_activity_id -- this is the in-memory mirror of that same rule,
 * kept here so it's testable without a database.
 */
export function dedupeByStravaId<T extends { stravaActivityId: number }>(
  incoming: T[],
  alreadyStored: Set<number>
): T[] {
  const seen = new Set(alreadyStored);
  const result: T[] = [];
  for (const activity of incoming) {
    if (seen.has(activity.stravaActivityId)) continue;
    seen.add(activity.stravaActivityId);
    result.push(activity);
  }
  return result;
}
