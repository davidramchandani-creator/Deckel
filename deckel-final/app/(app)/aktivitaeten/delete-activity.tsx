"use client";

import { useState, useTransition } from "react";
import { deleteManualActivity } from "@/lib/actions/profile";

export function DeleteActivity({ activityId }: { activityId: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="btn btn-quiet text-xs"
        aria-label="Eintrag löschen"
      >
        löschen
      </button>
    );
  }

  return (
    <span className="flex gap-2 items-center">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await deleteManualActivity(activityId);
          })
        }
        className="btn btn-quiet text-xs text-accent"
      >
        {pending ? "…" : "wirklich?"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="btn btn-quiet text-xs"
      >
        nein
      </button>
    </span>
  );
}
