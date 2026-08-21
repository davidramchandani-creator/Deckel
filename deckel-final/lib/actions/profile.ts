"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type ProfileState = { status: "idle" | "error"; message?: string };

export async function setDisplayName(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const name = String(formData.get("display_name") ?? "").trim();
  if (name.length < 2) {
    return { status: "error", message: "Bitte einen Namen mit mindestens 2 Zeichen." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_display_name", { p_display_name: name });
  if (error) return { status: "error", message: error.message };

  revalidatePath("/", "layout");
  redirect("/");
}

export async function updateGroupRules(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const groupId = String(formData.get("group_id") ?? "");
  const periodDays = Number(formData.get("period_days"));
  const capChf = Number(formData.get("cap_chf"));

  // Collect the sports form fields (sport_<key>_enabled / sport_<key>_rate)
  // into the JSON shape the RPC validates. Only known catalog keys are
  // forwarded -- anything else in the form data is ignored.
  const { SPORTS_CATALOG } = await import("@/lib/sports");
  const sports: Record<string, { rate: number; enabled: boolean }> = {};
  let enabledCount = 0;
  for (const def of SPORTS_CATALOG) {
    const enabled = formData.get(`sport_${def.key}_enabled`) === "on";
    const rate = Number(formData.get(`sport_${def.key}_rate`) ?? def.rate);
    if (!Number.isFinite(rate) || rate < 0.01 || rate > 10) {
      return {
        status: "error",
        message: `Punkte für ${def.label} müssen zwischen 0.01 und 10 liegen.`,
      };
    }
    sports[def.key] = { rate, enabled };
    if (enabled) enabledCount++;
  }
  if (enabledCount === 0) {
    return { status: "error", message: "Mindestens eine Sportart muss aktiv sein." };
  }

  // Staffelung
  const { HANDICAP_PRESETS, DEFAULT_HANDICAP } = await import("@/lib/sports");
  const handicapOn = formData.get("handicap_enabled") === "on";
  const preset = String(formData.get("handicap_preset") ?? "moderat");
  const bracket = Number(formData.get("handicap_bracket") ?? DEFAULT_HANDICAP.bracket);

  if (handicapOn && (!Number.isFinite(bracket) || bracket < 1 || bracket > 200)) {
    return { status: "error", message: "Stufengrösse muss zwischen 1 und 200 liegen." };
  }

  const handicap = {
    enabled: handicapOn,
    bracket: handicapOn ? bracket : DEFAULT_HANDICAP.bracket,
    factors: HANDICAP_PRESETS[preset] ?? HANDICAP_PRESETS.moderat,
  };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_group_rules_v3", {
    p_group_id: groupId,
    p_period_days: periodDays,
    p_cap_chf: capChf,
    p_sports: sports,
    p_handicap: handicap,
  });
  if (error) return { status: "error", message: error.message };

  revalidatePath("/gruppe");
  revalidatePath("/");
  return { status: "idle" };
}

/**
 * Ferien, Krankheit oder Ausstieg fuer die laufende Periode melden.
 *
 * "sick" deckelt die eigene Schuld anteilig ab dem Meldetag, "withdrawn"
 * setzt sie auf null und nimmt einen aus der Rekordwertung. Der Meldetag
 * wird serverseitig bestimmt -- nicht vom Client -- damit niemand sich
 * nachtraeglich einen frueheren Tag eintragen kann.
 */
export async function setParticipation(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const groupId = String(formData.get("group_id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!["active", "sick", "withdrawn"].includes(status)) {
    return { status: "error", message: "Unbekannter Status." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_participation", {
    p_group_id: groupId,
    p_status: status,
  });
  if (error) return { status: "error", message: error.message };

  revalidatePath("/gruppe");
  revalidatePath("/");
  return { status: "idle" };
}

/**
 * Ruhepuls/Maximalpuls hinterlegen -- gilt gruppenuebergreifend fuer die
 * Person, nicht nur fuer eine Mitgliedschaft (genau wie set_display_name).
 * Ohne diese Werte laeuft der Anstrengungsfaktor bei Kraft/Zeit-Sportarten
 * auf festen bpm-Schwellen statt relativ zur eigenen Herzfrequenzreserve.
 * Beide Felder sind optional -- leer lassen setzt sie auf "kein Wert".
 */
export async function setHeartRateProfile(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const restingRaw = String(formData.get("resting_hr") ?? "").trim();
  const maxRaw = String(formData.get("max_hr") ?? "").trim();

  const restingHr = restingRaw === "" ? null : Number(restingRaw);
  const maxHr = maxRaw === "" ? null : Number(maxRaw);

  if (restingHr != null && (!Number.isFinite(restingHr) || restingHr < 25 || restingHr > 120)) {
    return { status: "error", message: "Ruhepuls muss zwischen 25 und 120 liegen." };
  }
  if (maxHr != null && (!Number.isFinite(maxHr) || maxHr < 100 || maxHr > 230)) {
    return { status: "error", message: "Maximalpuls muss zwischen 100 und 230 liegen." };
  }
  if (restingHr != null && maxHr != null && maxHr <= restingHr) {
    return { status: "error", message: "Maximalpuls muss grösser als Ruhepuls sein." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_heart_rate_profile", {
    p_resting_hr: restingHr,
    p_max_hr: maxHr,
  });
  if (error) return { status: "error", message: error.message };

  revalidatePath("/gruppe");
  revalidatePath("/");
  return { status: "idle" };
}
