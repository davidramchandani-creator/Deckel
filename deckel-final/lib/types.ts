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
  sport_type: "run" | "bike";
  distance_km: number;
  moving_time_s: number | null;
  started_at: string;
  manual: boolean;
  source: "strava" | "manual";
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
