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

  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto w-full">
      <header className="border-b border-ink/20 px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-sm tracking-tight">
          Deckel
        </Link>
        <form action={signOut}>
          <button type="submit" className="text-xs text-ink-soft hover:text-ink">
            Abmelden
          </button>
        </form>
      </header>

      <main className="flex-1 px-4 py-4">{children}</main>

      <nav className="border-t border-ink/20 grid grid-cols-4 text-center text-xs">
        <Link href="/" className="py-2.5 hover:bg-paper-dark/40">
          Rangliste
        </Link>
        <Link href="/aktivitaeten" className="py-2.5 hover:bg-paper-dark/40">
          Aktivitaeten
        </Link>
        <Link href="/gruppe" className="py-2.5 hover:bg-paper-dark/40">
          Gruppe
        </Link>
        <Link href="/archiv" className="py-2.5 hover:bg-paper-dark/40">
          Archiv
        </Link>
      </nav>
    </div>
  );
}
