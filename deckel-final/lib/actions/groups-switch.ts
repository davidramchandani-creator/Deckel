"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_GROUP_COOKIE } from "@/lib/active-group";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/** Switches which group the app shows. Verifies membership first. */
export async function switchGroup(groupId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", user.id)
    .eq("group_id", groupId)
    .maybeSingle();

  if (!member) return; // not a member -- ignore silently

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_GROUP_COOKIE, groupId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
}

export type LeaveState = { status: "idle" | "error"; message?: string };

export async function leaveGroup(
  _prev: LeaveState,
  formData: FormData
): Promise<LeaveState> {
  const groupId = String(formData.get("group_id") ?? "");
  const supabase = await createClient();

  const { error } = await supabase.rpc("leave_group", { p_group_id: groupId });
  if (error) {
    return {
      status: "error",
      message: error.message.includes("letzter admin")
        ? "Du bist der letzte Admin. Mach zuerst jemand anderen zum Admin."
        : error.message,
    };
  }

  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_GROUP_COOKIE);
  revalidatePath("/", "layout");
  redirect("/gruppe");
}

export async function promoteToAdmin(memberId: string): Promise<LeaveState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("promote_to_admin", { p_member_id: memberId });
  if (error) return { status: "error", message: error.message };
  revalidatePath("/gruppe");
  return { status: "idle" };
}
