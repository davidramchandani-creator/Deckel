import { createAdminClient } from "@/lib/supabase/server-admin";
import { fetchActivity, getValidAccessToken, toActivityRow, tokenMemberForAthlete } from "@/lib/strava/client";
import { sportsFromSnapshot, handicapFromSnapshot, applyHandicap, SPORTS_CATALOG } from "@/lib/sports";
import { computeSettlement, type Participant } from "@/lib/rules";
import { totalPointsFor } from "@/lib/sports";
import { sendPushToMembers } from "@/lib/push";

/**
 * Finds the open period for a member's group that contains `startedAt`.
 * Activities outside any open period are stored with period_id = null so
 * they still exist for auditing but do not score.
 */
interface PeriodHit {
  id: string;
  snapshot: Record<string, unknown>;
}

async function findPeriodForActivity(
  admin: ReturnType<typeof createAdminClient>,
  groupId: string,
  startedAt: string
): Promise<PeriodHit | null> {
  const day = startedAt.slice(0, 10);
  const { data } = await admin
    .from("periods")
    .select("id, settings_snapshot")
    .eq("group_id", groupId)
    .lte("starts_on", day)
    .gte("ends_on", day)
    .limit(1)
    .maybeSingle();
  return data ? { id: data.id, snapshot: data.settings_snapshot } : null;
}

/**
 * Processes one queued webhook event.
 *
 * Idempotent by construction: activity upserts key on the unique
 * strava_activity_id, and the event row is stamped processed_at when
 * finished. Safe to call twice on the same event id.
 */
export async function processWebhookEvent(eventId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: event } = await admin
    .from("strava_webhook_events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();

  if (!event || event.processed_at) return;

  await admin
    .from("strava_webhook_events")
    .update({ attempts: (event.attempts ?? 0) + 1 })
    .eq("id", eventId);

  try {
    // Athlete deauthorised the app: drop their tokens. Their existing
    // activities stay -- the period they already ran in should not
    // silently re-score because they disconnected.
    if (event.object_type === "athlete") {
      if (event.updates?.authorized === "false") {
        const { data: member } = await admin
          .from("members")
          .select("id")
          .eq("strava_athlete_id", event.owner_id)
          .maybeSingle();
        if (member) {
          await admin.from("strava_tokens").delete().eq("member_id", member.id);
        }
        await admin
          .from("members")
          .update({ strava_athlete_id: null })
          .eq("strava_athlete_id", event.owner_id);
      }
      await admin
        .from("strava_webhook_events")
        .update({ processed_at: new Date().toISOString(), process_error: null })
        .eq("id", eventId);
      return;
    }

    if (event.object_type !== "activity") {
      await admin
        .from("strava_webhook_events")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", eventId);
      return;
    }

    // A delete event also arrives when an athlete flips an activity to
    // "Only You" under activity:read scope. Either way it must leave the
    // standings.
    if (event.aspect_type === "delete") {
      await admin.from("activities").delete().eq("strava_activity_id", event.object_id);
      await admin
        .from("strava_webhook_events")
        .update({ processed_at: new Date().toISOString(), process_error: null })
        .eq("id", eventId);
      return;
    }

    // One athlete, possibly several groups: the same run scores in every
    // group this person belongs to, each against that group's own period
    // and sports rules.
    const { data: athleteMembers } = await admin
      .from("members")
      .select("id, group_id, display_name")
      .eq("strava_athlete_id", event.owner_id);

    if (!athleteMembers || athleteMembers.length === 0) {
      await admin
        .from("strava_webhook_events")
        .update({
          processed_at: new Date().toISOString(),
          process_error: "no member for athlete",
        })
        .eq("id", eventId);
      return;
    }

    const tokenMemberId = await tokenMemberForAthlete(admin, event.owner_id);
    if (!tokenMemberId) {
      // Not transient: this athlete is marked as connected but has no
      // usable token, so retrying forever would only clog the queue. Mark
      // it handled with a clear reason -- my_strava_status() will show the
      // person a "reconnect" banner, and the nightly sync picks the
      // activity up once they do.
      await admin
        .from("strava_webhook_events")
        .update({
          processed_at: new Date().toISOString(),
          process_error: `kein Token fuer Athlet ${event.owner_id} -- neu verbinden noetig`,
        })
        .eq("id", eventId);
      return;
    }
    const accessToken = await getValidAccessToken(admin, tokenMemberId);
    const activity = await fetchActivity(accessToken, event.object_id);

    if (!activity) {
      // Gone from Strava's side -- remove every group's copy.
      await admin.from("activities").delete().eq("strava_activity_id", event.object_id);
      await admin
        .from("strava_webhook_events")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", eventId);
      return;
    }

    for (const member of athleteMembers) {
      const period = await findPeriodForActivity(admin, member.group_id, activity.start_date);
      const sports = sportsFromSnapshot(period?.snapshot ?? {});
      const periodId = period?.id ?? null;
      // Erst gegen die aktiven Sportarten der Gruppe, dann gegen den ganzen
      // Katalog.
      //
      // Der zweite Versuch ist der wichtige: eine Sportart, die gerade nicht
      // zaehlt, wurde frueher gar nicht erst gespeichert und war damit fuer
      // immer verloren. Schaltete der Admin sie spaeter frei, konnte sie nicht
      // mehr auftauchen -- genau so verschwand eine Tennis-Einheit spurlos.
      // Jetzt liegt sie in der Datenbank und zaehlt schlicht 0 Punkte,
      // solange die Regel sie nicht kennt.
      const row =
        toActivityRow(activity, member.id, periodId, sports) ??
        toActivityRow(activity, member.id, periodId, SPORTS_CATALOG);

      if (!row) {
        // Strava kennt die Sportart, unser Katalog nicht -- daraus koennte
        // nie eine Wertung werden. Alte Kopie fuer dieses Mitglied entfernen.
        await admin
          .from("activities")
          .delete()
          .eq("strava_activity_id", activity.id)
          .eq("member_id", member.id);
        continue;
      }

      const leaderBefore = periodId ? await currentLeader(admin, periodId) : null;
      await admin
        .from("activities")
        .upsert(row, { onConflict: "member_id,strava_activity_id" });

      if (periodId) {
        const leaderAfter = await currentLeader(admin, periodId);
        if (
          leaderAfter &&
          leaderAfter.memberId === member.id &&
          leaderBefore &&
          leaderBefore.memberId !== member.id
        ) {
          await sendPushToMembers([leaderBefore.memberId], {
            title: "Du wurdest überholt",
            body: `${member.display_name ?? "Jemand"} liegt jetzt vorne.`,
            url: "/",
            tag: "overtake",
          });
        }
      }
    }

    await admin
      .from("strava_webhook_events")
      .update({ processed_at: new Date().toISOString(), process_error: null })
      .eq("id", eventId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin
      .from("strava_webhook_events")
      .update({ process_error: message })
      .eq("id", eventId);
    throw err;
  }
}


/**
 * Who currently leads a period, by points. Withdrawn members are excluded,
 * mirroring the settlement rule.
 */
async function currentLeader(
  admin: ReturnType<typeof createAdminClient>,
  periodId: string
): Promise<{ memberId: string; points: number } | null> {
  const { data: period } = await admin
    .from("periods")
    .select("group_id, settings_snapshot")
    .eq("id", periodId)
    .maybeSingle();
  if (!period) return null;

  const snapshot = period.settings_snapshot as {
    bike_factor: number;
    cap_chf: number;
    period_days: number;
    sports?: Record<string, { rate: number; enabled: boolean }> | null;
    handicap?: { enabled: boolean; bracket: number; factors: number[] } | null;
  };
  const sports = sportsFromSnapshot(snapshot);
  const handicap = handicapFromSnapshot(snapshot);

  const { data: members } = await admin
    .from("members")
    .select("id")
    .eq("group_id", period.group_id);

  const { data: activities } = await admin
    .from("activities")
    .select("member_id, sport_type, distance_km, moving_time_s")
    .eq("period_id", periodId)
    .eq("status", "approved");

  const { data: participations } = await admin
    .from("participations")
    .select("member_id, status, sick_from_day")
    .eq("period_id", periodId);

  const byMember = new Map<
    string,
    { sportKey: string; distanceKm: number; movingTimeMin: number }[]
  >();
  for (const a of activities ?? []) {
    const list = byMember.get(a.member_id) ?? [];
    list.push({
      sportKey: a.sport_type,
      distanceKm: Number(a.distance_km),
      movingTimeMin: (a.moving_time_s ?? 0) / 60,
    });
    byMember.set(a.member_id, list);
  }

  const partByMember = new Map(
    (participations ?? []).map((p) => [
      p.member_id,
      { status: p.status as Participant["status"], sickFromDay: p.sick_from_day ?? undefined },
    ])
  );

  const participants: Participant[] = (members ?? []).map((m) => {
    const part = partByMember.get(m.id);
    return {
      memberId: m.id,
      points: applyHandicap(totalPointsFor(byMember.get(m.id) ?? [], sports), handicap),
      status: part?.status ?? "active",
      sickFromDay: part?.sickFromDay,
    };
  });

  const result = computeSettlement(participants, snapshot.cap_chf, snapshot.period_days);
  const leader = result.lines.find((l) => l.isRecordHolder && l.points > 0);
  return leader ? { memberId: leader.memberId, points: leader.points } : null;
}
