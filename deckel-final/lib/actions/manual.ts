"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { sendPushToMembers } from "@/lib/push";

export type ManualState = { status: "idle" | "error" | "sent"; message?: string };

/**
 * Submits a manual entry. It lands as "pending" and needs a majority of
 * the other members to confirm it before it scores -- Strava entries are
 * trusted because a device recorded them, typed-in ones are vouched for
 * by the group instead.
 */
export async function submitManualActivity(
  _prev: ManualState,
  formData: FormData
): Promise<ManualState> {
  const periodId = String(formData.get("period_id") ?? "");
  const sportType = String(formData.get("sport_type") ?? "");
  const unit = String(formData.get("unit") ?? "km");
  const value = Number(formData.get("value"));
  const startedAt = String(formData.get("started_at") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!periodId || !sportType || !startedAt) {
    return { status: "error", message: "Bitte alle Felder ausfüllen." };
  }
  if (!Number.isFinite(value) || value <= 0) {
    return { status: "error", message: "Bitte einen Wert grösser als 0 eintragen." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_manual_activity", {
    p_period_id: periodId,
    p_sport_type: sportType,
    p_distance_km: unit === "km" ? value : 0,
    p_moving_time_min: unit === "min" ? Math.round(value) : 0,
    p_started_at: new Date(startedAt + "T12:00:00").toISOString(),
    p_note: note || null,
  });

  if (error) {
    const map: Record<string, string> = {
      "datum liegt ausserhalb der periode": "Das Datum liegt ausserhalb der laufenden Periode.",
      "datum liegt in der zukunft": "Das Datum liegt in der Zukunft.",
      "wert unplausibel hoch": "Der Wert ist unplausibel hoch.",
      "periode nicht offen": "Für diese Periode kann nichts mehr eingetragen werden.",
    };
    const key = Object.keys(map).find((k) => error.message.includes(k));
    return { status: "error", message: key ? map[key] : error.message };
  }

  // Tell the others there is something to confirm -- otherwise a pending
  // entry can sit unnoticed until the period ends.
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const admin = createAdminClient();
    const { data: me } = await admin
      .from("members")
      .select("id, group_id, display_name")
      .eq("user_id", user!.id)
      .maybeSingle();
    if (me) {
      const { data: others } = await admin
        .from("members")
        .select("id")
        .eq("group_id", me.group_id)
        .neq("id", me.id);
      if (others && others.length > 0) {
        await sendPushToMembers(
          others.map((o) => o.id),
          {
            title: "Eintrag zum Bestätigen",
            body: `${me.display_name} hat etwas von Hand eingetragen.`,
            url: "/aktivitaeten",
            tag: "approval",
          }
        );
      }
    }
  } catch {
    // Notification failure must never fail the entry itself.
  }

  revalidatePath("/");
  revalidatePath("/aktivitaeten");
  return { status: "sent" };
}

export async function voteActivity(
  activityId: string,
  approve: boolean
): Promise<ManualState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("vote_activity", {
    p_activity_id: activityId,
    p_approve: approve,
  });
  if (error) return { status: "error", message: error.message };

  revalidatePath("/");
  revalidatePath("/aktivitaeten");
  return { status: "idle" };
}

export async function withdrawManualActivity(activityId: string): Promise<ManualState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_manual_activity", {
    p_activity_id: activityId,
  });
  if (error) return { status: "error", message: error.message };

  revalidatePath("/");
  revalidatePath("/aktivitaeten");
  return { status: "idle" };
}
