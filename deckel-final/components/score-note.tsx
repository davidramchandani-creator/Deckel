import { effortLabel, type ScoreBreakdown } from "@/lib/sports";

/**
 * Die Rechnung hinter einer Aktivitaet, in einer Zeile.
 *
 *   52 min × 0.09 × 1.2 = 5.6 P · Ø 158 · hart
 *
 * Warum das ueberall steht, wo eine Aktivitaet auftaucht: es geht um Geld.
 * Eine Punktzahl, die man nicht nachrechnen kann, wird frueher oder
 * spaeter angezweifelt -- und zwar zu Recht. Wer die Rechnung sieht,
 * streitet ueber den Satz (den die Gruppe einstellen kann) statt ueber die
 * App. Dasselbe gilt fuer die Zeilen der anderen: nur so ist erkennbar,
 * warum jemand vorne liegt.
 */
export function ScoreNote({ b }: { b: ScoreBreakdown }) {
  if (!b.sport) {
    return <span className="text-ink-faint">zählt in dieser Periode nicht</span>;
  }

  const isKm = b.sport.unit === "km";
  const amount = isKm ? `${b.amount.toFixed(1)} km` : `${Math.round(b.amount)} min`;
  // Der Puls zaehlt nur bei Zeit-Sportarten mit -- der Faktor wird darum
  // auch nur dort gezeigt, statt ueberall eine stumme "×1" hinzuschreiben.
  const showFactor = b.usesHeartrate && b.avgHeartrate != null;

  return (
    <span className="text-ink-faint">
      <span className="num">{amount}</span>
      {" × "}
      <span className="num">{b.rate}</span>
      {showFactor && (
        <>
          {" × "}
          <span className="num">{b.factor}</span>
        </>
      )}
      {" = "}
      <span className="num text-ink-soft">{b.points.toFixed(1)} P</span>
      {b.avgHeartrate != null && (
        <>
          {" · Ø "}
          <span className="num">{b.avgHeartrate}</span>
          {showFactor && <> · {effortLabel(b.factor)}</>}
        </>
      )}
      {b.usesHeartrate && b.avgHeartrate == null && <> · ohne Puls gemessen</>}
    </span>
  );
}
