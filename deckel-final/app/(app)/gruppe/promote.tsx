"use client";

import { useTransition } from "react";
import { promoteToAdmin } from "@/lib/actions/groups-switch";

export function PromoteButton({ memberId }: { memberId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await promoteToAdmin(memberId);
        })
      }
      className="btn btn-quiet text-xs"
    >
      {pending ? "…" : "zum Admin machen"}
    </button>
  );
}
