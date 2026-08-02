import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { GroupSettings, Member, Period } from "@/lib/types";
import { getMemberships } from "@/lib/active-group";
import { WebhookButton } from "./webhook-button";
import { InviteShare } from "./invite";
import { RulesForm } from "./rules-form";
import { GroupSwitcher } from "./group-switcher";
import { LeaveGroup } from "./leave-group";
import { PromoteButton } from "./promote";
import { Sheet, SectionLabel, Line, money } from "@/components/receipt";
import { PushToggle } from "@/components/push-toggle";

export const dynamic = "force-dynamic";

export default async function GruppePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const memberships = await getMemberships();
  const active = memberships.find((m) => m.isActive);

  if (!active) {
    return (
      <div className="space-y-4">
        <Sheet className="perforated-top">
          <h1 className="text-lg font-medium mb-1">Noch keine Gruppe</h1>
          <p className="text-sm text-ink-soft leading-relaxed">
            Erstelle eine Gruppe und lade deine Kolleg:innen ein — oder tritt
            mit einem Code einer bestehenden bei.
          </p>
        </Sheet>
        <div className="flex gap-2">
          <Link href="/gruppe/neu" className="btn btn-primary flex-1">
            Gruppe erstellen
          </Link>
          <Link href="/gruppe/beitreten" className="btn btn-secondary flex-1">
            Beitreten
          </Link>
        </div>
      </div>
    );
  }

  const [{ data: members }, { data: settings }, { data: period }] =
    await Promise.all([
      supabase
        .from("members")
        .select("*")
        .eq("group_id", active.groupId)
        .order("created_at", { ascending: true })
        .returns<Member[]>(),
      supabase
        .from("group_settings")
        .select("*")
        .eq("group_id", active.groupId)
        .order("valid_from", { ascending: false })
        .limit(1)
        .maybeSingle<GroupSettings>(),
      supabase
        .from("periods")
        .select("*")
        .eq("group_id", active.groupId)
        .eq("status", "open")
        .maybeSingle<Period>(),
    ]);

  const isAdmin = active.role === "admin";
  const memberCount = members?.length ?? 0;
  const otherAdmins =
    members?.filter((m) => m.role === "admin" && m.user_id !== user!.id).length ?? 0;

  return (
    <div className="space-y-5">
      <Sheet className="perforated-top">
        <h1 className="text-lg font-medium">{active.groupName}</h1>
        {period && (
          <p className="text-xs text-ink-soft mt-0.5">
            Periode {new Date(period.starts_on).toLocaleDateString("de-CH")} bis{" "}
            {new Date(period.ends_on).toLocaleDateString("de-CH")}
          </p>
        )}
        <div className="mt-4">
          <InviteShare inviteCode={active.inviteCode} />
        </div>
      </Sheet>

      {memberships.length > 1 ? (
        <Sheet>
          <SectionLabel>Deine Gruppen ({memberships.length})</SectionLabel>
          <GroupSwitcher memberships={memberships} />
        </Sheet>
      ) : (
        <Sheet>
          <SectionLabel>Weitere Gruppen</SectionLabel>
          <p className="text-sm text-ink-soft mb-3 leading-relaxed">
            Du kannst in mehreren Gruppen gleichzeitig mitlaufen — etwa mit dem
            Team und mit Freunden. Jede hat eigene Regeln und einen eigenen Topf.
          </p>
          <GroupSwitcher memberships={memberships} />
        </Sheet>
      )}

      <Sheet>
        <SectionLabel>Mitglieder ({memberCount})</SectionLabel>
        <ul className="text-sm">
          {members?.map((m) => (
            <li key={m.id} className="rule-single first:border-t-0">
              <Line
                left={
                  <span>
                    {m.display_name}
                    {m.user_id === user!.id && (
                      <span className="text-ink-faint text-xs"> (du)</span>
                    )}
                  </span>
                }
                right={
                  <span className="text-ink-faint text-xs">
                    {m.role === "admin" ? "Admin" : "Mitglied"}
                  </span>
                }
                sub={
                  <span className="flex items-center gap-2">
                    <span className="text-ink-faint">
                      {m.strava_athlete_id ? "Strava verbunden" : "ohne Strava"}
                    </span>
                    {isAdmin && m.role !== "admin" && (
                      <PromoteButton memberId={m.id} />
                    )}
                  </span>
                }
              />
            </li>
          ))}
        </ul>
      </Sheet>

      {settings && (
        <Sheet>
          <SectionLabel>Regeln</SectionLabel>
          {isAdmin ? (
            <RulesForm
              groupId={active.groupId}
              periodDays={settings.period_days}
              bikeFactor={Number(settings.bike_factor)}
              capChf={Number(settings.cap_chf)}
            />
          ) : (
            <div className="text-sm">
              <Line left="Periode" right={`${settings.period_days} Tage`} />
              <Line left="Velo-Faktor" right={Number(settings.bike_factor).toFixed(2)} />
              <Line
                left="Deckel"
                right={money(Number(settings.cap_chf), settings.currency)}
              />
              <p className="text-xs text-ink-soft mt-2">
                Nur Admins können die Regeln ändern.
              </p>
            </div>
          )}
        </Sheet>
      )}

      <Sheet>
        <SectionLabel>Dein Profil</SectionLabel>
        <Link href="/name" className="btn btn-secondary w-full">
          Namen ändern
        </Link>
      </Sheet>

      {process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && (
        <Sheet>
          <SectionLabel>Benachrichtigungen</SectionLabel>
          <PushToggle vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY} />
        </Sheet>
      )}

      {isAdmin && (
        <Sheet>
          <SectionLabel>Einrichtung</SectionLabel>
          <p className="text-xs text-ink-soft mb-2">
            Einmalig nötig, damit Strava neue Läufe automatisch meldet.
          </p>
          <WebhookButton />
        </Sheet>
      )}

      <Sheet>
        <SectionLabel>Gruppe verlassen</SectionLabel>
        <LeaveGroup
          groupId={active.groupId}
          groupName={active.groupName}
          isLastMember={memberCount <= 1}
        />
        {isAdmin && otherAdmins === 0 && memberCount > 1 && (
          <p className="text-xs text-ink-soft mt-2 leading-relaxed">
            Du bist der einzige Admin. Mach zuerst jemand anderen zum Admin,
            sonst bleibt die Gruppe ohne Verwaltung zurück.
          </p>
        )}
      </Sheet>
    </div>
  );
}
