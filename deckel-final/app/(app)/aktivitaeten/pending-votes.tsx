"use client";

import { useTransition, useState } from "react";
import { voteActivity, withdrawManualActivity } from "@/lib/actions/manual";
import { Line } from "@/components/receipt";

export interface PendingItem {
  id: string;
  displayName: string;
  sportLabel: string;
  amount: string;
  note: string | null;
  startedAt: string;
  isMine: boolean;
  myVote: boolean | null;
  approvals: number;
  rejections: number;
  needed: number;
}

/**
 * The approval inbox. Everything waiting on the group, with who has
 * already voted -- so it is obvious how close an entry is to counting,
 * and nobody has to chase people in chat.
 */
export function PendingVotes({ items }: { items: PendingItem[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rule-single first:border-t-0 pt-2 first:pt-0">
          <Line
            left={
              <span>
                {item.isMine ? "Du" : item.displayName} · {item.sportLabel}
              </span>
            }
            right={item.amount}
            sub={
              <span className="text-ink-faint">
                {new Date(item.startedAt).toLocaleDateString("de-CH", {
                  day: "2-digit",
                  month: "2-digit",
                })}
                {item.note && ` · „${item.note}“`}
                {" · "}
                {item.approvals}/{item.needed} bestätigt
                {item.rejections > 0 && ` · ${item.rejections} dagegen`}
              </span>
            }
          />

          {item.isMine ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await withdrawManualActivity(item.id);
                  if (r.status === "error") setError(r.message ?? null);
                })
              }
              className="btn btn-quiet text-xs mt-1"
            >
              Zurückziehen
            </button>
          ) : (
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                disabled={pending || item.myVote === true}
                onClick={() =>
                  startTransition(async () => {
                    const r = await voteActivity(item.id, true);
                    if (r.status === "error") setError(r.message ?? null);
                  })
                }
                className={`btn flex-1 text-sm ${item.myVote === true ? "btn-primary" : "btn-secondary"}`}
              >
                {item.myVote === true ? "Bestätigt ✓" : "Passt"}
              </button>
              <button
                type="button"
                disabled={pending || item.myVote === false}
                onClick={() =>
                  startTransition(async () => {
                    const r = await voteActivity(item.id, false);
                    if (r.status === "error") setError(r.message ?? null);
                  })
                }
                className={`btn flex-1 text-sm ${item.myVote === false ? "btn-primary" : "btn-secondary"}`}
              >
                {item.myVote === false ? "Abgelehnt" : "Zweifel"}
              </button>
            </div>
          )}
        </div>
      ))}

      {error && <p className="text-xs text-accent">{error}</p>}
    </div>
  );
}
