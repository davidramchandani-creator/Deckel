"use client";

import { usePathname } from "next/navigation";

const titles: Record<string, string> = {
  "/": "Rangliste",
  "/aktivitaeten": "Meine Aktivität",
  "/gruppe": "Gruppe",
  "/archiv": "Archiv",
  "/gruppe/neu": "Neue Gruppe",
  "/gruppe/beitreten": "Beitreten",
};

/**
 * Header shows where you are, so the bottom bar is not the only signal.
 * Falls back to the app name on routes without an explicit title.
 */
export function PageTitle() {
  const pathname = usePathname();
  const title =
    titles[pathname] ??
    Object.entries(titles).find(([k]) => k !== "/" && pathname.startsWith(k))?.[1] ??
    "Pace or Pay";

  return <span className="text-sm font-medium tracking-tight">{title}</span>;
}
