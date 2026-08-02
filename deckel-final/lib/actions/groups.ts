"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ACTIVE_GROUP_COOKIE } from "@/lib/active-group";
import { revalidatePath } from "next/cache";

async function makeActive(groupId: string) {
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

export type GroupActionState = { status: "idle" | "error"; message?: string };

/**
 * Creates a group and makes the caller its first admin, via the
 * create_group RPC (atomic, security definer -- see the Supabase schema).
 */
export async function createGroup(
  _prevState: GroupActionState,
  formData: FormData
): Promise<GroupActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const displayName = String(formData.get("display_name") ?? "").trim();
  if (!name) {
    return { status: "error", message: "Bitte einen Namen fuer die Gruppe eingeben." };
  }
  if (displayName.length < 2) {
    return { status: "error", message: "Bitte auch deinen eigenen Namen eintragen." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_group", {
    p_name: name,
    p_display_name: displayName,
  });

  if (error || !data || data.length === 0) {
    return { status: "error", message: error?.message ?? "Gruppe konnte nicht erstellt werden." };
  }

  // A freshly created group becomes the one you are looking at.
  await makeActive(data[0].group_id);
  redirect("/gruppe");
}

/**
 * Joins a group by invite code. The code is validated server-side inside
 * the join_group RPC -- there is no direct insert path into `members`.
 */
export async function joinGroup(
  _prevState: GroupActionState,
  formData: FormData
): Promise<GroupActionState> {
  const inviteCode = String(formData.get("invite_code") ?? "").trim();
  const displayName = String(formData.get("display_name") ?? "").trim();

  if (!inviteCode || !displayName) {
    return { status: "error", message: "Einladungscode und Name werden benoetigt." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("join_group", {
    p_invite_code: inviteCode,
    p_display_name: displayName,
  });

  if (!error) {
    const { data: joined } = await supabase
      .from("groups")
      .select("id")
      .eq("invite_code", inviteCode)
      .maybeSingle();
    if (joined?.id) await makeActive(joined.id);
  }

  if (error) {
    return {
      status: "error",
      message: error.message.includes("invalid invite code")
        ? "Ungueltiger Einladungscode."
        : error.message,
    };
  }

  redirect("/");
}
