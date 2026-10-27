# Freizeit

Was in Hamburg und Umgebung los ist – die nächsten gut fünf Wochen, mit den
Konzerten von Tobis Lieblingskünstlern mittendrin, im Kalender und auf der
Karte –, dazu ein Katalog mit Ideen für alles ohne Termin, sortiert danach,
was eine Aktivität bringt (Flow, Bewegung, Erholung, Produktiv). Und
gemeinsam geplant: Wer Bock auf etwas hat, hakt es an, die anderen sehen es.

**Adresse:** <https://finanzdienste.github.io/Freizeit/>
(Android: in Chrome öffnen, Menü ⋮ → „App installieren“; iPhone: in Safari
öffnen, Teilen → „Zum Home-Bildschirm“).

Fünf Reiter:

| Reiter | Inhalt |
| --- | --- |
| **Programm** | Woche für Woche zum Blättern: Highlights, Filter, Tag für Tag nach Uhrzeit (Eingeplantes oben am Tag), was gerade läuft, Hinweise. Nach dem Ende des Programms nur noch Konzerte der eigenen Künstler und Eingeplantes |
| **Kalender** | Monatsblatt mit der Zahl der Termine je Tag und farbigen Punkten, wer Bock hat; darunter der gewählte Tag |
| **Karte** | OpenStreetMap, ein Marker je Ort (nahe zu Haufen zusammengefasst), Zeiträume von „Heute“ bis „Alles“ und „Mit Bock“, mit „💡 Ideen“ auch die Orte aus dem Ideen-Katalog |
| **Ideen** | Alles ohne Termin: Eingeplantes, „Wollen wir mal“ (Ideen mit Bock), „Tut dir gut“, Filter nach Wirkung und Rahmen, der Katalog nach Kategorien, eigene Ideen |
| **Wir** | Der gemeinsame Plan: Treffer (ihr beide habt Bock), alle Haken mit Namen, Einladen, Name ändern, Verlassen. Ohne Plan die eigene Bock-Liste |

Jeder Eintrag hat **Bock** (Haken), **WhatsApp** (fertige Nachricht: Titel,
Datum und Uhrzeit, Ort, Beschreibung, Preis, Anreise, Link), **Kalender**
(auf dem iPhone eine .ics-Datei für den Kalender des Geräts, sonst ein
ausgefüllter Termin in Google Kalender) und die **Quelle**. Konzerte der
eigenen Künstler tragen „♫ Dein Künstler“, der Filter „♫ Meine Künstler“
zeigt nur sie.

## Die beiden Zeitregeln

**Mo–Fr ab 15:30** ist ein Filter zum Einschalten: An Werktagen bleibt nur,
was nach Feierabend noch geht – Beginn ab 15:30, ein Zeitraum bis mindestens
17:00, ein offenes „ab …“, Ganztägiges. Wochenende und Feiertage bleiben
ungefiltert.

**Bis 21:30** ist immer an: Abends vor einem Arbeitstag (So–Do, außer vor
einem Feiertag) steht nur, was spätestens um 21:30 endet. Das Ende kommt aus
`ende`, aus einem Zeitraum in `zeit`, sonst aus `dauer`, einer Dauer in der
Beschreibung („ca. 2:15 Std.“, „ca. 90 Minuten“) oder einem Richtwert je
Kategorie (Konzert 2:15, Bühne 2:30, Comedy 2:15, Film 2:10 …). Märkte, Feste
und Ausstellungen sind zum Kommen und Gehen – dort reicht ein Beginn bis
20:30. Wie viele Termine die Regel an einem Abend ausblendet, steht beim Tag.
**Für Konzerte der eigenen Künstler (`kuenstler: true`) gilt sie nicht.**

Gerechnet wird in `js/zeit.js` und `js/filter.js`, geprüft in
`tests/test-programm.mjs`.

## Ideen

Der Katalog `daten/ideen.json` ist von Hand gepflegt (rund 150 Ideen, Stand
Oktober 2026) und ändert sich nicht mit dem Montagslauf. Jede Idee hat eine
Kategorie, eine **Wirkung** und einen Rahmen:

- **⚡ Flow** – fordert Können, hat ein klares Ziel und gibt sofort
  Rückmeldung; die Zeit verfliegt. Flow-Ideen bringen meist ein konkretes
  **Ziel** mit („Zählt eure längste Ballwechsel-Serie …“) – ein klares Ziel
  senkt die Hürde, anzufangen.
- **Bewegung**, **Erholung**, **Produktiv** (man lernt oder schafft etwas).
- Rahmen: Zuhause / Hamburg / Ausflug, drinnen / draußen, Dauer, mit wem,
  kostenlos, Saison (außerhalb der Saison erst auf Wunsch sichtbar).

Gefiltert wird mit Schaltern; mehrere Wirkungen müssen alle zutreffen. Bei
Ideen mit Ort stehen die Orte mit Link, Preis und Zeiten dabei, auf der
Karte als gestrichelte Marker.

**Einplanen** macht aus einer Idee einen Termin an einem Tag (bei mehreren
Orten mit Wahl des Orts): Er steht im Programm, im Kalender und auf der
Karte, mit WhatsApp- und Kalender-Knopf, und im gemeinsamen Plan bei allen.
**Gemacht** fragt „Wie war's?“ (😐 naja, 🙂 gut, 😄 super) und ob die Zeit
verflogen ist; nach einem eingeplanten Tag fragt die App von selbst. Daraus
wird **„Tut dir gut“** – vorn, was im Schnitt am besten war und öfter Flow
brachte. Dieser Verlauf bleibt nur auf dem Gerät (`verlauf` im
localStorage), er geht an keinen Server.

**Eigene Ideen** legt man mit „+ Eigene Idee“ an. Wie Eingeplantes sind sie
Bock-Haken mit Schnappschuss – im gemeinsamen Plan sehen alle sie, ohne dass
der Server etwas Neues können muss. Eine eigene Idee gibt es, solange jemand
Bock darauf hat.

Schlüssel der Bock-Haken: `i:<id>` Idee aus dem Katalog (dieselben
Kennungen wie früher „Geht immer“), `e:<zufall>` eigene Idee,
`p:<tag>:<Schlüssel der Idee>` eingeplant.

## Gemeinsam planen

Ein Plan ist ein Raum mit einem zufälligen Code (`abcd-efgh-jkmn`, 12 Zeichen
ohne Verwechsler). Wer „Plan starten“ tippt, bekommt einen Link
`…/Freizeit/#einladung=<code>` zum Verschicken; der Code steht hinter `#` und
geht deshalb an keinen Server. Wer den Link öffnet, gibt einen Namen ein und
ist drin.

**iPhone:** Die App auf dem Home-Bildschirm hat einen eigenen Speicher,
getrennt von Safari – sie kennt den Link nicht. Deshalb zeigt die Einladung
in Safari den Weg zum Home-Bildschirm und den Code; in der App fügt man ihn
unter „Wir“ ein. Wer mit einem Namen beitritt, den es im Raum schon gibt, ist
diese Person auf einem weiteren Gerät (dieselbe Kennung, dieselben Haken).

**Server:** das Supabase-Projekt der Workout-App (`js/config.js`). Die
Tabellen sind für den öffentlichen Schlüssel gesperrt; erreichbar sind nur
vier Funktionen, und jede will den Code. Einrichten: einmal den Block aus
[`supabase/gemeinsam.sql`](supabase/gemeinsam.sql) in *Supabase → SQL
Editor* einfügen und ausführen (der Block ist wiederholbar). Geprüft wird er
ohne Supabase in `tests/test-sql.mjs` (PGlite). Grenzen: 6 Personen und 3000
Haken je Raum, 100 Räume, 30000 Haken insgesamt, 2000 Byte je Schnappschuss.

**In der App:** Eigene Haken gelten sofort und stehen im localStorage; im Plan
gehen sie über eine Warteschlange zum Server – ohne Netz warten sie dort. Der
Abgleich läuft nach jedem Haken, beim Öffnen, beim Zurückkommen in die App
und jede Minute. Für die eigenen Haken gilt danach der Server. Ein Haken
trägt einen Schnappschuss des Eintrags mit sich (Titel, Tag, Ort, Link …),
damit er auch dann vollständig dasteht, wenn er aus den Daten gefallen ist.
Was von anderen kommt, ist fremder Text: Namen und Schnappschüsse gehen beim
Anzeigen durch `esc()`, Links nur mit http(s).

## Woher die Daten kommen

Die App ändert ihre Daten nie selbst. Der geplante Lauf
„Freizeit-Wochenplan Hamburg“ schreibt montags gegen 7 Uhr:

| Datei | Inhalt |
| --- | --- |
| `daten/programm.json` | Montag dieser Woche bis Sonntag in fünf Wochen, dazu die Konzerte der eigenen Künstler der nächsten zwölf Monate |
| `daten/orte.json` | Hilfe für den Lauf: Koordinaten je Ortsangabe, damit er bekannte Orte nicht jede Woche neu sucht. Die App liest sie nicht |

`daten/ideen.json` schreibt der Lauf nicht – der Katalog wird von Hand
gepflegt (Format unten).

Neue Releases und Song-Tipps schickt derselbe Lauf nur als Nachricht.

Der Lauf schreibt **nur diese beiden Dateien**, prüft sie mit
`node tests/test-daten.mjs` (ohne `npm ci`, nur Node) und committet sie
direkt auf `main` („Freizeit: Programm ab KW 45“). Die Daten stehen bewusst
nicht im Offline-Vorrat von `sw.js` – darum braucht ein Datenlauf weder eine
neue VERSION noch sonst eine Änderung am Code. GitHub Pages baut von `main`;
nach ein bis zwei Minuten steht die neue Datei unter
`https://finanzdienste.github.io/Freizeit/daten/programm.json`.

### `daten/programm.json`

```json
{
  "version": 2,
  "stand": "2026-11-02T07:40",
  "von": "2026-11-02",
  "bis": "2026-12-06",
  "infos": [{ "titel": "Feiertag", "text": "…" }],
  "highlights": [{ "titel": "Sa 7.11.: …", "text": "…" }],
  "tage": [
    { "datum": "2026-11-02", "wetter": "Hamburg 12°/9°, bewölkt", "wetterOstsee": "Kiel 11°/8°, Regen", "tipp": "Viele Museen haben montags zu." },
    { "datum": "2026-11-03" }
  ],
  "termine": [
    {
      "id": "die-odyssee-kinopolis-hafencity",
      "daten": ["2026-11-02", "2026-11-04"],
      "zeit": "19:00",
      "zeiten": { "2026-11-04": "20:15" },
      "ende": "22:10",
      "titel": "Die Odyssee",
      "ort": "Kinopolis HafenCity",
      "geo": [53.54123, 9.99872],
      "region": "HH",
      "kategorie": "Kino",
      "beschreibung": "…",
      "preis": "ab 13,99 €",
      "draussen": "drinnen",
      "link": "https://…",
      "imdb": "64"
    },
    {
      "id": "the-war-on-drugs-barclays-arena-2027-01-15",
      "daten": ["2027-01-15"],
      "zeit": "19:30",
      "titel": "The War On Drugs",
      "ort": "Barclays Arena",
      "geo": [53.58931, 9.89911],
      "region": "HH",
      "kategorie": "Konzert",
      "kuenstler": true,
      "neu": true,
      "vorverkauf": "ab Fr 6.11., 10 Uhr",
      "link": "https://…"
    }
  ],
  "laufend": [
    { "id": "weihnachtsmarkt-rathausmarkt", "von": "2026-11-23", "bis": "2026-12-23", "zeit": "So–Do 11–21, Fr/Sa 11–22", "titel": "…", "ort": "Rathausmarkt", "geo": [53.5503, 9.9930], "region": "HH", "kategorie": "Fest & Saisonal", "kostenlos": true, "draussen": "draußen", "link": "https://…" }
  ],
  "hinweise": [{ "titel": "Abgesagt", "text": "…" }, { "text": "Quellen u. a.: …" }]
}
```

`von` ist ein Montag, `bis` ein Sonntag, dazwischen eine bis acht Wochen;
`tage` hat jeden Tag davon genau einmal.

**Termine** – Pflicht sind `id`, `titel`, `daten`, `zeit`, `region`,
`kategorie` und `link`; `tests/test-daten.mjs` prüft das und alles Weitere:

| Feld | Bedeutung |
| --- | --- |
| `id` | stabile Kennung, klein mit Bindestrichen; **gleiche Veranstaltung → gleiche `id`, auch im nächsten Lauf** – die Bock-Haken hängen an `id` und Tag |
| `daten` | Tage im Zeitraum `von`–`bis`, an denen der Termin stattfindet; Wiederholungen stehen an **jedem** ihrer Tage. Konzerte mit `kuenstler` oder `tipp` dürfen bis 400 Tage voraus liegen |
| `zeit` | Beginn `HH:MM` oder Zeitraum `HH:MM–HH:MM`; immer mit Doppelpunkt, sonst greifen die Zeitregeln nicht. Bei `ganztags` freier Text („Fr 14–22, Sa 10–22“) |
| `zeiten` | abweichende Uhrzeit je Tag, `{ "2026-11-04": "20:15" }`; zwei Vorstellungen: `"15:00 + 20:00"`. Nur für Tage aus `daten` |
| `ende` | Ende `HH:MM`, bekannt oder geschätzt (Film: Laufzeit + ca. 15 Min. Werbung) |
| `dauer` | Dauer in Minuten, wenn kein `ende` |
| `ganztags` | ganztägig (Messe, Markt über den Tag); steht oben im Tag |
| `geo` | `[Breite, Länge]` für die Karte – bei mindestens 80 % der Termine |
| `region` | `HH` Hamburg · `LUE` Lübeck & Ostsee · `LG` Lüneburg & Heide · `STD` Stade & Altes Land · `HB` Hohwachter Bucht & Kiel · `WEI` Weitere Ziele |
| `kategorie` | z. B. Konzert, Bühne, Comedy, Kino, Party, Sport, Führung, Erlebnis, Food, Markt, Fest & Saisonal, Ausstellung |
| `draussen` | `drinnen`, `draußen` oder `beides` |
| `kostenlos` | `true`, wenn der Eintritt frei ist |
| `hohwacht` | `true`, wenn er sich mit einem Besuch in Hohwacht verbinden lässt (Region `HB` zählt automatisch) |
| `anreise` | bei Zielen außerhalb Hamburgs: Deutschlandticket und Auto |
| `unsicher` | warum eine Angabe nicht sicher ist; wird rot markiert |
| `imdb` | Platz in der IMDb Top 250 (Text, z. B. `"64"`) |
| `kuenstler` | `true` bei Konzerten der eigenen Künstler (Kategorie Konzert); für sie gilt die 21:30-Regel nicht |
| `neu` | in den letzten 7 Tagen angekündigt |
| `ausverkauft` | `true`, wenn ausverkauft |
| `vorverkauf` | Vorverkaufsstart als Text, „ab Fr 6.11., 10 Uhr“ |
| `tipp` | kein eigener Künstler, passt aber zum Geschmack |

**Laufend** – was über Tage oder Wochen läuft (Ausstellungen, Musicals im
Dauerbetrieb, Weihnachtsmärkte, Saison im Freizeitpark): `von`, `bis`, `zeit`
als Text mit den Öffnungs- bzw. Vorstellungszeiten, sonst wie Termine. Steht
im Programm unter „Läuft gerade“, nicht an jedem Tag einzeln.

**Tage:** `feiertag: true` an gesetzlichen Feiertagen (dann gelten weder der
15:30-Filter noch die 21:30-Regel für den Vorabend). `vorFeiertag: true` am
Sonntag, wenn der Montag danach ein Feiertag ist.

**Immer** – Ausflugsziele unabhängig von Terminen schrieben die Läufe bis
Oktober 2026 als `immer` mit; sie stehen jetzt im Ideen-Katalog (dieselben
Kennungen). Steht in einer älteren Datei noch ein `immer`, das der Katalog
nicht kennt, zeigt der Reiter Ideen es trotzdem.

### `daten/ideen.json`

```json
{
  "version": 1,
  "stand": "2026-10-27",
  "ideen": [
    {
      "id": "tischtennis",
      "titel": "Tischtennis im Park",
      "kategorie": "sport",
      "text": "Schläger und Bälle einpacken und an eine öffentliche Platte …",
      "wirkung": ["flow", "bewegung"],
      "mit": ["zu zweit", "gruppe"],
      "wo": "hamburg",
      "draussen": "draußen",
      "dauer": "kurz",
      "kostenlos": true,
      "saison": [3, 4, 5, 6, 7, 8, 9, 10],
      "braucht": "Schläger und Bälle …",
      "ziel": "Zählt eure längste Ballwechsel-Serie und schlagt sie beim nächsten Mal.",
      "link": "https://pingpongmap.net/Hamburg",
      "orte": [
        { "name": "Hammer Park", "teil": "Hamm", "geo": [53.55871, 10.05939], "link": "https://…", "info": "zwei Plattenpaare …" }
      ]
    }
  ]
}
```

| Feld | Bedeutung |
| --- | --- |
| `id` | stabile Kennung, klein mit Bindestrichen – Bock-Haken und „Wie war's?“ hängen daran; **nie umbenennen** |
| `kategorie` | `sport`, `spiele`, `kreativ`, `genuss`, `natur`, `kultur`, `entspannen`, `lernen`, `ausflug` |
| `wirkung` | Liste aus `flow`, `bewegung`, `erholung`, `produktiv` (darf leer sein) |
| `mit` | Liste aus `allein`, `zu zweit`, `gruppe` |
| `wo` | `zuhause`, `hamburg` (auch Umland mit dem HVV) oder `ausflug` |
| `draussen` · `dauer` | `drinnen`/`draußen`/`beides` · `kurz` (bis 2 Std.)/`halbtags`/`ganztags` |
| `kostenlos` · `preis` | `true` · Text, z. B. „Tageskarte ca. 16–18 €“ |
| `saison` | Monate 1–12, in denen die Idee passt; ohne Feld das ganze Jahr |
| `ziel` | eine konkrete Herausforderung – bei Flow-Ideen als „⚡ Flow-Ziel“ |
| `braucht` · `zeiten` · `anreise` | Text; `anreise` ist Pflicht bei `wo: ausflug` |
| `hohwacht` | `true`, wenn sie zu einem Besuch in Hohwacht passt |
| `link` · `orte` | Info-Link; Orte mit `name`, `teil` (Stadtteil), `geo`, `link`, `info` |

## Aufbau

Wie die Workout-App: kein Bauschritt, ES-Module, eigener Service Worker
(`sw.js`, Vorrat `freizeit-v…`), eigener Speicher (`freizeit.stand.v1` im
localStorage). Leaflet 1.9.4 und Leaflet.markercluster 1.5.3 liegen unter
`vendor/leaflet/` (BSD-2 bzw. MIT, Lizenzen daneben) und im Offline-Vorrat;
nur die Kacheln von tile.openstreetmap.org brauchen Netz.

**Eigenes Repository, mit Absicht.** Bis zur ersten Fassung lag die App als
Ordner in der Workout-App (`/Workout/freizeit/`). Android rechnet aber alles
unterhalb der Adresse einer installierten App dieser App zu – Chrome meldete
„bereits installiert“ und legte keine eigene App an. Unter `/Freizeit/`
überschneiden sich die Bereiche nicht. Den Ursprung `finanzdienste.github.io`
teilen sich beide Apps trotzdem, also auch localStorage und den
Zwischenspeicher: Alles von hier beginnt mit `freizeit.` bzw. `freizeit-`,
und der Worker räumt nur seine eigenen Vorräte weg.

| Datei | Aufgabe |
| --- | --- |
| `js/app.js` | Einstieg, Reiter, Knöpfe, Abgleich, Service Worker |
| `js/zeit.js` | Datum, Uhrzeit, Wochen und Monate, beide Zeitregeln |
| `js/filter.js` | Filter, was an einem Tag steht, was gerade läuft |
| `js/daten.js` | Laden und Prüfen von `daten/programm.json`, Laden des Ideen-Katalogs |
| `js/ideen.js` | Ideen: Katalog prüfen, eigene und eingeplante Ideen, Filter, Saison, „Tut dir gut“ |
| `js/karte.js` | Einträge bauen und als Karte zeichnen (Bock, wer hat Bock) |
| `js/teilen.js` | WhatsApp-Nachricht, Google-Kalender-Link, .ics |
| `js/speicher.js` | Filter, eigene Haken mit Schnappschuss, Warteschlange, Verlauf „Wie war's?“ |
| `js/gemeinsam.js` | der gemeinsame Plan: Code, Beitreten, Abgleich mit Supabase |
| `js/config.js` | Adresse und öffentlicher Schlüssel des Servers |
| `js/ansicht-*.js` | die fünf Reiter |
| `supabase/gemeinsam.sql` | Tabellen und Funktionen für den gemeinsamen Plan |

## Tests

    npm ci                      # einmal: Playwright, ESLint, PGlite
    npm run lint
    node tests/lauf.mjs         # alle
    node tests/test-daten.mjs   # nur die Datendateien – braucht kein npm ci

| Test | prüft |
| --- | --- |
| `test-programm.mjs` | Wochen, beide Zeitregeln, Filter, Laufendes, Konzerte der eigenen Künstler |
| `test-kalender.mjs` | Monatsblatt, Zahlen, Bock-Punkte, Monate nach dem Programm |
| `test-landkarte.mjs` | Marker, Zeiträume, Liste am Marker, Haken aus der Karte |
| `test-wir.mjs` | der gemeinsame Plan zu zweit (iPhone), offline, zweites Gerät, Verlassen, fremder Text |
| `test-ideen.mjs` | Katalog, Filter nach Wirkung, Saison, Bock, Einplanen (Programm, Kalender), Wie war's? und „Tut dir gut“, eigene Ideen zu zweit, fremder Text, Ideen auf der Karte |
| `test-teilen.mjs` | WhatsApp, Google Kalender, .ics – auch für Eingeplantes |
| `test-offline.mjs` | Offline-Vorrat, App ohne Netz |
| `test-daten.mjs` | `daten/programm.json`, `daten/ideen.json` und `daten/orte.json` |
| `test-sql.mjs` | `supabase/gemeinsam.sql` in PGlite: Funktionen, Rechte, Grenzen |

Die Browsertests laufen gegen feste Testdaten und einen nachgebauten Server
(`tests/hilfe.mjs`), nicht gegen `daten/` und nicht gegen Supabase. Auf
GitHub laufen Linter und Tests bei jedem Push
(`.github/workflows/pruefung.yml`), also auch nach jedem Datenlauf.
