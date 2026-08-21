export interface Group {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

export interface GroupSettings {
  id: string;
  group_id: string;
  period_days: number;
  bike_factor: number;
  cap_chf: number;
  currency: string;
  valid_from: string;
}

export interface Member {
  id: string;
  group_id: string;
  user_id: string;
  display_name: string;
  role: "member" | "admin";
  strava_athlete_id: number | null;
  /** Fuer den Anstrengungsfaktor bei Zeit-Sportarten. Optional, selbst gepflegt. */
  resting_hr: number | null;
  max_hr: number | null;
  created_at: string;
}

export interface Period {
  id: string;
  group_id: string;
  starts_on: string;
  ends_on: string;
  settings_snapshot: {
    period_days: number;
    bike_factor: number;
    cap_chf: number;
    currency: string;
    sports?: Record<string, { rate: number; enabled: boolean }> | null;
    handicap?: {
      enabled: boolean;
      bracket: number;
      factors: number[];
    } | null;
  };
  status: "open" | "settled";
  settled_at: string | null;
}

export type ParticipationStatus = "active" | "sick" | "withdrawn";

export interface Participation {
  id: string;
  period_id: string;
  member_id: string;
  status: ParticipationStatus;
  sick_from_day: number | null;
}

export interface Activity {
  id: string;
  member_id: string;
  period_id: string | null;
  strava_activity_id: number | null;
  sport_type: string;
  distance_km: number;
  moving_time_s: number | null;
  /** Aus Strava gespiegelt, fuer den Anstrengungsfaktor. Bei manuellen Eintraegen null. */
  avg_heartrate: number | null;
  started_at: string;
  manual: boolean;
  source: "strava" | "manual";
  status?: "pending" | "approved" | "rejected";
  note?: string | null;
}

export interface Settlement {
  id: string;
  period_id: string;
  member_id: string;
  points: number;
  cap_applied: number;
  owed_chf: number;
  paid: boolean;
  paid_at: string | null;
}
