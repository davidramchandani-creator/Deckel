import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NameForm } from "./name-form";

export const dynamic = "force-dynamic";

/**
 * Deliberately outside the (app) route group: that layout redirects here
 * when a display name still looks like an email address, and nesting this
 * page inside it would redirect to itself forever.
 */
export default async function NamePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("members")
    .select("display_name")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!member) redirect("/gruppe");

  return (
    <main className="flex-1 px-4 py-6 max-w-md mx-auto w-full">
      <NameForm current={member.display_name?.includes("@") ? "" : member.display_name} />
    </main>
  );
}
