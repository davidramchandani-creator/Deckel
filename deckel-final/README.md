# Deckel

Team-Lauf-Challenge. Wer hinter dem Besten liegt, zahlt die Differenz in
einen gemeinsamen Topf -- und der finanziert am Ende ein Team-Essen.

---

## Die Regeln

| Aktivität | Umrechnung |
|---|---|
| 1 km Laufen | 1.00 Punkt |
| 1 km Velo | 0.25 Punkte (konfigurierbar: 0.20 / 0.25 / 0.30) |

Gezählt werden nur `Run`, `TrailRun`, `VirtualRun` (Lauf) und `Ride`,
`VirtualRide`, `GravelRide`, `MountainBikeRide` (Velo). Alles andere wird
ignoriert.

**Abrechnung nach dem Differenzprinzip:**

```
rekord    = max(punkte) über alle nicht-abgemeldeten Teilnehmer
schuld(p) = min(deckel(p), max(0, rekord - punkte(p)))
```

Der Rekordhalter zahlt 0. Standard-Deckel: CHF 15.— pro Person und Periode.
Der Topf ist die Summe aller Schulden.

**Status pro Teilnehmer**

| Status | Wirkung |
|---|---|
| `aktiv` | Voller Deckel, zählt beim Rekord mit |
| `krank` | Deckel anteilig gekürzt, zählt beim Rekord weiter mit |
| `abgemeldet` | Zahlt nichts, zählt **nicht** beim Rekord mit |

Anteiliger Deckel bei Krankheit: `(meldetag / periodenlänge) * deckel`.
Beispiel: Krankmeldung an Tag 3 einer 14-Tage-Periode → 3/14 × 15 = CHF 3.21.

**Missbrauchsschutz — in der Datenbank erzwungen, nicht nur dokumentiert:**

- Der Meldetag wird serverseitig aus `current_date` und dem Periodenstart
  berechnet (`report_sick`). Rückdatieren ist nicht möglich.
- Abmeldung ist nur **vor** Periodenstart möglich; `withdraw_from_period`
  wirft sonst eine Exception. Läuft die Periode, bleibt nur `krank`.
- Jede Statusänderung landet mit Zeitstempel im `status_log`.
- Clients können `members`, `participations`, `activities` und
  `settlements` **nicht direkt** schreiben — es gibt keine INSERT/UPDATE
  Policies. Alle Schreibpfade laufen über `security definer` RPCs.

---

## Setup

### 1. Abhängigkeiten

```bash
npm install
```

### 2. Supabase

Das Schema ist bereits auf dem Projekt **Pace or Pay**
(`jxdruuixudiygzohwmxb`, eu-west-1) angewendet. Für ein frisches Projekt:
die Migrationen in der Supabase-Konsole in dieser Reihenfolge ausführen —
`initial_schema`, `rls_and_rpcs`, `tighten_function_grants`,
`fix_helper_function_grants`, `create_group_starts_first_period`,
`strava_webhook_events_queue`, `mark_settlement_paid_rpc`.

Danach unter **Authentication → URL Configuration** die Redirect-URL
`https://DEINE-DOMAIN/auth/callback` eintragen (und für lokal
`http://localhost:3000/auth/callback`), sonst schlägt der Magic Link fehl.

### 3. Strava-App registrieren

Auf <https://www.strava.com/settings/api> eine App anlegen.

- **Authorization Callback Domain**: nur die nackte Domain, keine URL.
  Lokal `localhost`, produktiv z.B. `deckel.vercel.app`.
- Client ID und Client Secret notieren.

### 4. Umgebungsvariablen

`.env.example` nach `.env.local` kopieren und füllen:

| Variable | Woher | Wo eintragen |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → Data API → Project URL | Vercel: alle Envs |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → publishable/anon | Vercel: alle Envs |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → **secret/service_role** | Vercel: **nur** Production/Preview, niemals mit `NEXT_PUBLIC_` |
| `STRAVA_CLIENT_ID` | Strava API-Seite | Vercel: alle Envs |
| `STRAVA_CLIENT_SECRET` | Strava API-Seite | Vercel: alle Envs |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | frei wählbar, z.B. `openssl rand -hex 16` | Vercel: alle Envs |
| `NEXT_PUBLIC_APP_URL` | die eigene URL, ohne Slash am Ende | Vercel: alle Envs |
| `CRON_SECRET` | frei wählbar, z.B. `openssl rand -hex 32` | Vercel: alle Envs |

> Der Service-Role-Key umgeht Row Level Security vollständig. Er darf
> ausschliesslich serverseitig verwendet werden und niemals das
> `NEXT_PUBLIC_` Präfix bekommen.

### 5. Lokal starten

```bash
npm run dev     # http://localhost:3000
npm test        # Regel-Engine (21 Tests)
npm run build   # Produktionsbuild
```

---

## Strava-Webhook registrieren

Die App muss **erst deployt** sein — Strava validiert die Callback-URL
sofort und erwartet innert 2 Sekunden eine Antwort.

```bash
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id=DEINE_CLIENT_ID \
  -F client_secret=DEIN_CLIENT_SECRET \
  -F callback_url=https://DEINE-DOMAIN/api/strava/webhook \
  -F verify_token=DEIN_WEBHOOK_VERIFY_TOKEN
```

Erfolg sieht so aus: `{"id": 123456}`.

Bestehende Subscription ansehen (es ist nur **eine pro App** erlaubt):

```bash
curl -G https://www.strava.com/api/v3/push_subscriptions \
  -d client_id=DEINE_CLIENT_ID -d client_secret=DEIN_CLIENT_SECRET
```

Löschen:

```bash
curl -X DELETE "https://www.strava.com/api/v3/push_subscriptions/SUB_ID?client_id=...&client_secret=..."
```

Falls die Registrierung fehlschlägt, ist fast immer die Callback-Validierung
schuld. Direkt testen:

```bash
curl "https://DEINE-DOMAIN/api/strava/webhook?hub.verify_token=DEIN_TOKEN&hub.challenge=test123&hub.mode=subscribe"
# erwartet: {"hub.challenge":"test123"}
```

---

## Architektur-Entscheide

**Scope `activity:read_all` statt `activity:read`.** Der Build-Prompt sah
`activity:read` vor. Laut Strava-Doku bekommt eine App mit diesem Scope
aber ein *delete*-Event, sobald eine Aktivität auf "Only You" gestellt wird
— der Lauf verschwindet dann kommentarlos aus der Wertung. Genau das ist
der Streitfall, den die App vermeiden soll. Wer mitmacht, will seine
Kilometer gezählt haben; auf Stravas Zustimmungsseite ist transparent
sichtbar, was freigegeben wird, und der Zugriff lässt sich jederzeit
widerrufen.

**Webhook-Inbox statt Direktverarbeitung.** Strava verlangt ein `200`
innert 2 Sekunden und gibt nach 3 Versuchen endgültig auf. Ein
API-Roundtrip zu Strava passt nicht zuverlässig in dieses Fenster. Der
Handler schreibt darum nur die Rohdaten in `strava_webhook_events`,
antwortet, und verarbeitet danach via `after()`. Der nächtliche Cron
(`/api/cron/sync`) kehrt alles auf, was liegen geblieben ist, und gleicht
zusätzlich alle Aktivitäten der laufenden Periode ab. Ein Cold Start oder
Absturz kann so keinen Lauf verschlucken.

**Regel-Engine ohne I/O.** `lib/rules.ts` enthält reine Funktionen, keine
Datenbank, kein Netzwerk. Das ist der Teil, über den die Gruppe sonst
streitet, also ist er isoliert testbar (21 Tests, alle Fälle aus dem
Spec).

**`settings_snapshot` pro Periode.** Die Abrechnung liest immer den
eingefrorenen Snapshot der Periode, nie die aktuellen Gruppeneinstellungen.
Eine Regeländerung wirkt ab der nächsten Periode und kann rückwirkend nichts
verändern.

**Next.js 15, nicht 16.** Unter Next 16 zeigte der Build ein
Static-Rendering-Verhalten, das sich nicht zweifelsfrei als sicher
verifizieren liess. Bei einer App, die Geldbeträge anzeigt, ist die
stabile Version die richtige Wahl.

---

## Cron Jobs

In `vercel.json` konfiguriert, laufen automatisch nach dem Deploy:

| Route | Zeit | Zweck |
|---|---|---|
| `/api/cron/sync` | 03:00 | Webhook-Inbox leeren, Aktivitäten abgleichen |
| `/api/cron/close-periods` | 00:15 | Abgelaufene Perioden abrechnen, einfrieren, Folgeperiode starten |

Beide sind mit `CRON_SECRET` geschützt und antworten ohne gültigen
`Authorization: Bearer`-Header mit `401`.

---

## Projektstruktur

```
app/
  (app)/              # eingeloggter Bereich, force-dynamic
    page.tsx          # Rangliste
    aktivitaeten/     # eigene Aktivitäten, Status, manueller Eintrag
    gruppe/           # Mitglieder, Einladungscode, Regeln
    archiv/           # abgeschlossene Perioden, bezahlt-Häkchen
  api/
    strava/           # authorize, callback, webhook
    cron/             # sync, close-periods
  login/              # Magic Link
lib/
  rules.ts            # Regel-Engine (rein, getestet)
  settlement.ts       # lädt Periode + berechnet Rangliste
  strava/             # OAuth, API-Client, Event-Verarbeitung
  supabase/           # client / server / server-admin
```
