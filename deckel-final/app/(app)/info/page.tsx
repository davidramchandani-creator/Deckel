import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/active-group";
import { Sheet, SectionLabel, Line } from "@/components/receipt";
import {
  SPORTS_CATALOG,
  sportsFromSnapshot,
  handicapFromSnapshot,
  applyHandicap,
  type SportDef,
} from "@/lib/sports";
import type { Period } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Die Spielregeln, vollstaendig und in ganzen Saetzen.
 *
 * Der Explainer auf der Rangliste ist die Kurzfassung fuer zwischendurch.
 * Diese Seite ist die Langfassung: warum es die Regel gibt, nicht nur was
 * sie tut. Wo moeglich mit den echten Werten der eigenen Gruppe -- eine
 * Erklaerung mit fremden Zahlen ueberzeugt niemanden.
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
  const cap = snapshot ? Number(snapshot.cap_chf) : null;
  const periodDays = snapshot?.period_days ?? null;
  const currency = snapshot?.currency ?? "CHF";

  const zeitSportarten = sports.filter((s) => s.unit === "min");
  const distanzSportarten = sports.filter((s) => s.unit === "km");

  const geld = (n: number) => `${currency} ${n.toFixed(2)}`;

  return (
    <div className="space-y-5">
      <Sheet className="perforated-top">
        <h1 className="text-lg font-medium mb-1">Wie Pace or Pay funktioniert</h1>
        <p className="text-sm text-ink-soft leading-relaxed">
          Ihr treibt {periodDays ? `${periodDays} Tage lang` : "eine Periode lang"}{" "}
          Sport und vergleicht euch. Wer zurückliegt, zahlt in einen
          gemeinsamen Topf — und der finanziert am Ende ein Essen zusammen.
          Es geht nicht ums Gewinnen, sondern darum, dass niemand die Woche
          verstreichen lässt.
        </p>
      </Sheet>

      <Sheet>
        <SectionLabel>Punkte sammeln</SectionLabel>
        <div className="text-sm text-ink-soft space-y-3 leading-relaxed">
          <p>
            Jede Aktivität wird in Punkte umgerechnet. Der Grundsatz hinter
            allen Sätzen: <em>eine Stunde ehrlicher Sport soll überall
            ungefähr gleich viel wert sein.</em> Massstab dafür ist der
            Energieverbrauch der Sportart (der sogenannte MET-Wert, ein
            publizierter Standard der Sportwissenschaft). Laufen ist der
            Anker mit 1 Punkt pro Kilometer — alle anderen Sätze sind
            darauf umgerechnet.
          </p>
          <p>
            Deshalb bringt eine Stunde Squash mehr als eine Stunde Yoga, und
            ein Kilometer Schwimmen viel mehr als ein Kilometer Velo: nicht
            weil eine Sportart „besser“ wäre, sondern weil sie pro Stunde
            mehr Energie kostet.
          </p>

          {distanzSportarten.length > 0 && (
            <div>
              <p className="text-ink font-medium mb-1">Nach Distanz</p>
              <ul>
                {distanzSportarten.map((sp) => (
                  <li key={sp.key} className="flex items-baseline">
                    <span>{sp.label}</span>
                    <span className="leader" aria-hidden="true" />
                    <span className="num">{sp.rate} P/km</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5">
                Hier zählen nur die Kilometer, nicht das Tempo. Ein lockerer
                Regenerationslauf bringt gleich viel wie ein harter — genau
                so soll es sein, denn Erholungstraining ist Teil eines
                vernünftigen Plans.
              </p>
            </div>
          )}

          {zeitSportarten.length > 0 && (
            <div>
              <p className="text-ink font-medium mb-1">Nach Zeit</p>
              <ul>
                {zeitSportarten.map((sp) => (
                  <li key={sp.key} className="flex items-baseline">
                    <span>{sp.label}</span>
                    <span className="leader" aria-hidden="true" />
                    <span className="num">{sp.rate} P/min</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5">
                Hier gibt es keine Kilometer, also zählt die Dauer. Das
                allein wäre aber ungenau — zwei Stunden im Gym mit viel
                Herumstehen sind nicht dasselbe wie zwei Stunden Arbeit.
                Darum kommt der Anstrengungsfaktor dazu.
              </p>
              <p className="mt-1.5">
                Noch ein Detail, das die Sätze erklärt: bei Sportarten mit
                GPS zählt Strava nur die <em>Bewegungszeit</em> — eine
                Golfrunde steht mit ihrer Gehzeit drin, nicht mit vier
                Stunden. Im Gym gibt es nichts zu erkennen, dort landet die
                ganze Session inklusive Pausen in der Zeit. Deshalb wirkt
                der Gym-Satz pro Minute tiefer, als er sich anfühlt: die
                Pausen stecken schon in den Minuten.
              </p>
            </div>
          )}
        </div>
      </Sheet>

      <Sheet>
        <SectionLabel>Der Anstrengungsfaktor</SectionLabel>
        <div className="text-sm text-ink-soft space-y-3 leading-relaxed">
          <p>
            Bei Sportarten, die nach Zeit zählen, wird der Ø-Puls der
            Einheit mit einbezogen. Die Punkte werden je nach Anstrengung
            mit einem Faktor zwischen 0.7 und 1.4 multipliziert.
          </p>

          <div>
            <p className="text-ink font-medium mb-1">
              Verglichen wird mit derselben Sportart
            </p>
            <p>
              Ein absoluter Pulswert wäre unfair. In dieser Gruppe lag der
              mittlere Ø-Puls bei Krafttraining bei 96, bei Golf bei 107 und
              bei Fussball bei 147. Golf liegt also über Kraftsport — nicht
              weil es anstrengender wäre, sondern weil Golf durchgehendes
              Gehen ist und Krafttraining aus kurzen, schweren Sätzen mit
              Pausen besteht.
            </p>
            <p className="mt-1.5">
              Deshalb wird jede Einheit mit dem Normalwert{" "}
              <em>ihrer eigenen Sportart</em> verglichen — nie mit einer
              anderen Sportart. Ein Beispiel: Tim spielt Fussball mit Puls
              147 — für Fussball ganz normal, Faktor 1.0. Dave macht
              Krafttraining mit Puls 96 — für Krafttraining ganz normal,
              auch Faktor 1.0. Beide waren also gleich hart unterwegs,
              obwohl ihre Pulswerte 50 Schläge auseinanderliegen. Der Puls
              beantwortet immer nur: „War das eine harte oder eine lockere
              Einheit für mich in dieser Sportart?“ — nie „Ist Fussball mehr
              wert als Krafttraining?“
            </p>
            <p className="mt-1.5">
              Ob eine Stunde Fussball am Ende mehr Punkte bringt als eine
              Stunde Krafttraining, entscheidet einzig der Satz oben (P/min)
              — und den stellt die Gruppe selbst ein.
            </p>
          </div>

          <div>
            <p className="text-ink font-medium mb-1">Pausen sind kein Problem</p>
            <p>
              Bestraft wird nicht, dass du Pausen machst — jedes vernünftige
              Krafttraining hat welche, und sie sind Teil des Trainings.
              Auffällig wird erst, wenn der Schnitt über die ganze Einheit
              weit unter dem liegt, was für diese Sportart normal ist. Also
              wenn von zwei Stunden nur wenig echte Arbeit übrig bleibt.
            </p>
          </div>

          <div>
            <p className="text-ink font-medium mb-1">Ruhepuls & Maximalpuls</p>
            <p>
              Wer beide Werte im Profil hinterlegt, wird relativ zur eigenen
              Herzfrequenzreserve gemessen. Das ist fairer, weil ein tiefer
              Ruhepuls sonst wie geringe Anstrengung aussähe, obwohl er das
              Gegenteil bedeutet. Ohne Profil gelten Standardannahmen
              (Ruhepuls 60, Maximalpuls 190) — dann wird es ungenauer, aber
              niemand fällt raus.
            </p>
            <p className="mt-1.5">
              <Link href="/gruppe" className="underline underline-offset-2">
                Im Profil eintragen
              </Link>
            </p>
          </div>

          <div>
            <p className="text-ink font-medium mb-1">Ohne Pulsmessung</p>
            <p>
              Fehlt der Puls ganz — kein Gurt dabei, keine Uhr, oder von Hand
              eingetragen — gilt Faktor 1.0. Weder Bonus noch Strafe.
            </p>
          </div>
        </div>
      </Sheet>

      <Sheet>
        <SectionLabel>Was du zahlst</SectionLabel>
        <div className="text-sm text-ink-soft space-y-3 leading-relaxed">
          <p>
            Massgebend ist dein Rückstand auf die beste Person, im
            Verhältnis. Wer vorne liegt, zahlt nichts. Wer gar nichts macht,
            zahlt den vollen Deckel{cap != null ? ` von ${geld(cap)}` : ""}.
            Alle dazwischen zahlen anteilig: bei halbem Rückstand den halben
            Deckel.
          </p>
          {cap != null && (
            <div>
              <Line left="Gleichauf mit der Spitze" right={geld(0)} />
              <Line left="Halber Rückstand" right={geld(cap / 2)} />
              <Line left="Gar nichts gemacht" right={geld(cap)} />
            </div>
          )}
          <p>
            Diese anteilige Rechnung ist Absicht. Früher galt „Rückstand,
            höchstens Deckel“ — wer weit hinten lag, konnte den Betrag durch
            Training nicht mehr senken und hatte damit keinen Grund mehr,
            überhaupt loszulaufen. Jetzt ist jeder Punkt etwas wert, bis zum
            letzten Tag.
          </p>
        </div>
      </Sheet>

      {handicap?.enabled && (
        <Sheet>
          <SectionLabel>Staffelung</SectionLabel>
          <div className="text-sm text-ink-soft space-y-2 leading-relaxed">
            <p>
              Damit sich niemand absetzen kann, zählen Punkte mit steigender
              Zahl weniger — wie Steuerstufen. Die ersten {handicap.bracket}{" "}
              Punkte zählen voll, danach wird es stufenweise zäher.
            </p>
            <div>
              {[1, 2, 4].map((m) => {
                const roh = handicap.bracket * m;
                return (
                  <Line
                    key={roh}
                    left={`${roh} Punkte erarbeitet`}
                    right={`${applyHandicap(roh, handicap).toFixed(1)} zählen`}
                  />
                );
              })}
            </div>
            <p>
              Mehr Aufwand bringt trotzdem immer mehr — nur nicht mehr im
              gleichen Tempo.
            </p>
          </div>
        </Sheet>
      )}

      <Sheet>
        <SectionLabel>Woher die Aktivitäten kommen</SectionLabel>
        <div className="text-sm text-ink-soft space-y-3 leading-relaxed">
          <p>
            Normalerweise automatisch aus Strava: sobald du eine Aktivität
            speicherst, meldet Strava sie hierher und sie erscheint in der
            Rangliste. Dafür musst du Strava einmal verbinden.
          </p>
          <p>
            Von Hand eintragen geht auch — aber solche Einträge zählen erst,
            wenn die Mehrheit der anderen sie bestätigt hat. Strava-Einträge
            sind vertrauenswürdig, weil ein Gerät sie aufgezeichnet hat;
            getippte Einträge verbürgt stattdessen die Gruppe.
          </p>
          <p>
            Aktivitäten in Sportarten, die gerade nicht zählen, gehen nicht
            verloren. Sie werden gespeichert und mit 0 Punkten geführt.
            Schaltet ein Admin die Sportart später frei, sind sie noch da.
          </p>
        </div>
      </Sheet>

      <Sheet>
        <SectionLabel>Ferien, Krankheit, Aussetzen</SectionLabel>
        <div className="text-sm text-ink-soft space-y-3 leading-relaxed">
          <p>
            Wer krank wird oder in die Ferien geht, meldet das unter{" "}
            <Link href="/gruppe" className="underline underline-offset-2">
              Gruppe → Deine Teilnahme
            </Link>
            . Der Deckel sinkt dann anteilig ab dem Meldetag: Wer an Tag 3
            von 14 meldet, riskiert noch 3/14 des vollen Betrags.
          </p>
          <p>
            Der Meldetag kommt vom Server, nicht vom Gerät — rückdatieren
            ist nicht möglich. Und früh melden lohnt sich: je später, desto
            weniger bringt es.
          </p>
          <p>
            Wer eine Periode ganz aussetzt, zahlt nichts, zählt dafür aber
            auch nicht mit — auch nicht für den Rekord.
          </p>
        </div>
      </Sheet>

      <Sheet>
        <SectionLabel>Regeln ändern</SectionLabel>
        <div className="text-sm text-ink-soft space-y-3 leading-relaxed">
          <p>
            Admins stellen unter Gruppe → Regeln ein, welche Sportarten
            zählen und zu welchem Satz. Es gibt{" "}
            {SPORTS_CATALOG.length} Sportarten zur Auswahl.
          </p>
          <p>
            Änderungen gelten ab der nächsten Periode. Die laufende
            Abrechnung bleibt eingefroren — sonst könnte man die Regeln
            ändern, während man zurückliegt. Wenn die Gruppe sich einig ist,
            kann ein Admin sie mit „Regeln sofort anwenden“ trotzdem für die
            laufende Periode übernehmen.
          </p>
        </div>
      </Sheet>

      <Sheet>
        <SectionLabel>Am Ende der Periode</SectionLabel>
        <div className="text-sm text-ink-soft space-y-2 leading-relaxed">
          <p>
            Die Beträge werden eingefroren und wandern ins Archiv. Dort hakt
            ihr ab, wer schon gezahlt hat. Alle Beträge zusammen sind der
            Topf — und dann geht ihr essen.
          </p>
        </div>
      </Sheet>

      <Sheet>
        <SectionLabel>Kurz gesagt</SectionLabel>
        <div className="text-sm text-ink-soft leading-relaxed">
          <p>
            Beweg dich regelmässig, dann zahlst du wenig. Beweg dich gar
            nicht, zahlst du den Deckel. Und wenn du gerade nicht kannst,
            sag es früh — dafür gibt es den Ferienmodus.
          </p>
        </div>
      </Sheet>
    </div>
  );
}
