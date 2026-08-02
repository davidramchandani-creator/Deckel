import { createClient } from "@/lib/supabase/server";
import type { Activity, Participation, Period } from "@/lib/types";
import { getActiveMembership } from "@/lib/active-group";
import { StatusSwitch } from "./status-switch";
import { Sheet, SectionLabel, Line, points } from "@/components/receipt";
import { sportsFromSnapshot, totalPointsFor, sportByKey, formatAmount } from "@/lib/sports";

export const dynamic = "force-dynamic";

export default async function MeineAktivitaetenPage({
  searchParams,
}: {
  searchParams: Promise<{ strava?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const active = await getActiveMembership();
  if (!active) {
    return (
      <Sheet className="perforated-top">
        <p className="text-sm text-ink-soft">Du bist noch in keiner Gruppe.</p>
      </Sheet>
    );
  }

  const [{ data: member }, { data: stravaStatus }] = await Promise.all([
    supabase
      .from("members")
      .select("id, group_id, strava_athlete_id")
      .eq("id", active.memberId)
      .maybeSingle(),
    supabase.rpc("my_strava_status"),
  ]);

  const { data: period } = await supabase
    .from("periods")
    .select("*")
    .eq("group_id", active.groupId)
    .eq("status", "open")
    .order("starts_on", { ascending: false })
    .limit(1)
    .maybeSingle<Period>();

  if (!member || !period) {
    return (
      <Sheet className="perforated-top">
        <p className="text-sm text-ink-soft">Gerade läuft keine Periode.</p>
      </Sheet>
    );
  }

  const [{ data: participation }, { data: activities }] = await Promise.all([
    supabase
      .from("participations")
      .select("*")
      .eq("period_id", period.id)
      .eq("member_id", member.id)
      .maybeSingle<Participation>(),
    supabase
      .from("activities")
      .select("*")
      .eq("period_id", period.id)
      .eq("member_id", member.id)
      .order("started_at", { ascending: false })
      .returns<Activity[]>(),
  ]);

  const status = participation?.status ?? "active";
  const snapshot = period.settings_snapshot;
  const periodStarted = new Date(period.starts_on) <= new Date();
  const sports = sportsFromSnapshot(snapshot);

  const scorables = (activities ?? []).map((a) => ({
    sportKey: a.sport_type,
    distanceKm: Number(a.distance_km),
    movingTimeMin: (a.moving_time_s ?? 0) / 60,
  }));
  const myPoints = totalPointsFor(scorables, sports);

  // Per-sport totals for the balance card, only sports with activity.
  const perSport = sports
    .map((sp) => {
      const mine = scorables.filter((a) => a.sportKey === sp.key);
      if (mine.length === 0) return null;
      const km = mine.reduce((s, a) => s + a.distanceKm, 0);
      const min = mine.reduce((s, a) => s + a.movingTimeMin, 0);
      return {
        label: sp.label,
        amount: sp.unit === "km" ? `${km.toFixed(1)} km` : `${Math.round(min)} min`,
      };
    })
    .filter((x): x is { label: string; amount: string } => x !== null);

  return (
    <div className="space-y-5">
      {params.strava === "connected" && (
        <Sheet>
          <p className="text-sm">
            Strava ist verbunden. Neue Läufe erscheinen ab jetzt automatisch.
          </p>
        </Sheet>
      )}
      {params.strava === "denied" && (
        <Sheet>
          <p className="text-sm text-accent">
            Du hast den Zugriff abgelehnt. Ohne Strava zählen deine Kilometer
            nicht mit.
          </p>
        </Sheet>
      )}

      <Sheet className="perforated-top">
        <SectionLabel>Deine Bilanz · {active.groupName}</SectionLabel>
        <Line emphasis left="Punkte" right={points(myPoints)} />
        {perSport.map((row) => (
          <Line key={row.label} left={row.label} right={row.amount} />
        ))}
        {perSport.length === 0 && (
          <p className="text-xs text-ink-soft">Noch keine Aktivität in dieser Periode.</p>
        )}
      </Sheet>

      <Sheet>
        <SectionLabel>Bist du dabei?</SectionLabel>
        <StatusSwitch
          periodId={period.id}
          status={status}
          periodStarted={periodStarted}
        />
      </Sheet>

      {stravaStatus === "revoked" && (
        <Sheet className="border-accent-soft">
          <SectionLabel>Strava-Verbindung unterbrochen</SectionLabel>
          <p className="text-sm text-ink-soft mb-2 leading-relaxed">
            Strava akzeptiert den Zugriff nicht mehr — das passiert nach einer
            Passwortänderung oder wenn der Zugriff in Strava widerrufen wurde.
            Seither zählen deine Aktivitäten nicht. Einmal neu verbinden
            genügt.
          </p>
          <a href="/api/strava/authorize" className="btn btn-primary w-full">
            Neu verbinden
          </a>
        </Sheet>
      )}

      <Sheet>
        <SectionLabel>Strava</SectionLabel>
        {member.strava_athlete_id ? (
          <p className="text-sm text-ink-soft leading-relaxed">
            Verbunden. Läufe und Fahrten erscheinen automatisch, meist innert
            Minuten. Löschst du eine Aktivität in Strava, verschwindet sie auch
            hier.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-ink-soft leading-relaxed">
              Ohne Strava zählen deine Kilometer nicht. Alle Aktivitäten kommen
              direkt von dort — von Hand eintragen ist bewusst nicht möglich,
              damit die Rangliste für alle auf derselben Grundlage steht.
            </p>
            <a href="/api/strava/authorize" className="btn btn-primary w-full">
              Mit Strava verbinden
            </a>
          </div>
        )}
      </Sheet>

      <Sheet>
        <SectionLabel>Diese Periode</SectionLabel>
        {!activities || activities.length === 0 ? (
          <p className="text-sm text-ink-soft leading-relaxed">
            Noch nichts eingetragen. Sobald du mit Strava läufst oder Velo
            fährst, erscheint es hier automatisch.
          </p>
        ) : (
          <ul className="text-sm">
            {activities.map((a) => (
              <li key={a.id} className="rule-single first:border-t-0">
                <Line
                  left={sportByKey(a.sport_type, sports)?.label ?? a.sport_type}
                  right={formatAmount(
                    {
                      sportKey: a.sport_type,
                      distanceKm: Number(a.distance_km),
                      movingTimeMin: (a.moving_time_s ?? 0) / 60,
                    },
                    sports
                  )}
                  sub={
                    <span className="text-ink-faint">
                      {new Date(a.started_at).toLocaleDateString("de-CH", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                      {a.source === "manual" && " · Altbestand, von Hand"}
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </div>
  );
}
