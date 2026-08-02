"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { joinGroup, type GroupActionState } from "@/lib/actions/groups";
import { Sheet } from "@/components/receipt";

const initialState: GroupActionState = { status: "idle" };

function JoinForm() {
  const [state, formAction, pending] = useActionState(joinGroup, initialState);
  const params = useSearchParams();
  const prefill = params.get("code") ?? "";

  return (
    <Sheet className="perforated-top space-y-4">
      <div>
        <h1 className="text-lg font-medium mb-1">Gruppe beitreten</h1>
        <p className="text-sm text-ink-soft">
          {prefill
            ? "Der Einladungscode ist schon eingetragen. Sag uns noch, wie du heisst."
            : "Gib den Code ein, den du von deiner Gruppe bekommen hast."}
        </p>
      </div>

      <form action={formAction} className="space-y-3">
        <label className="block text-sm">
          <span className="text-ink-soft">Einladungscode</span>
          <input
            type="text"
            name="invite_code"
            required
            defaultValue={prefill}
            placeholder="z.B. a1b2c3d4"
            className="field mt-1 num"
          />
        </label>

        <label className="block text-sm">
          <span className="text-ink-soft">Dein Name</span>
          <input
            type="text"
            name="display_name"
            required
            minLength={2}
            maxLength={40}
            placeholder="z.B. Dave R."
            className="field mt-1"
            autoFocus={Boolean(prefill)}
          />
        </label>

        {state.status === "error" && (
          <p className="text-sm text-accent">{state.message}</p>
        )}

        <button type="submit" disabled={pending} className="btn btn-primary w-full">
          {pending ? "Einen Moment…" : "Beitreten"}
        </button>
      </form>
    </Sheet>
  );
}

export default function GruppeBeitretenPage() {
  return (
    <Suspense fallback={<Sheet className="perforated-top">Lädt…</Sheet>}>
      <JoinForm />
    </Suspense>
  );
}
