"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Bottom navigation.
 *
 * Three things the first version got wrong: it gave no indication of where
 * you were, the targets were far below Apple's 44px minimum, and it sat
 * flush against the home indicator on newer iPhones.
 *
 * Icons are drawn inline rather than pulled from a set -- four small marks
 * that match the receipt language (a ruled list, a route, two figures, a
 * filed stack) keep the app feeling like one thing.
 */

const items = [
  { href: "/", label: "Rangliste", exact: true },
  { href: "/aktivitaeten", label: "Aktivität", exact: false },
  { href: "/gruppe", label: "Gruppe", exact: false },
  { href: "/archiv", label: "Archiv", exact: false },
] as const;

function Icon({ name, active }: { name: string; active: boolean }) {
  const stroke = active ? 1.9 : 1.5;
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "/":
      // ruled bill: lines with amounts on the right
      return (
        <svg {...common}>
          <path d="M5 5h9M5 10h9M5 15h9" />
          <path d="M18 5h1M18 10h1M18 15h1" />
          <path d="M4 19.5h16" />
        </svg>
      );
    case "/aktivitaeten":
      // a route with a start and end point
      return (
        <svg {...common}>
          <circle cx="6" cy="18" r="2" />
          <circle cx="18" cy="6" r="2" />
          <path d="M7.5 16.5C10 14 11 12.5 12 11c1.5-2.2 2.5-3 4-3.5" />
        </svg>
      );
    case "/gruppe":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
          <path d="M16 5.5a3 3 0 0 1 0 5" />
          <path d="M17.5 14.2A5.5 5.5 0 0 1 20.5 19" />
        </svg>
      );
    default:
      // filed away: a stack with a lid
      return (
        <svg {...common}>
          <path d="M4 8h16v11H4z" />
          <path d="M3 5h18v3H3z" />
          <path d="M10 12h4" />
        </svg>
      );
  }
}

export function BottomNav() {
  const pathname = usePathname();

  /*
   * Server-rendered pages can take a moment. Without feedback a tap looks
   * like nothing happened, so the tapped item is marked immediately and
   * stays marked until the route actually changes. This is optimistic on
   * purpose -- the visual response must not wait on the network.
   */
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    setPending(null);
  }, [pathname]);

  return (
    <nav
      aria-label="Hauptnavigation"
      className="sticky bottom-0 z-20 bg-paper-card/95 backdrop-blur-sm border-t border-paper-edge"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-4">
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const isPending = pending === item.href && !active;

          return (
            <li key={item.href} className="relative">
              {/* Position marker: a short rule above the active tab, like a
                  tick against a line item. */}
              <span
                aria-hidden="true"
                className={`absolute left-1/2 -translate-x-1/2 top-0 h-[2px] bg-ink rounded-full transition-all duration-200 ease-out ${
                  active || isPending ? "w-8 opacity-100" : "w-0 opacity-0"
                } ${isPending ? "animate-pulse" : ""}`}
              />
              <Link
                href={item.href}
                prefetch
                onClick={() => setPending(item.href)}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-1 min-h-[58px] px-1 pt-2.5 pb-2
                  transition-all duration-150 ease-out active:scale-[0.93]
                  ${active || isPending ? "text-ink" : "text-ink-faint hover:text-ink-soft"}`}
              >
                <span className={active || isPending ? "icon-pop" : ""}>
                  <Icon name={item.href} active={active || isPending} />
                </span>
                <span
                  className={`text-[11px] leading-none transition-all duration-150 ${
                    active || isPending ? "font-medium" : ""
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
