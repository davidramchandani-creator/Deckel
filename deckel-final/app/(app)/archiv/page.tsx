import { createClient } from "@/lib/supabase/server";
import { PaidToggle } from "./paid-toggle";
import type { Period } from "@/lib/types";

export const dynamic = "force-dynamic";

interface SettlementWithMember {
  id: string;
  member_id: string;
  points: number;
  cap_applied: number;
  owed_chf: number;
  paid: boolean;
  members: { display_name: string } | { display_name: string }[] | null;
}

export default async function ArchivPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: member } = await supabase
    .from("members")
    .select("group_id")
    .eq("user_id", user!.id)
    .limit(1)
    .maybeSingle();

  if (!member) {
    return <p className="text-sm text-ink-soft">Noch keine Gruppe.</p>;
  }

  const { data: periods } = await supabase
    .from("periods")
    .select("*")
    .eq("group_id", member.group_id)
    .eq("status", "settled")
    .order("ends_on", { ascending: false })
    .returns<Period[]>();

  if (!periods || periods.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        Noch keine abgeschlossene Periode. Sobald die erste Periode endet,
        erscheint sie hier mit eingefrorener Abrechnung.
      </p>
    );
  }

  const { data: settlements } = await supabase
    .from("settlements")
    .select("id, member_id, points, cap_applied, owed_chf, paid, period_id, members(display_name)")
    .in(
      "period_id",
      periods.map((p) => p.id)
    );

  const byPeriod = new Map<string, (SettlementWithMember & { period_id: string })[]>();
  for (const s of (settlements as (SettlementWithMember & { period_id: string })[] | null) ?? []) {
    const list = byPeriod.get(s.period_id) ?? [];
    list.push(s);
    byPeriod.set(s.period_id, list);
  }

  return (
    <div className="space-y-8">
      {periods.map((period) => {
        const rows = (byPeriod.get(period.id) ?? []).sort((a, b) => b.points - a.points);
        const pot = rows.reduce((sum, r) => sum + Number(r.owed_chf), 0);
        const currency = period.settings_snapshot.currency;

        return (
          <section key={period.id}>
            <h2 className="text-xs uppercase tracking-wide text-ink-soft mb-2">
              {period.starts_on} bis {period.ends_on}
            </h2>
            <ul className="text-sm">
              {rows.map((row) => {
                const memberRel = Array.isArray(row.members) ? row.members[0] : row.members;
                return (
                  <li key={row.id} className="border-b border-ink/10 py-1.5 flex items-baseline">
                    <span>{memberRel?.display_name ?? "?"}</span>
                    <span className="leader" />
                    <span className="text-ink-soft text-xs mr-2">
                      {Number(row.points).toFixed(1)} P
                    </span>
                    <span className="tabular-nums mr-2">
                      {Number(row.owed_chf) > 0
                        ? `${currency} ${Number(row.owed_chf).toFixed(2)}`
                        : "--"}
                    </span>
                    {Number(row.owed_chf) > 0 && (
                      <PaidToggle settlementId={row.id} initialPaid={row.paid} />
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="rule-double pt-2 mt-2 text-sm flex">
              <span>Topf</span>
              <span className="leader" />
              <span className="tabular-nums">
                {currency} {pot.toFixed(2)}
              </span>
            </div>
          </section>
        );
      })}
    </div>
  );
}
