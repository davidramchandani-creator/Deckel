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
