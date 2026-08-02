import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const ACTIVE_GROUP_COOKIE = "pop-group";

export interface Membership {
  memberId: string;
  groupId: string;
  groupName: string;
  inviteCode: string;
  role: "member" | "admin";
  isActive: boolean;
}

interface GroupRow {
  id: string;
  name: string;
  invite_code: string;
}

/**
 * Every group the caller belongs to, with one marked active.
 *
 * The preferred group is remembered in a cookie, but it is never trusted
 * on its own: the value only takes effect if it appears in the caller's
 * actual memberships, which RLS already restricts. A forged cookie
 * therefore grants nothing -- it falls back to the first real membership.
 */
export async function getMemberships(): Promise<Membership[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("members")
    .select("id, group_id, role, groups(id, name, invite_code)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (!data || data.length === 0) return [];

  const cookieStore = await cookies();
  const preferred = cookieStore.get(ACTIVE_GROUP_COOKIE)?.value;
  const activeId = data.some((m) => m.group_id === preferred)
    ? preferred
    : data[0].group_id;

  return data.map((m) => {
    const g = (Array.isArray(m.groups) ? m.groups[0] : m.groups) as GroupRow | null;
    return {
      memberId: m.id,
      groupId: m.group_id,
      groupName: g?.name ?? "",
      inviteCode: g?.invite_code ?? "",
      role: m.role as "member" | "admin",
      isActive: m.group_id === activeId,
    };
  });
}

/** The membership the app should currently be showing, or null. */
export async function getActiveMembership(): Promise<Membership | null> {
  const all = await getMemberships();
  return all.find((m) => m.isActive) ?? null;
}
