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
  const bikeFactor = Number(formData.get("bike_factor"));
  const capChf = Number(formData.get("cap_chf"));

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_group_rules", {
    p_group_id: groupId,
    p_period_days: periodDays,
    p_bike_factor: bikeFactor,
    p_cap_chf: capChf,
  });
  if (error) return { status: "error", message: error.message };

  revalidatePath("/gruppe");
  revalidatePath("/");
  return { status: "idle" };
}
