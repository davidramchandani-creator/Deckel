import { createClient } from "@/lib/supabase/server";
import type { Activity, Participation, Period } from "@/lib/types";
import { getActiveMembership } from "@/lib/active-group";
import { StatusSwitch } from "./status-switch";
import { ManualForm } from "./manual-form";
import { PendingVotes, type PendingItem } from "./pending-votes";
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

  const [
    { data: participation },
    { data: activities },
    { data: pendingRows },
    { count: memberCount },
  ] = await Promise.all([
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
      .returns<Activity[]>(), // includes pending/rejected so I can see my own
    supabase
      .from("activities")
      .select("*, members(display_name), activity_votes(member_id, approve)")
      .eq("period_id", period.id)
      .eq("status", "pending")
      .order("started_at", { ascending: false }),
    supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("group_id", active.groupId),
  ]);

  const status = participation?.status ?? "active";
  const snapshot = period.settings_snapshot;
  const periodStarted = new Date(period.starts_on) <= new Date();
  const sports = sportsFromSnapshot(snapshot);

  // Only confirmed entries count toward the balance shown here.
  const scorables = (activities ?? [])
    .filter((a) => (a as Activity & { status?: string }).status !== "pending" &&
                   (a as Activity & { status?: string }).status !== "rejected")
    .map((a) => ({
    sportKey: a.sport_type,
    distanceKm: Number(a.distance_km),
    movingTimeMin: (a.moving_time_s ?? 0) / 60,
  }));
  const myPoints = totalPointsFor(scorables, sports);

  const others = Math.max(0, (memberCount ?? 1) - 1);
  const pendingItems: PendingItem[] = (
    (pendingRows ?? []) as unknown as (Activity & {
      note: string | null;
      members: { display_name: string } | { display_name: string }[] | null;
      activity_votes: { member_id: string; approve: boolean }[];
    })[]
  ).map((row) => {
    const rel = Array.isArray(row.members) ? row.members[0] : row.members;
    const votes = row.activity_votes ?? [];
    const isMine = row.member_id === member.id;
    // The owner never counts as a voter, so the bar is over the others.
    const ownerExcluded = Math.max(0, (memberCount ?? 1) - 1);
    return {
      id: row.id,
      displayName: rel?.display_name ?? "?",
      sportLabel: sportByKey(row.sport_type, sports)?.label ?? row.sport_type,
      amount: formatAmount(
        {
          sportKey: row.sport_type,
          distanceKm: Number(row.distance_km),
          movingTimeMin: (row.moving_time_s ?? 0) / 60,
        },
        sports
      ),
      note: row.note,
      startedAt: row.started_at,
      isMine,
      myVote: votes.find((v) => v.member_id === member.id)?.approve ?? null,
      approvals: votes.filter((v) => v.approve).length,
      rejections: votes.filter((v) => !v.approve).length,
      needed: Math.max(1, Math.ceil(ownerExcluded / 2)),
    };
  });

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
      {params.strava === "token_failed" && (
        <Sheet className="border-accent-soft">
          <p className="text-sm text-accent leading-relaxed">
            Die Verbindung zu Strava konnte nicht gespeichert werden. Bitte
            nochmal auf &bdquo;Mit Strava verbinden&ldquo; tippen — wenn es wieder nicht
            klappt, sag Dave Bescheid.
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
          <SectionLabel>Strava neu verbinden</SectionLabel>
          <p className="text-sm text-ink-soft mb-2 leading-relaxed">
            Deine Strava-Verbindung ist nicht mehr gültig — entweder wurde der
            Zugriff in Strava widerrufen, das Passwort geändert, oder die
            Verbindung wurde damals nicht sauber gespeichert. Seither zählen
            deine Aktivitäten nicht. Einmal neu verbinden genügt, danach wird
            auch Vergangenes der laufenden Periode nachgeholt.
          </p>
          <a href="/api/strava/authorize" className="btn btn-primary w-full">
            Neu verbinden
          </a>
        </Sheet>
      )}

      <Sheet>
        <SectionLabel>Strava</SectionLabel>
        {/* Absichtlich am Token festgemacht, nicht an der Athleten-ID: eine
            gesetzte ID ohne Token bedeutet, dass nichts importiert werden
            kann -- die App darf dann nicht "verbunden" behaupten. */}
        {stravaStatus === "connected" ? (
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

      {pendingItems.length > 0 && (
        <Sheet>
          <SectionLabel>
            Wartet auf Bestätigung ({pendingItems.length})
          </SectionLabel>
          <p className="text-xs text-ink-soft mb-3 leading-relaxed">
            Manuelle Einträge zählen erst, wenn die Mehrheit der anderen sie
            bestätigt hat.
          </p>
          <PendingVotes items={pendingItems} />
        </Sheet>
      )}

      <Sheet>
        <SectionLabel>Von Hand eintragen</SectionLabel>
        <p className="text-xs text-ink-soft mb-3 leading-relaxed">
          Für Sport ohne Strava — vergessene Uhr, Hallentraining, kaputter
          Akku.
        </p>
        <ManualForm
          periodId={period.id}
          sports={sports}
          periodStart={period.starts_on}
          needsApproval={others > 0}
        />
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
                      {a.source === "manual" && " · von Hand"}
                      {(a as Activity & { status?: string }).status === "pending" &&
                        " · wartet auf Bestätigung"}
                      {(a as Activity & { status?: string }).status === "rejected" &&
                        " · abgelehnt, zählt nicht"}
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
