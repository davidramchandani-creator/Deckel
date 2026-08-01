"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function setSettlementPaid(
  settlementId: string,
  paid: boolean
): Promise<{ status: "idle" | "error"; message?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_settlement_paid", {
    p_settlement_id: settlementId,
    p_paid: paid,
  });
  if (error) return { status: "error", message: error.message };
  revalidatePath("/archiv");
  return { status: "idle" };
}
