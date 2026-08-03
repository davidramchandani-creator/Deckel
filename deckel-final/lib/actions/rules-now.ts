"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type RulesNowState = { status: "idle" | "error" | "done"; message?: string };

/**
 * Pushes the saved rules onto the RUNNING period instead of waiting for
 * the boundary. Deliberately a separate, admin-only action with its own
 * confirmation -- it rewrites the current standings, which is exactly the
 * thing the freeze normally prevents.
 */
export async function applyRulesNow(
  _prev: RulesNowState,
  formData: FormData
): Promise<RulesNowState> {
  const groupId = String(formData.get("group_id") ?? "");
  const supabase = await createClient();

  const { error } = await supabase.rpc("apply_rules_now", { p_group_id: groupId });
  if (error) {
    return {
      status: "error",
      message: error.message.includes("nur admins")
        ? "Nur Admins können das."
        : error.message.includes("keine offene periode")
          ? "Es läuft gerade keine Periode."
          : error.message,
    };
  }

  revalidatePath("/", "layout");
  return { status: "done" };
}
