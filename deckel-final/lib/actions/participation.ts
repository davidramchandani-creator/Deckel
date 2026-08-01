"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionState = { status: "idle" | "error"; message?: string };
const idle: ActionState = { status: "idle" };

export async function reportSick(periodId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("report_sick", { p_period_id: periodId });
  if (error) return { status: "error", message: error.message };
  revalidatePath("/");
  revalidatePath("/aktivitaeten");
  return idle;
}

export async function clearSick(periodId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("clear_sick", { p_period_id: periodId });
  if (error) return { status: "error", message: error.message };
  revalidatePath("/");
  revalidatePath("/aktivitaeten");
  return idle;
}

export async function withdraw(periodId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_from_period", { p_period_id: periodId });
  if (error) {
    return {
      status: "error",
      message: error.message.includes("only allowed before")
        ? "Abmeldung ist nur vor Periodenstart moeglich. Waehle stattdessen 'krank'."
        : error.message,
    };
  }
  revalidatePath("/");
  revalidatePath("/aktivitaeten");
  return idle;
}

export async function addManualActivity(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const periodId = String(formData.get("period_id") ?? "");
  const sportType = String(formData.get("sport_type") ?? "");
  const distanceKm = Number(formData.get("distance_km"));
  const startedAtRaw = String(formData.get("started_at") ?? "");

  if (!periodId || !["run", "bike"].includes(sportType) || !(distanceKm > 0) || !startedAtRaw) {
    return { status: "error", message: "Bitte alle Felder korrekt ausfuellen." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_manual_activity", {
    p_period_id: periodId,
    p_sport_type: sportType,
    p_distance_km: distanceKm,
    p_started_at: new Date(startedAtRaw).toISOString(),
  });

  if (error) return { status: "error", message: error.message };

  revalidatePath("/");
  revalidatePath("/aktivitaeten");
  return idle;
}
