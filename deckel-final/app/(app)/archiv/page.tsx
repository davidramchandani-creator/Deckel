import { createClient } from "@/lib/supabase/server";
import { PaidToggle } from "./paid-toggle";
import { Sheet, SectionLabel, Line, money, points } from "@/components/receipt";
import type { Period } from "@/lib/types";
import { getActiveMembership } from "@/lib/active-group";
import { ShareResult } from "./share-result";
import { CopyAmount } from "./copy-amount";

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
  const active = await getActiveMembership();
  const member = active ? { group_id: active.groupId } : null;

  const { data: adminRow } = active
    ? await supabase
        .from("members")
        .select("display_name")
        .eq("group_id", active.groupId)
        .eq("role", "admin")
        .order("created_at")
        .limit(1)
        .maybeSingle()
    : { data: null };

  if (!member) {
    return (
      <Sheet className="perforated-top">
        <p className="text-sm text-ink-soft">Du bist noch in keiner Gruppe.</p>
      </Sheet>
    );
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

        const winner = rows.length > 0 ? rows[0] : null;
        const winnerRel = winner
          ? Array.isArray(winner.members)
            ? winner.members[0]
            : winner.members
          : null;
        const isNewest = period.id === periods[0].id;

        return (
          <Sheet
            key={period.id}
            className={`perforated-top ${isNewest ? "tear-in" : ""}`}
          >
            <SectionLabel>
              {new Date(period.starts_on).toLocaleDateString("de-CH")} bis{" "}
              {new Date(period.ends_on).toLocaleDateString("de-CH")}
            </SectionLabel>
            <ul className="text-sm">
              {rows.map((row) => {
                const memberRel = Array.isArray(row.members) ? row.members[0] : row.members;
                const owed = Number(row.owed_chf);
                return (
                  <li key={row.id} className="rule-single first:border-t-0">
                    <Line
                      left={
                        <span>
                          {memberRel?.display_name ?? "?"}
                          {winner?.id === row.id && (
                            <span className="stamp stamp-in ml-2">Gewonnen</span>
                          )}
                        </span>
                      }
                      right={
                        <span className={owed > 0 ? "text-accent" : "text-ink-faint"}>
                          {owed > 0 ? money(owed, currency) : "—"}
                        </span>
                      }
                      sub={
                        <span className="flex items-center gap-2">
                          <span className="num text-ink-faint">
                            {points(Number(row.points))}
                          </span>
                          {owed > 0 && (
                            <>
                              <PaidToggle settlementId={row.id} initialPaid={row.paid} />
                              {!row.paid && row.member_id === active?.memberId && (
                                <CopyAmount
                                  amount={owed}
                                  currency={currency}
                                  adminName={adminRow?.display_name ?? null}
                                  groupName={active?.groupName ?? ""}
                                />
                              )}
                            </>
                          )}
                        </span>
                      }
                    />
                  </li>
                );
              })}
            </ul>
            <div className="rule-draw mt-3 pt-2">
              <Line emphasis left="Topf" right={money(pot, currency)} />
            </div>
            <div className="mt-3">
              <ShareResult
                groupName={active?.groupName ?? ""}
                from={new Date(period.starts_on).toLocaleDateString("de-CH")}
                to={new Date(period.ends_on).toLocaleDateString("de-CH")}
                pot={pot}
                currency={currency}
                winnerName={winnerRel?.display_name ?? null}
                lines={rows.map((r) => {
                  const rel = Array.isArray(r.members) ? r.members[0] : r.members;
                  return { name: rel?.display_name ?? "?", owed: Number(r.owed_chf) };
                })}
              />
            </div>
          </Sheet>
        );
      })}
    </div>
  );
}
