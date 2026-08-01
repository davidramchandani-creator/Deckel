import type { NextRequest } from "next/server";

/**
 * Cron routes are publicly reachable URLs, so they must authenticate.
 * Vercel sends `Authorization: Bearer $CRON_SECRET` for configured cron
 * jobs; we accept that and nothing else.
 */
export function isAuthorizedCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
