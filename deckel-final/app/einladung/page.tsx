import { createClient } from "@/lib/supabase/server";
import { Sheet } from "@/components/receipt";
import { InviteCta } from "./invite-cta";

export const dynamic = "force-dynamic";

/**
 * Public invite landing page -- deliberately OUTSIDE the (app) group.
 *
 * The old invite link pointed at the join form, which sits behind the
 * login wall: a logged-out invitee got bounced to /login and the code was
 * lost. This page needs no login, explains what they're being invited to,
 * and carries the code through the login flow via a cookie.
 */
export default async function EinladungPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const supabase = await createClient();

  let info: { group_name: string; member_count: number; admin_name: string } | null =
    null;
  if (code) {
    const { data } = await supabase.rpc("get_invite_info", { p_invite_code: code });
    info = data?.[0] ?? null;
  }

  return (
    <main className="flex-1 flex items-center justify-center p-5">
      <div className="w-full max-w-sm space-y-4">
        <Sheet className="perforated-top space-y-4">
          {info ? (
            <>
              <div>
                <p className="label mb-2">Einladung</p>
                <h1 className="text-xl font-medium leading-snug mb-2">
                  {info.admin_name} lädt dich zu «{info.group_name}» ein
                </h1>
                <p className="text-sm text-ink-soft leading-relaxed">
                  Pace or Pay ist eine Sport-Challenge unter Kolleg:innen: Ihr
                  sammelt Punkte über Strava — Laufen, Velo, je nach
                  Gruppenregeln auch mehr. Wer hinter der Spitze liegt, zahlt
                  anteilig in einen Topf. Und der Topf bezahlt am Ende euer
                  gemeinsames Essen.
                </p>
              </div>

              <ul className="text-sm text-ink-soft space-y-1.5">
                <li className="flex items-baseline">
                  <span>Mitglieder</span>
                  <span className="leader" aria-hidden="true" />
                  <span className="num text-ink">{info.member_count}</span>
                </li>
                <li className="flex items-baseline">
                  <span>Kosten</span>
                  <span className="leader" aria-hidden="true" />
                  <span className="text-ink">nur wenn du zurückliegst</span>
                </li>
                <li className="flex items-baseline">
                  <span>Du brauchst</span>
                  <span className="leader" aria-hidden="true" />
                  <span className="text-ink">E-Mail + Strava</span>
                </li>
              </ul>

              <InviteCta code={code!} />

              <p className="text-xs text-ink-faint leading-relaxed">
                Kein Passwort nötig — du bekommst einen Code per E-Mail. Deine
                Strava-Daten sieht nur deine Gruppe, und nur Distanz und Dauer.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-lg font-medium mb-1">Einladung nicht gefunden</h1>
              <p className="text-sm text-ink-soft leading-relaxed">
                Dieser Einladungslink ist unvollständig oder der Code stimmt
                nicht. Frag die Person, die dich eingeladen hat, nach einem
                neuen Link.
              </p>
            </>
          )}
        </Sheet>
      </div>
    </main>
  );
}
