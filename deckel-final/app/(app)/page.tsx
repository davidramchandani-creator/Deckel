import Link from "next/link";
import { getMySettlementView } from "@/lib/settlement";

export const dynamic = "force-dynamic";

function fmt(amount: number) {
  return amount.toFixed(2);
}

export default async function RanglistePage() {
  const view = await getMySettlementView();

  if (!view) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">
          Noch keine Gruppe. Erstelle eine oder tritt mit einem Einladungscode bei.
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-sm tracking-tight">{view.groupName}</h1>
        <p className="text-xs text-ink-soft">
          {view.daysRemaining > 0
            ? `Noch ${view.daysRemaining} Tag${view.daysRemaining === 1 ? "" : "e"}`
            : "Letzter Tag der Periode"}
          {" -- Tag "}
          {view.currentDay}/{view.period.settings_snapshot.period_days}
        </p>
      </div>

      <div className="text-sm">
        {view.rows.length === 0 ? (
          <p className="text-ink-soft">
            Noch keine Aktivitaet in dieser Periode. Verbinde Strava oder trage km von Hand ein.
          </p>
        ) : (
          <ul>
            {view.rows.map((row) => (
              <li key={row.memberId} className="border-b border-ink/10 py-2">
                <details>
                  <summary className="flex items-baseline cursor-pointer list-none">
                    <span>
                      {row.isRecordHolder && <span title="Rekordhalter">&#9733; </span>}
                      {row.displayName}
                      {row.status === "sick" && (
                        <span className="text-ink-soft text-xs"> (krank)</span>
                      )}
                      {row.status === "withdrawn" && (
                        <span className="text-ink-soft text-xs"> (abgemeldet)</span>
                      )}
                    </span>
                    <span className="leader" />
                    <span className="text-ink-soft text-xs mr-2">
                      {row.points.toFixed(1)} P
                    </span>
                    <span className="tabular-nums">
                      {row.owed > 0 ? `${view.currency} ${fmt(row.owed)}` : "--"}
                    </span>
                  </summary>
                  <div className="pl-4 pt-2 text-xs text-ink-soft space-y-1">
                    {row.activities.length === 0 ? (
                      <p>Keine Aktivitaeten in dieser Periode.</p>
                    ) : (
                      row.activities.map((a) => (
                        <div key={a.id} className="flex">
                          <span>
                            {a.sport_type === "run" ? "Lauf" : "Velo"}
                            {a.manual ? " (manuell)" : ""}
                          </span>
                          <span className="leader" />
                          <span>{Number(a.distance_km).toFixed(1)} km</span>
                        </div>
                      ))
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rule-double pt-2 text-sm">
        <div className="flex">
          <span>Topf</span>
          <span className="leader" />
          <span className="tabular-nums">
            {view.currency} {fmt(view.pot)}
          </span>
        </div>
        <div className="flex text-xs text-ink-soft">
          <span>ca. pro Kopf</span>
          <span className="leader" />
          <span className="tabular-nums">
            {view.currency} {fmt(view.perHead)}
          </span>
        </div>
      </div>
    </div>
  );
}
