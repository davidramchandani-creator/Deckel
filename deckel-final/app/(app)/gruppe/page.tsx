import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { GroupSettings, Member } from "@/lib/types";
import { WebhookButton } from "./webhook-button";

export default async function GruppePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: myMembership } = await supabase
    .from("members")
    .select("id, group_id, role, groups(id, name, invite_code)")
    .eq("user_id", user!.id)
    .limit(1)
    .maybeSingle();

  if (!myMembership) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">
          Noch keine Gruppe. Erstelle eine oder tritt einer bei.
        </p>
        <div className="flex gap-2">
          <Link
            href="/gruppe/neu"
            className="flex-1 text-center border border-ink bg-ink text-paper px-2 py-1.5 text-sm"
          >
            Gruppe erstellen
          </Link>
          <Link
            href="/gruppe/beitreten"
            className="flex-1 text-center border border-ink px-2 py-1.5 text-sm"
          >
            Beitreten
          </Link>
        </div>
      </div>
    );
  }

  const group = Array.isArray(myMembership.groups) ? myMembership.groups[0] : myMembership.groups;

  const { data: members } = await supabase
    .from("members")
    .select("*")
    .eq("group_id", myMembership.group_id)
    .order("created_at", { ascending: true });

  const { data: settings } = await supabase
    .from("group_settings")
    .select("*")
    .eq("group_id", myMembership.group_id)
    .order("valid_from", { ascending: false })
    .limit(1)
    .maybeSingle<GroupSettings>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-sm tracking-tight mb-1">{group?.name}</h1>
        <p className="text-xs text-ink-soft">
          Einladungscode: <span className="text-ink">{group?.invite_code}</span>
        </p>
      </div>

      <section>
        <h2 className="text-xs uppercase tracking-wide text-ink-soft mb-2">Mitglieder</h2>
        <ul className="text-sm divide-y divide-ink/10 border-y border-ink/10">
          {(members as Member[] | null)?.map((m) => (
            <li key={m.id} className="py-1.5 flex items-center">
              <span>{m.display_name}</span>
              <span className="leader" />
              <span className="text-ink-soft text-xs">
                {m.role === "admin" ? "Admin" : "Mitglied"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {settings && (
        <section>
          <h2 className="text-xs uppercase tracking-wide text-ink-soft mb-2">Regeln</h2>
          <dl className="text-sm space-y-1">
            <div className="flex">
              <dt>Periode</dt>
              <span className="leader" />
              <dd>{settings.period_days} Tage</dd>
            </div>
            <div className="flex">
              <dt>Velo-Faktor</dt>
              <span className="leader" />
              <dd>{settings.bike_factor.toFixed(2)}</dd>
            </div>
            <div className="flex">
              <dt>Deckel</dt>
              <span className="leader" />
              <dd>
                {settings.currency} {settings.cap_chf.toFixed(2)}
              </dd>
            </div>
          </dl>
          {myMembership.role === "admin" && (
            <p className="text-xs text-ink-soft mt-2">
              Regeln aendern: bald verfuegbar. Nur Admins duerfen das.
            </p>
          )}
        </section>
      )}

      {myMembership.role === "admin" && (
        <section>
          <h2 className="text-xs uppercase tracking-wide text-ink-soft mb-2">
            Einrichtung
          </h2>
          <WebhookButton />
        </section>
      )}
    </div>
  );
}
