import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { signOut } from "@/lib/actions/auth";

// Every page in this group depends on the caller's session and group
// membership -- never prerender it as static, static caching here would
// leak one user's view to everyone.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Early members got their email address as a display name. Nudge them to
  // pick a real one before it shows up on the leaderboard for everyone.
  const { data: member } = await supabase
    .from("members")
    .select("display_name")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (member?.display_name?.includes("@")) {
    redirect("/name");
  }

  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto w-full">
      <header className="border-b border-paper-edge px-4 py-3 flex items-center justify-between bg-paper-card">
        <Link href="/" className="text-sm font-medium tracking-tight">
          Pace or Pay
        </Link>
        <form action={signOut}>
          <button type="submit" className="btn btn-quiet text-xs">
            Abmelden
          </button>
        </form>
      </header>

      <main className="flex-1 px-4 py-4 pb-8">{children}</main>

      <nav
        className="border-t border-paper-edge grid grid-cols-4 text-center text-xs bg-paper-card sticky bottom-0"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <Link href="/" className="py-3 hover:bg-paper">
          Rangliste
        </Link>
        <Link href="/aktivitaeten" className="py-3 hover:bg-paper">
          Aktivitaeten
        </Link>
        <Link href="/gruppe" className="py-3 hover:bg-paper">
          Gruppe
        </Link>
        <Link href="/archiv" className="py-3 hover:bg-paper">
          Archiv
        </Link>
      </nav>
    </div>
  );
}
