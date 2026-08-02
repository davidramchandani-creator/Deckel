import Link from "next/link";
import { getMySettlementView } from "@/lib/settlement";
import { Line, Sheet, SectionLabel, money, points } from "@/components/receipt";
import { Explainer } from "@/components/explainer";
import { formatAmount, sportByKey } from "@/lib/sports";
import { InstallPrompt } from "@/components/install-prompt";

export const dynamic = "force-dynamic";

export default async function RanglistePage() {
  const view = await getMySettlementView();

  if (!view) {
    return (
      <div className="space-y-5">
        <Sheet className="perforated-top">
          <h1 className="text-lg font-medium mb-1">Willkommen bei Pace or Pay</h1>
          <p className="text-sm text-ink-soft leading-relaxed">
            Ihr lauft und fahrt Velo gegeneinander. Wer zurueckliegt, zahlt die
            Differenz in einen gemeinsamen Topf — und der bezahlt am Ende das
            Team-Essen.
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

  const { me, currency } = view;
  const snapshot = view.period.settings_snapshot;

  return (
    <div className="space-y-5">
      <InstallPrompt />

      {/* Personal standing — the answer to "how am I doing and what does it cost me". */}
      {me && (
        <Sheet className="perforated-top">
          <div className="flex items-baseline justify-between mb-3">
            <span className="label">Dein Stand</span>
            <span className="text-xs text-ink-soft">
              Tag {view.currentDay} von {snapshot.period_days}
            </span>
          </div>

          {me.status === "withdrawn" ? (
            <p className="text-sm">
              Du bist für diese Periode abgemeldet und zahlst nichts.
            </p>
          ) : me.isRecordHolder ? (
            <>
              <p className="text-2xl font-medium mb-1 flex items-center gap-3">
                Du führst.
                <span className="stamp stamp-in">zahlt nichts</span>
              </p>
              <p className="text-sm text-ink-soft">
                {points(me.points)} — mehr als alle anderen. Solange das so
                bleibt, zahlst du nichts.
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-medium mb-1 num">
                {money(me.owed, currency)}
              </p>
              <p className="text-sm text-ink-soft leading-relaxed">
                So viel kostet dich dein Rückstand gerade. Du liegst{" "}
                <span className="num">{me.behind.toFixed(1)}</span> Punkte hinter
                der Spitze, auf Platz {me.rank} von {me.of}.
                {me.capReached && (
                  <> Der Deckel ist erreicht — mehr wird es nicht.</>
                )}
                {!me.capReached && me.behind > 0 && (
                  <>
                    {" "}
                    Jeder weitere Kilometer Laufen senkt den Betrag um{" "}
                    {currency} 1.00.
                  </>
                )}
              </p>
            </>
          )}

          {me.status === "sick" && (
            <p className="text-xs text-accent mt-2">
              Du bist krank gemeldet. Dein Deckel ist anteilig gekürzt.
            </p>
          )}

          {me.status !== "withdrawn" && me.catchUp && (
            <div className="rule-dashed mt-3 pt-3">
              <p className="text-xs text-ink-soft mb-1.5">
                {me.catchUp.aheadIsLeader ? (
                  <>Vor dir: nur noch <strong className="text-ink">{me.catchUp.aheadName}</strong>.</>
                ) : (
                  <>Direkt vor dir: <strong className="text-ink">{me.catchUp.aheadName}</strong>.</>
                )}{" "}
                Zum Überholen reicht eins davon:
              </p>
              <ul className="text-sm space-y-0.5">
                {me.catchUp.suggestions.map((sug) => (
                  <li key={sug.label} className="flex items-baseline">
                    <span>{sug.label}</span>
                    <span className="leader" aria-hidden="true" />
                    <span className="num">{sug.amount}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rule-dashed mt-3 pt-3">
            <p className="text-xs text-ink-soft">
              {view.daysRemaining > 0
                ? `Noch ${view.daysRemaining} ${view.daysRemaining === 1 ? "Tag" : "Tage"} bis zur Abrechnung.`
                : "Heute ist der letzte Tag dieser Periode."}
            </p>
          </div>
        </Sheet>
      )}

      {/* The bill itself. */}
      <Sheet>
        <div className="flex items-baseline justify-between mb-3">
          <SectionLabel>{view.groupName}</SectionLabel>
        </div>

        {view.rows.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Noch keine Aktivität in dieser Periode. Verbinde Strava oder trage km
            von Hand ein.
          </p>
        ) : (
          <ul className="text-sm">
            {view.rows.map((row) => {
              const isMe = me?.memberId === row.memberId;
              return (
                <li
                  key={row.memberId}
                  className={`rule-single first:border-t-0 ${isMe ? "bg-paper -mx-2 px-2 rounded-sm" : ""}`}
                >
                  <details>
                    <summary className="cursor-pointer list-none">
                      <Line
                        emphasis={isMe}
                        left={
                          <span>
                            {row.isRecordHolder && (
                              <span title="Führt" aria-label="Führt">
                                ★{" "}
                              </span>
                            )}
                            {row.displayName}
                            {isMe && (
                              <span className="text-ink-faint text-xs"> (du)</span>
                            )}
                            {row.status === "sick" && (
                              <span className="text-ink-faint text-xs"> · krank</span>
                            )}
                            {row.status === "withdrawn" && (
                              <span className="text-ink-faint text-xs"> · abgemeldet</span>
                            )}
                          </span>
                        }
                        right={
                          <span className={row.owed > 0 ? "text-accent" : "text-ink-faint"}>
                            {row.owed > 0 ? money(row.owed, currency) : "—"}
                          </span>
                        }
                        sub={
                          <span className="num text-ink-faint">
                            {points(row.points)}
                          </span>
                        }
                      />
                    </summary>

                    <div className="pl-3 pb-2 text-xs text-ink-soft space-y-1">
                      {row.activities.length === 0 ? (
                        <p>Keine Aktivitäten in dieser Periode.</p>
                      ) : (
                        row.activities.map((a) => (
                          <div key={a.id} className="flex items-baseline">
                            <span>
                              {sportByKey(a.sport_type, view.sports)?.label ?? a.sport_type}
                              {a.source === "manual" && (
                                <span className="text-ink-faint"> · von Hand</span>
                              )}
                            </span>
                            <span className="leader" aria-hidden="true" />
                            <span className="num">
                              {formatAmount(
                                {
                                  sportKey: a.sport_type,
                                  distanceKm: Number(a.distance_km),
                                  movingTimeMin: (a.moving_time_s ?? 0) / 60,
                                },
                                view.sports
                              )}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}

        <div className="rule-double mt-3 pt-2">
          <Line
            emphasis
            left="Topf"
            right={money(view.pot, currency)}
            sub={
              view.pot > 0 ? (
                <>ca. {money(view.perHead, currency)} pro Kopf fürs Essen</>
              ) : (
                <>Noch liegt niemand zurück.</>
              )
            }
          />
        </div>

        <Explainer
          periodDays={snapshot.period_days}
          sports={view.sports}
          cap={snapshot.cap_chf}
          currency={currency}
        />
      </Sheet>
    </div>
  );
}
