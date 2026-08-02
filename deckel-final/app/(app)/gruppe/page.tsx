import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { GroupSettings, Member, Period } from "@/lib/types";
import { WebhookButton } from "./webhook-button";
import { InviteShare } from "./invite";
import { RulesForm } from "./rules-form";
import { Sheet, SectionLabel, Line, money } from "@/components/receipt";
import { PushToggle } from "@/components/push-toggle";

export const dynamic = "force-dynamic";

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
        <Sheet className="perforated-top">
          <p className="text-sm text-ink-soft">
            Du bist noch in keiner Gruppe.
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

  const group = Array.isArray(myMembership.groups)
    ? myMembership.groups[0]
    : myMembership.groups;
  const isAdmin = myMembership.role === "admin";

  const [{ data: members }, { data: settings }, { data: period }] =
    await Promise.all([
      supabase
        .from("members")
        .select("*")
        .eq("group_id", myMembership.group_id)
        .order("created_at", { ascending: true })
        .returns<Member[]>(),
      supabase
        .from("group_settings")
        .select("*")
        .eq("group_id", myMembership.group_id)
        .order("valid_from", { ascending: false })
        .limit(1)
        .maybeSingle<GroupSettings>(),
      supabase
        .from("periods")
        .select("*")
        .eq("group_id", myMembership.group_id)
        .eq("status", "open")
        .maybeSingle<Period>(),
    ]);

  return (
    <div className="space-y-5">
      <Sheet className="perforated-top">
        <h1 className="text-lg font-medium">{group?.name}</h1>
        {period && (
          <p className="text-xs text-ink-soft mt-0.5">
            Periode {period.starts_on} bis {period.ends_on}
          </p>
        )}
        <div className="mt-4">
          <InviteShare inviteCode={group?.invite_code ?? ""} />
        </div>
      </Sheet>

      <Sheet>
        <SectionLabel>Mitglieder ({members?.length ?? 0})</SectionLabel>
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
                  m.strava_athlete_id ? (
                    <span className="text-ink-faint">Strava verbunden</span>
                  ) : (
                    <span className="text-ink-faint">ohne Strava</span>
                  )
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
              groupId={myMembership.group_id}
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
    </div>
  );
}
