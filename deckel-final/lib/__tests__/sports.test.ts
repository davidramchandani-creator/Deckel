import { describe, expect, it } from "vitest";
import {
  SPORTS_CATALOG,
  classifyBySports,
  defaultSportsConfig,
  pointsForScorable,
  sportsFromSnapshot,
  totalPointsFor,
} from "../sports";
import { computeSettlement, type Participant } from "../rules";

describe("legacy snapshots (no sports config)", () => {
  const sports = sportsFromSnapshot({ bike_factor: 0.25 });

  it("resolves to exactly run and bike", () => {
    expect(sports.map((s) => s.key).sort()).toEqual(["bike", "run"]);
  });

  it("scores the original spec case identically", () => {
    expect(totalPointsFor([{ sportKey: "run", distanceKm: 12, movingTimeMin: 70 }], sports)).toBe(12);
    expect(totalPointsFor([{ sportKey: "bike", distanceKm: 28, movingTimeMin: 60 }], sports)).toBe(7);
  });

  it("ignores sports outside the legacy rules", () => {
    expect(pointsForScorable({ sportKey: "swim", distanceKm: 2, movingTimeMin: 60 }, sports)).toBe(0);
  });
});

describe("configured sports", () => {
  const config = defaultSportsConfig();
  config.swim = { rate: 3.0, enabled: true };
  config.gym = { rate: 0.15, enabled: true };
  const sports = sportsFromSnapshot({ sports: config });

  it("km sports score per kilometre", () => {
    expect(pointsForScorable({ sportKey: "swim", distanceKm: 2, movingTimeMin: 50 }, sports)).toBeCloseTo(6);
  });

  it("minute sports score per minute, distance irrelevant", () => {
    expect(pointsForScorable({ sportKey: "gym", distanceKm: 0, movingTimeMin: 60 }, sports)).toBeCloseTo(9);
  });

  it("disabled sports score zero even with data", () => {
    const cfg = defaultSportsConfig();
    cfg.run = { rate: 1.0, enabled: false };
    const noRun = sportsFromSnapshot({ sports: cfg });
    expect(pointsForScorable({ sportKey: "run", distanceKm: 10, movingTimeMin: 60 }, noRun)).toBe(0);
  });
});

describe("strava type mapping", () => {
  const sports = sportsFromSnapshot({ sports: defaultSportsConfig() });

  it("maps the classic types", () => {
    expect(classifyBySports("TrailRun", sports)?.key).toBe("run");
    expect(classifyBySports("GravelRide", sports)?.key).toBe("bike");
  });

  it("returns null for disabled or unknown types", () => {
    expect(classifyBySports("Swim", sports)).toBeNull();
    expect(classifyBySports("Quidditch", sports)).toBeNull();
  });
});

describe("catalog covers Strava completely", () => {
  const OFFICIAL = `AlpineSki BackcountrySki Badminton Canoeing Crossfit EBikeRide Elliptical
EMountainBikeRide Golf GravelRide Handcycle HighIntensityIntervalTraining Hike IceSkate
InlineSkate Kayaking Kitesurf MountainBikeRide NordicSki Pickleball Pilates Racquetball Ride
RockClimbing RollerSki Rowing Run Sail Skateboard Snowboard Snowshoe Soccer Squash StairStepper
StandUpPaddling Surfing Swim TableTennis Tennis TrailRun Velomobile VirtualRide VirtualRow
VirtualRun Walk WeightTraining Wheelchair Windsurf Workout Yoga`.split(/\s+/);

  const mapped = SPORTS_CATALOG.flatMap((s) => s.stravaTypes);

  it("every Strava sport type maps to exactly one sport", () => {
    for (const t of OFFICIAL) {
      expect(mapped.filter((m) => m === t).length).toBe(1);
    }
  });

  it("maps nothing Strava does not have", () => {
    for (const m of mapped) expect(OFFICIAL).toContain(m);
  });

  it("e-bikes score lower than real bikes", () => {
    const bike = SPORTS_CATALOG.find((s) => s.key === "bike")!;
    const ebike = SPORTS_CATALOG.find((s) => s.key === "ebike")!;
    expect(ebike.rate).toBeLessThan(bike.rate);
    expect(bike.stravaTypes).not.toContain("EBikeRide");
  });
});

describe("settlement over mixed sports", () => {
  it("swimmer and runner settle on points, not kilometres", () => {
    const cfg = defaultSportsConfig();
    cfg.swim = { rate: 3.0, enabled: true };
    const sports = sportsFromSnapshot({ sports: cfg });

    const participants: Participant[] = [
      { memberId: "r", points: totalPointsFor([{ sportKey: "run", distanceKm: 10, movingTimeMin: 60 }], sports), status: "active" },
      { memberId: "s", points: totalPointsFor([{ sportKey: "swim", distanceKm: 2.5, movingTimeMin: 55 }], sports), status: "active" },
    ];
    const result = computeSettlement(participants, 15, 14);
    expect(result.record).toBe(10);
    expect(result.lines.find((l) => l.memberId === "s")?.owed).toBe(3.75); // 15 x 2.5/10
  });
});
