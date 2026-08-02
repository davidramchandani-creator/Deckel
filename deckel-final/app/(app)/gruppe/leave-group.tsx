"use client";

import { useActionState, useState } from "react";
import { leaveGroup, type LeaveState } from "@/lib/actions/groups-switch";

const initial: LeaveState = { status: "idle" };

export function LeaveGroup({
  groupId,
  groupName,
  isLastMember,
}: {
  groupId: string;
  groupName: string;
  isLastMember: boolean;
}) {
  const [state, formAction, pending] = useActionState(leaveGroup, initial);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="btn btn-quiet text-xs text-accent"
        >
          Gruppe verlassen
        </button>
        {state.status === "error" && (
          <p className="text-xs text-accent">{state.message}</p>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="group_id" value={groupId} />
      <p className="text-sm leading-relaxed">
        <strong>{groupName}</strong> wirklich verlassen?
      </p>
      <p className="text-xs text-ink-soft leading-relaxed">
        Deine Aktivitäten und Abrechnungen in dieser Gruppe werden dabei
        gelöscht — auch die aus abgeschlossenen Perioden. Das lässt sich nicht
        rückgängig machen.
        {isLastMember && (
          <> Da du das letzte Mitglied bist, wird die Gruppe ganz entfernt.</>
        )}
      </p>

      {state.status === "error" && (
        <p className="text-xs text-accent">{state.message}</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="btn btn-secondary flex-1 text-sm"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={pending}
          className="btn flex-1 text-sm border-accent text-accent"
        >
          {pending ? "…" : "Verlassen"}
        </button>
      </div>
    </form>
  );
}
