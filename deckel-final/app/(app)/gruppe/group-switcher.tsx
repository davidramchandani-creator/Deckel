"use client";

import { useTransition } from "react";
import Link from "next/link";
import { switchGroup } from "@/lib/actions/groups-switch";
import type { Membership } from "@/lib/active-group";

export function GroupSwitcher({ memberships }: { memberships: Membership[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <ul className="text-sm">
        {memberships.map((m) => (
          <li key={m.groupId} className="rule-single first:border-t-0">
            <button
              type="button"
              disabled={pending || m.isActive}
              onClick={() =>
                startTransition(async () => {
                  await switchGroup(m.groupId);
                })
              }
              className="w-full text-left py-2.5 flex items-center gap-2.5 disabled:opacity-100"
              aria-current={m.isActive ? "true" : undefined}
            >
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full shrink-0 ${
                  m.isActive ? "bg-ink" : "bg-paper-edge"
                }`}
              />
              <span className={m.isActive ? "font-medium" : "text-ink-soft"}>
                {m.groupName}
              </span>
              {m.role === "admin" && (
                <span className="text-ink-faint text-xs">Admin</span>
              )}
              <span className="leader" aria-hidden="true" />
              {m.isActive && <span className="text-xs text-ink-faint">aktiv</span>}
            </button>
          </li>
        ))}
      </ul>

      <div className="flex gap-2 pt-1">
        <Link href="/gruppe/beitreten" className="btn btn-secondary flex-1 text-sm">
          Beitreten
        </Link>
        <Link href="/gruppe/neu" className="btn btn-secondary flex-1 text-sm">
          Neue Gruppe
        </Link>
      </div>
    </div>
  );
}
