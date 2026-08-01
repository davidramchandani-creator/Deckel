import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyActivity } from "@/lib/rules";

/**
 * Strava API helpers.
 *
 * Docs verified against https://developers.strava.com/docs/authentication/
 * and /docs/webhooks/ at build time.
 *
 * Everything here is server-only -- it needs STRAVA_CLIENT_SECRET and it
 * reads/writes the strava_tokens table, which is service-role only.
 */

const STRAVA_OAUTH_TOKEN_URL = "https://www.strava.com/api/v3/oauth/token";
const STRAVA_AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_API_BASE = "https://www.strava.com/api/v3";

/**
 * `activity:read_all` rather than `activity:read`.
 *
 * With plain `activity:read`, Strava treats any activity the athlete marks
 * "Only You" as a *delete* -- it would silently vanish from the standings
 * and the group would be left arguing about a run that clearly happened.
 * Since the whole point of joining is to have your kilometres counted,
 * read_all is the honest scope. Athletes still see exactly what they are
 * granting on Strava's consent screen and can revoke at any time.
 */
export const STRAVA_SCOPE = "read,activity:read_all";

export interface StravaTokens {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scope: string | null;
}

export function buildAuthorizeUrl(state: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    redirect_uri: `${appUrl}/api/strava/callback`,
    response_type: "code",
    approval_prompt: "auto",
    scope: STRAVA_SCOPE,
    state,
  });
  return `${STRAVA_AUTHORIZE_URL}?${params.toString()}`;
}

export interface TokenExchangeResult {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope?: string;
  athlete?: { id: number };
}

/** Exchange the one-time OAuth code for tokens. Server-side only. */
export async function exchangeCodeForTokens(code: string): Promise<TokenExchangeResult> {
  const res = await fetch(STRAVA_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    throw new Error(`Strava token exchange failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Returns a valid access token for a member, refreshing it first if it is
 * expired or close to it.
 *
 * Strava rotates refresh tokens: every refresh may return a NEW refresh
 * token and immediately invalidates the old one. Persisting the returned
 * refresh_token is mandatory, not optional -- miss it once and that
 * athlete is permanently disconnected.
 */
export async function getValidAccessToken(
  admin: SupabaseClient,
  memberId: string
): Promise<string> {
  const { data: tokens, error } = await admin
    .from("strava_tokens")
    .select("*")
    .eq("member_id", memberId)
    .maybeSingle<StravaTokens>();

  if (error || !tokens) {
    throw new Error(`No Strava tokens for member ${memberId}`);
  }

  // Refresh if it expires within the next 10 minutes.
  const expiresAt = new Date(tokens.expires_at).getTime();
  if (expiresAt - Date.now() > 10 * 60 * 1000) {
    return tokens.access_token;
  }

  const res = await fetch(STRAVA_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
    }),
  });

  if (!res.ok) {
    throw new Error(`Strava token refresh failed: ${res.status} ${await res.text()}`);
  }

  const refreshed: TokenExchangeResult = await res.json();

  await admin
    .from("strava_tokens")
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: new Date(refreshed.expires_at * 1000).toISOString(),
    })
    .eq("member_id", memberId);

  return refreshed.access_token;
}

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  distance: number; // metres
  moving_time: number; // seconds
  start_date: string;
  manual: boolean;
}

export async function fetchActivity(
  accessToken: string,
  activityId: number
): Promise<StravaActivity | null> {
  const res = await fetch(`${STRAVA_API_BASE}/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Strava fetchActivity ${activityId} failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchAthleteActivities(
  accessToken: string,
  afterEpochSeconds: number,
  beforeEpochSeconds: number
): Promise<StravaActivity[]> {
  const params = new URLSearchParams({
    after: String(afterEpochSeconds),
    before: String(beforeEpochSeconds),
    per_page: "100",
  });
  const res = await fetch(`${STRAVA_API_BASE}/athlete/activities?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Strava fetchAthleteActivities failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Maps a Strava activity onto our activities row shape, or null if it is
 * a sport we do not score (swim, walk, workout, ...).
 *
 * Strava's newer `sport_type` is preferred over the legacy `type`, since
 * `type` collapses GravelRide/MountainBikeRide into plain "Ride".
 */
export function toActivityRow(
  activity: StravaActivity,
  memberId: string,
  periodId: string | null
) {
  const kind = classifyActivity(activity.sport_type ?? activity.type);
  if (!kind) return null;

  return {
    member_id: memberId,
    period_id: periodId,
    strava_activity_id: activity.id,
    sport_type: kind,
    distance_km: Math.round((activity.distance / 1000) * 1000) / 1000,
    moving_time_s: activity.moving_time,
    started_at: activity.start_date,
    manual: activity.manual ?? false,
    source: "strava" as const,
    raw: activity as unknown as Record<string, unknown>,
  };
}
