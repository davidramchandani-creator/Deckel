import { createClient } from "@/lib/supabase/server";
import type { Activity, Participation, Period } from "@/lib/types";
import { StatusSwitch } from "./status-switch";
import { ManualEntryForm } from "./manual-entry-form";
import { DeleteActivity } from "./delete-activity";
import { Sheet, SectionLabel, Line, points } from "@/components/receipt";
import { totalPoints, type ActivityKind } from "@/lib/rules";

export const dynamic = "force-dynamic";

export default async function MeineAktivitaetenPage({
  searchParams,
}: {
  searchParams: Promise<{ strava?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: member } = await supabase
    .from("members")
    .select("id, group_id, strava_athlete_id")
    .eq("user_id", user!.id)
    .limit(1)
    .maybeSingle();

  if (!member) {
    return (
      <Sheet className="perforated-top">
        <p className="text-sm text-ink-soft">Du bist noch in keiner Gruppe.</p>
      </Sheet>
    );
  }

  const { data: period } = await supabase
    .from("periods")
    .select("*")
    .eq("group_id", member.group_id)
    .eq("status", "open")
    .order("starts_on", { ascending: false })
    .limit(1)
    .maybeSingle<Period>();

  if (!period) {
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

  const myPoints = totalPoints(
    (activities ?? []).map((a) => ({
      kind: a.sport_type as ActivityKind,
      distanceKm: Number(a.distance_km),
    })),
    snapshot.bike_factor
  );

  const runKm = (activities ?? [])
    .filter((a) => a.sport_type === "run")
    .reduce((s, a) => s + Number(a.distance_km), 0);
  const bikeKm = (activities ?? [])
    .filter((a) => a.sport_type === "bike")
    .reduce((s, a) => s + Number(a.distance_km), 0);

  return (
    <div className="space-y-5">
      {params.strava === "connected" && (
        <Sheet className="border-accent-soft">
          <p className="text-sm">
            Strava ist verbunden. Neue Läufe erscheinen ab jetzt automatisch.
          </p>
        </Sheet>
      )}
      {params.strava === "denied" && (
        <Sheet>
          <p className="text-sm text-accent">
            Du hast den Zugriff abgelehnt. Ohne Strava kannst du km von Hand
            eintragen.
          </p>
        </Sheet>
      )}

      <Sheet className="perforated-top">
        <SectionLabel>Deine Bilanz</SectionLabel>
        <Line emphasis left="Punkte" right={points(myPoints)} />
        <Line left="Laufen" right={`${runKm.toFixed(1)} km`} />
        <Line left="Velo" right={`${bikeKm.toFixed(1)} km`} />
      </Sheet>

      <Sheet>
        <SectionLabel>Bist du dabei?</SectionLabel>
        <StatusSwitch
          periodId={period.id}
          status={status}
          periodStarted={periodStarted}
        />
      </Sheet>

      <Sheet>
        <SectionLabel>Strava</SectionLabel>
        {member.strava_athlete_id ? (
          <p className="text-sm text-ink-soft">
            Verbunden. Läufe und Fahrten erscheinen automatisch, meist innert
            Minuten.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-ink-soft">
              Verbinde Strava, dann musst du nichts mehr von Hand eintragen.
            </p>
            <a href="/api/strava/authorize" className="btn btn-primary w-full">
              Mit Strava verbinden
            </a>
          </div>
        )}
      </Sheet>

      <Sheet>
        <SectionLabel>Von Hand eintragen</SectionLabel>
        <ManualEntryForm
          periodId={period.id}
          bikeFactor={snapshot.bike_factor}
          periodStart={period.starts_on}
        />
      </Sheet>

      <Sheet>
        <SectionLabel>Diese Periode</SectionLabel>
        {!activities || activities.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Noch nichts eingetragen. Verbinde Strava oder trag deine km von Hand
            ein.
          </p>
        ) : (
          <ul className="text-sm">
            {activities.map((a) => (
              <li key={a.id} className="rule-single first:border-t-0">
                <Line
                  left={
                    <span>
                      {a.sport_type === "run" ? "Lauf" : "Velo"}
                      {a.source === "manual" && (
                        <span className="text-ink-faint text-xs"> · von Hand</span>
                      )}
                    </span>
                  }
                  right={`${Number(a.distance_km).toFixed(1)} km`}
                  sub={
                    <span className="flex items-center gap-2">
                      <span className="text-ink-faint">
                        {new Date(a.started_at).toLocaleDateString("de-CH", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </span>
                      {a.source === "manual" && <DeleteActivity activityId={a.id} />}
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
