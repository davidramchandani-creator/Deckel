import { createClient } from "@/lib/supabase/server";
import type { Activity, Participation, Period } from "@/lib/types";
import { StatusSwitch } from "./status-switch";
import { ManualEntryForm } from "./manual-entry-form";

export const dynamic = "force-dynamic";

export default async function MeineAktivitaetenPage() {
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
    return <p className="text-sm text-ink-soft">Noch keine Gruppe.</p>;
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
    return <p className="text-sm text-ink-soft">Keine offene Periode.</p>;
  }

  const { data: participation } = await supabase
    .from("participations")
    .select("*")
    .eq("period_id", period.id)
    .eq("member_id", member.id)
    .maybeSingle<Participation>();

  const { data: activities } = await supabase
    .from("activities")
    .select("*")
    .eq("period_id", period.id)
    .eq("member_id", member.id)
    .order("started_at", { ascending: false })
    .returns<Activity[]>();

  const status = participation?.status ?? "active";

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xs uppercase tracking-wide text-ink-soft mb-2">Status</h2>
        <StatusSwitch periodId={period.id} status={status} />
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wide text-ink-soft mb-2">Strava</h2>
        {member.strava_athlete_id ? (
          <p className="text-sm">
            Verbunden (Athlet #{member.strava_athlete_id}). Neue Laeufe erscheinen
            automatisch, meist innert Minuten.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-ink-soft">
              Noch nicht verbunden. Ohne Strava kannst du km von Hand eintragen.
            </p>
            <a
              href="/api/strava/authorize"
              className="inline-block border border-ink bg-ink text-paper px-3 py-1.5 text-sm"
            >
              Mit Strava verbinden
            </a>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wide text-ink-soft mb-2">Von Hand eintragen</h2>
        <ManualEntryForm periodId={period.id} />
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wide text-ink-soft mb-2">
          Meine Aktivitaeten dieser Periode
        </h2>
        {!activities || activities.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Noch keine Aktivitaet in dieser Periode. Verbinde Strava oder trage km von Hand ein.
          </p>
        ) : (
          <ul className="text-sm divide-y divide-ink/10 border-y border-ink/10">
            {activities.map((a) => (
              <li key={a.id} className="py-1.5 flex">
                <span>
                  {a.sport_type === "run" ? "Lauf" : "Velo"}
                  {a.manual ? " (manuell)" : ""}
                </span>
                <span className="leader" />
                <span>{Number(a.distance_km).toFixed(1)} km</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
