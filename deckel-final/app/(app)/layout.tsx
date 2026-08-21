import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/actions/auth";
import { BottomNav } from "@/components/nav";
import { PageTitle } from "@/components/header";
import { PullToRefresh } from "@/components/pull-to-refresh";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
      <header
        className="sticky top-0 z-20 bg-paper-card/95 backdrop-blur-sm border-b border-paper-edge px-4 py-3 flex items-center justify-between"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <PageTitle />
        <div className="flex items-center gap-1">
          {/* Die Regeln muessen von ueberall erreichbar sein, ohne einen
              fuenften Platz in der Navigation zu belegen. */}
          <Link
            href="/info"
            aria-label="So funktioniert's"
            title="So funktioniert's"
            className="btn btn-quiet text-xs w-8 h-8 p-0 flex items-center justify-center"
          >
            <svg
              width={17}
              height={17}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 16v-4.5" />
              <path d="M12 8.2h.01" />
            </svg>
          </Link>
          <form action={signOut}>
            <button type="submit" className="btn btn-quiet text-xs">
              Abmelden
            </button>
          </form>
        </div>
      </header>

      <main key="content" className="flex-1 px-4 py-4 pb-6">
        <PullToRefresh>
          <div className="page-enter">{children}</div>
        </PullToRefresh>
      </main>

      <BottomNav />
    </div>
  );
}
