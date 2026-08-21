import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/active-group";
import { Sheet, SectionLabel } from "@/components/receipt";
import { Detail } from "./details";
import { Calculator } from "./calculator";
import {
  sportsFromSnapshot,
  handicapFromSnapshot,
  applyHandicap,
  type SportDef,
} from "@/lib/sports";
import type { Period } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Die Spielregeln -- zum Anschauen, nicht zum Durchlesen.
 *
 * Die erste Fassung war eine Textwueste: zehn Abschnitte Fliesstext, die
 * niemand gelesen hat (auch der Autor der App nicht). Jetzt tragen ein
 * Diagramm und ein paar Zahlen die Erklaerung, und alles Weiterfuehrende
 * liegt hinter aufklappbaren Blocks.
 */
export default async function InfoPage() {
  const supabase = await createClient();
  const active = await getActiveMembership();

  let period: Period | null = null;
  if (active) {
    const { data } = await supabase
      .from("periods")
      .select("*")
      .eq("group_id", active.groupId)
      .eq("status", "open")
      .order("starts_on", { ascending: false })
      .limit(1)
      .maybeSingle<Period>();
    period = data;
  }

  const snapshot = period?.settings_snapshot;
  const sports: SportDef[] = snapshot ? sportsFromSnapshot(snapshot) : [];
  const handicap = snapshot ? handicapFromSnapshot(snapshot) : null;
  const cap = snapshot ? Number(snapshot.cap_chf) : 20;
  const periodDays = snapshot?.period_days ?? 14;
  const currency = snapshot?.currency ?? "CHF";

  const distanz = sports.filter((s) => s.unit === "km");
  const zeit = sports.filter((s) => s.unit === "min");

  const geld = (n: number) => `${currency} ${n.toFixed(2)}`;

  /* Das Diagramm: vier Saeulen, von der Spitze bis zur Null. Zeigt in
     einem Bild, was drei Absaetze Text nicht schaffen -- dass die Schuld
     mit dem Rueckstand waechst, gleichmaessig und ohne tote Zone. */
  const beispiel = [
    { name: "Spitze", anteil: 1.0 },
    { name: "", anteil: 0.7 },
    { name: "", anteil: 0.35 },
    { name: "Nichts", anteil: 0 },
  ];

  return (
    <div className="space-y-5">
      <Sheet className="perforated-top">
        <p className="label mb-1">In einem Satz</p>
        <h1 className="text-xl font-medium leading-snug mb-2">
          Wer am wenigsten macht, zahlt am meisten.
        </h1>
        <p className="text-sm text-ink-soft leading-relaxed">
          {periodDays} Tage Sport. Am Ende zahlen alle in einen Topf — je
          weiter hinten, desto mehr. Der Topf zahlt das Essen.
        </p>
      </Sheet>

      <Sheet>
        <SectionLabel>Wer zahlt wie viel</SectionLabel>

        <svg
          viewBox="0 0 300 150"
          className="w-full h-auto mt-1"
          role="img"
          aria-label={`Je weiter hinten, desto mehr zahlst du. Die Spitze zahlt nichts, wer nichts macht zahlt ${geld(cap)}.`}
        >
          {beispiel.map((b, i) => {
            const x = 18 + i * 70;
            const hoehe = Math.max(4, b.anteil * 88);
            const y = 100 - hoehe;
            const schuld = cap * (1 - b.anteil);
            return (
              <g key={i}>
                {/* Punkte-Saeule */}
                <rect
                  x={x}
                  y={y}
                  width="34"
                  height={hoehe}
                  rx="2"
                  fill="var(--ink)"
                  opacity={0.15 + b.anteil * 0.75}
                />
                {/* Betrag darunter, rot wie auf dem Beleg */}
                <text
                  x={x + 17}
                  y={120}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="500"
                  fill={schuld > 0 ? "var(--accent)" : "var(--ink-faint)"}
                >
                  {schuld > 0 ? schuld.toFixed(0) + ".—" : "0.—"}
                </text>
                <text
                  x={x + 17}
                  y={137}
                  textAnchor="middle"
                  fontSize="9"
                  fill="var(--ink-faint)"
                >
                  {b.name}
                </text>
              </g>
            );
          })}
          <line
            x1="10"
            y1="100.5"
            x2="290"
            y2="100.5"
            stroke="var(--paper-edge)"
            strokeWidth="1"
          />
          <text x="10" y="14" fontSize="9" fill="var(--ink-faint)">
            Punkte
          </text>
        </svg>

        <p className="text-sm text-ink-soft leading-relaxed mt-1">
          Halber Rückstand heisst halber Betrag. Jeder einzelne Punkt senkt
          also deine Schuld — bis zum letzten Tag.
        </p>
      </Sheet>

      <Sheet>
        <SectionLabel>Punkte sammeln</SectionLabel>

        <p className="text-sm text-ink-soft leading-relaxed mb-3">
          Der Massstab hinter allen Sätzen ist der{" "}
          <span className="text-ink">Energieverbrauch pro Stunde</span> —
          in der Sportwissenschaft „MET“ genannt. Eine Stunde Squash
          verbrennt etwa dreimal so viel wie eine Stunde Yoga, also gibt
          sie etwa dreimal so viele Punkte. Anker ist Laufen:{" "}
          <span className="text-ink">1 km = 1 Punkt</span>.
        </p>

        <svg
          viewBox="0 0 300 108"
          className="w-full h-auto mb-3"
          role="img"
          aria-label="Balken: eine Stunde Laufen 12.5 Punkte, Squash 9, Velo 8, Kraft 5.5, Yoga 3."
        >
          {[
            { label: "Laufen", ph: 12.5 },
            { label: "Squash", ph: 9 },
            { label: "Velo", ph: 8 },
            { label: "Kraft", ph: 5.5 },
            { label: "Yoga", ph: 3 },
          ].map((b, i) => {
            const y = 4 + i * 21;
            const w = (b.ph / 12.5) * 210;
            return (
              <g key={b.label}>
                <text x="0" y={y + 11} fontSize="10" fill="var(--ink-soft)">
                  {b.label}
                </text>
                <rect
                  x="52"
                  y={y}
                  width={w}
                  height="14"
                  rx="2"
                  fill="var(--ink)"
                  opacity={0.2 + (b.ph / 12.5) * 0.7}
                />
                <text
                  x={52 + w + 6}
                  y={y + 11}
                  fontSize="10"
                  fontWeight="500"
                  fill="var(--ink)"
                >
                  {b.ph} P/h
                </text>
              </g>
            );
          })}
        </svg>

        <Detail summary="Alle Sätze deiner Gruppe">
          {distanz.length > 0 && (
            <div className="mb-2">
              <p className="label mb-1">Nach Distanz</p>
              <ul>
                {distanz.map((sp) => (
                  <li key={sp.key} className="flex items-baseline">
                    <span>{sp.label}</span>
                    <span className="leader" aria-hidden="true" />
                    <span className="num">{sp.rate} P/km</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {zeit.length > 0 && (
            <div>
              <p className="label mb-1">Nach Zeit</p>
              <ul>
                {zeit.map((sp) => (
                  <li key={sp.key} className="flex items-baseline">
                    <span>{sp.label}</span>
                    <span className="leader" aria-hidden="true" />
                    <span className="num">{sp.rate} P/min</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Detail>
      </Sheet>

      {sports.length > 0 && (
        <Sheet>
          <SectionLabel>Probier es aus</SectionLabel>
          <p className="text-sm text-ink-soft leading-relaxed mb-3">
            Was bringt dir eine Einheit? Regler ziehen und schauen.
          </p>
          <Calculator sports={sports} />
        </Sheet>
      )}

      {zeit.length > 0 && (
        <Sheet>
          <SectionLabel>Der Puls zählt mit</SectionLabel>

          <p className="text-sm text-ink-soft leading-relaxed mb-3">
            Bei Sportarten nach Zeit entscheidet dein Ø-Puls, ob es mehr
            oder weniger Punkte gibt.
          </p>

          <svg
            viewBox="0 0 300 58"
            className="w-full h-auto"
            role="img"
            aria-label="Skala von Faktor 0.7 bei lockerer Einheit bis 1.4 bei harter Einheit."
          >
            <defs>
              <linearGradient id="effort" x1="0" x2="1">
                <stop offset="0%" stopColor="var(--ink)" stopOpacity="0.15" />
                <stop offset="100%" stopColor="var(--ink)" stopOpacity="0.85" />
              </linearGradient>
            </defs>
            <rect x="10" y="16" width="280" height="10" rx="5" fill="url(#effort)" />
            {[
              { x: 10, v: "×0.7", t: "locker" },
              { x: 150, v: "×1.0", t: "normal" },
              { x: 290, v: "×1.4", t: "hart" },
            ].map((m, i) => (
              <g key={i}>
                <line
                  x1={m.x}
                  y1="12"
                  x2={m.x}
                  y2="30"
                  stroke="var(--ink-faint)"
                  strokeWidth="1"
                />
                <text
                  x={m.x}
                  y="43"
                  textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
                  fontSize="11"
                  fontWeight="500"
                  fill="var(--ink)"
                >
                  {m.v}
                </text>
                <text
                  x={m.x}
                  y="54"
                  textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
                  fontSize="9"
                  fill="var(--ink-faint)"
                >
                  {m.t}
                </text>
              </g>
            ))}
          </svg>

          <div className="rule-dashed mt-3 pt-3">
            <p className="label mb-2">Verglichen wird nur mit derselben Sportart</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-ink">Tim, Fussball</p>
                <p className="num text-lg">147</p>
                <p className="text-xs text-ink-faint">normal → ×1.0</p>
              </div>
              <div>
                <p className="text-ink">Dave, Kraft</p>
                <p className="num text-lg">96</p>
                <p className="text-xs text-ink-faint">normal → ×1.0</p>
              </div>
            </div>
            <p className="text-xs text-ink-soft leading-relaxed mt-2">
              50 Schläge Unterschied, gleicher Faktor. Krafttraining hat nun
              mal einen tieferen Puls als Fussball. Ob Fussball mehr wert
              ist, entscheidet allein der Satz oben — nie der Puls.
            </p>
          </div>
        </Sheet>
      )}

      <Sheet>
        <SectionLabel>Noch Fragen?</SectionLabel>
        <div>
          <Detail summary="Was heisst P, P/km, P/min und P/h?">
            <p>
              P steht für Punkt. P/km ist der Satz pro Kilometer, P/min der
              Satz pro Minute — das sind die Zahlen, mit denen wirklich
              gerechnet wird.
            </p>
            <p>
              P/h (Punkte pro Stunde) taucht nur in Vergleichen auf: es
              sagt, was eine <em>typische</em> Stunde dieser Sportart etwa
              bringt. Beim Laufen ergibt sich das aus dem Tempo — wer 12 km
              in der Stunde läuft, holt 12 P/h. So kann man Sätze über
              Sportarten hinweg vergleichen, obwohl die einen pro Kilometer
              und die anderen pro Minute zählen.
            </p>
          </Detail>

          <Detail summary="Was zählt als locker, normal und hart?">
            <p>
              Massstab ist der typische Ø-Puls <em>derselben Sportart</em>.
              „Normal“ heisst: dein Schnitt liegt ungefähr dort, wo eine
              gewöhnliche Einheit dieser Sportart liegt (±10%). Deutlich
              darunter ist locker, deutlich darüber hart.
            </p>
            <p>
              Konkret, mit Standardannahmen: beim Krafttraining ist ein
              Ø-Puls um 93–100 normal, beim Fussball einer um 136–153. Wer
              Ruhepuls und Maximalpuls im Profil hinterlegt, verschiebt
              diese Grenzen auf sich selbst — ein von Natur aus tiefer Puls
              wird dann nicht als „locker“ fehlgedeutet.
            </p>
            <p>
              Der Rechner oben zeigt dir die Grenzen für jede Sportart an.
            </p>
          </Detail>

          <Detail summary="Wie hängen MET und Puls zusammen?">
            <p>
              Zwei verschiedene Jobs. <em>MET</em> vergleicht Sportarten
              untereinander: es legt den Grundwert fest — was eine typische
              Stunde Squash gegenüber einer typischen Stunde Yoga wert ist.
              Daraus kommen die Sätze (P/km, P/min).
            </p>
            <p>
              Der <em>Puls</em> vergleicht nur deine einzelne Einheit mit
              einer normalen Einheit derselben Sportart und verschiebt die
              Punkte um ×0.7 bis ×1.4. Er ändert nie, wie viel eine
              Sportart grundsätzlich wert ist — nur, ob dein heutiges
              Training über oder unter dem Üblichen lag.
            </p>
            <p>
              Kurz: MET setzt den Preis der Sportart, der Puls bewertet
              deine Tagesleistung.
            </p>
          </Detail>

          <Detail summary="Woher kommen meine Aktivitäten?">
            <p>
              Automatisch aus Strava, sobald du eine Aktivität speicherst.
              Einmal verbinden genügt.
            </p>
            <p>
              Von Hand eintragen geht auch — solche Einträge zählen aber
              erst, wenn die Mehrheit der Gruppe sie bestätigt.
            </p>
          </Detail>

          <Detail summary="Ich bin krank oder in den Ferien">
            <p>
              Melde es unter{" "}
              <Link href="/gruppe" className="underline underline-offset-2">
                Gruppe → Deine Teilnahme
              </Link>
              . Dein Deckel sinkt anteilig ab dem Meldetag: an Tag 3 von{" "}
              {periodDays} riskierst du noch 3/{periodDays}.
            </p>
            <p>Früh melden lohnt sich, rückdatieren geht nicht.</p>
          </Detail>

          <Detail summary="Mein Puls stimmt nicht mit anderen überein">
            <p>
              Trage Ruhepuls und Maximalpuls im{" "}
              <Link href="/gruppe" className="underline underline-offset-2">
                Profil
              </Link>{" "}
              ein — dann wird relativ zu dir gemessen statt nach
              Standardwerten. Beide Werte nötig, sonst zählt keiner.
            </p>
            <p>Ohne Pulsmessung gilt ×1.0. Kein Nachteil.</p>
          </Detail>

          <Detail summary="Warum ist Gym pro Minute so tief?">
            <p>
              Weil bei GPS-Sportarten nur die Bewegungszeit zählt — eine
              Golfrunde steht mit ihrer Gehzeit drin, nicht mit vier Stunden.
              Im Gym landet die ganze Session inklusive Satzpausen in der
              Zeit.
            </p>
            <p>
              Pausen sind trotzdem kein Problem: auffällig wird erst, wenn
              von zwei Stunden kaum echte Arbeit übrig bleibt.
            </p>
          </Detail>

          {handicap?.enabled && (
            <Detail summary="Was ist die Staffelung?">
              <p>
                Damit niemand davonzieht, zählen Punkte mit steigender Zahl
                weniger — wie Steuerstufen. Die ersten {handicap.bracket}{" "}
                zählen voll.
              </p>
              <ul>
                {[1, 2, 4].map((m) => {
                  const roh = handicap.bracket * m;
                  return (
                    <li key={roh} className="flex items-baseline">
                      <span>{roh} erarbeitet</span>
                      <span className="leader" aria-hidden="true" />
                      <span className="num">
                        {applyHandicap(roh, handicap).toFixed(1)} zählen
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Detail>
          )}

          <Detail summary="Wer bestimmt die Regeln?">
            <p>
              Admins unter Gruppe → Regeln. Änderungen gelten ab der
              nächsten Periode, damit niemand die Regeln ändert, während er
              zurückliegt.
            </p>
            <p>
              Ist die Gruppe einig, kann ein Admin sie mit „Regeln sofort
              anwenden“ auch für die laufende Periode übernehmen.
            </p>
          </Detail>

          <Detail summary="Und am Ende?">
            <p>
              Beträge werden eingefroren und wandern ins Archiv, wo ihr
              abhakt, wer gezahlt hat. Dann geht ihr essen.
            </p>
          </Detail>
        </div>
      </Sheet>
    </div>
  );
}
