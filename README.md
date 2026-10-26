# Freizeit

Was in Hamburg und Umgebung diese Woche los ist, die Konzerte von Tobis
Lieblingskünstlern und eine Merkliste – als App fürs Handy.

**Adresse:** <https://finanzdienste.github.io/Freizeit/>
(in Chrome öffnen, dann Menü ⋮ → „App installieren“; auf dem iPhone in
Safari: Teilen → „Zum Home-Bildschirm“).

Drei Reiter:

| Reiter | Inhalt |
| --- | --- |
| **Diese Woche** | Highlights, Filter, Tag für Tag nach Uhrzeit, was die ganze Woche läuft, Ausflugsziele, Hinweise |
| **Konzerte** | Konzerte der eigenen Künstler in Hamburg und bis ca. 100 km drumherum, neu Angekündigtes zuerst |
| **Merkliste** | Gemerkte Termine, Konzerte und Ziele, nach Datum; Vergangenes lässt sich wegräumen |

Jeder Eintrag hat **Merken**, **WhatsApp** (öffnet WhatsApp mit fertiger
Nachricht: Titel, Datum und Uhrzeit, Ort, Beschreibung, Preis, Anreise,
Link), **Kalender** (ausgefüllter Termin in Google Kalender) und die
**Quelle**.

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
Für die Konzerte der eigenen Künstler gilt sie nicht.

Gerechnet wird in `js/zeit.js`, geprüft in `tests/test-woche.mjs`.

## Woher die Daten kommen

Die App ändert ihre Daten nie selbst. Zwei geplante Läufe schreiben sie:

| Datei | Wer | Wann |
| --- | --- | --- |
| `daten/woche.json` | „Freizeit-Wochenplan Hamburg“ | montags gegen 7 Uhr |
| `daten/konzerte.json` | „Samstags-Musikcheck“ | samstags gegen 9 Uhr |

Ein Lauf schreibt **nur seine eine Datei**, prüft sie mit
`node tests/test-daten.mjs` (ohne `npm ci`, nur Node) und committet sie
direkt auf `main`
(„Freizeit: Woche KW 45“ bzw. „Freizeit: Konzerte vom 31.10.“). Die Daten
stehen bewusst nicht im Offline-Vorrat von `sw.js` – darum braucht ein
Datenlauf weder eine neue VERSION noch sonst eine Änderung am Code.

GitHub Pages baut von `main`; nach einem Push steht die neue Datei nach ein
bis zwei Minuten unter `https://finanzdienste.github.io/Freizeit/daten/…`.

### `daten/woche.json`

```json
{
  "version": 1,
  "stand": "2026-10-26T07:03",
  "kw": 44,
  "von": "2026-10-26",
  "bis": "2026-11-01",
  "infos": [{ "titel": "Herbstferien Hamburg", "text": "noch bis Fr 30.10." }],
  "highlights": [{ "titel": "Sa 31.10.: Museen gratis", "text": "Zum Reformationstag …" }],
  "tage": [
    { "datum": "2026-10-26", "wetter": "Hamburg 12°/9°, bewölkt", "wetterOstsee": "Ostsee/Kiel 12°/8°, Regen", "tipp": "Viele Museen haben montags zu." },
    { "datum": "2026-10-31", "feiertag": true }
  ],
  "termine": [
    {
      "id": "die-odyssee-kinopolis-hafencity",
      "daten": ["2026-10-26", "2026-10-28"],
      "zeit": "19:00",
      "zeiten": { "2026-10-28": "20:15" },
      "ende": "22:10",
      "dauer": 190,
      "titel": "Die Odyssee",
      "ort": "Kinopolis HafenCity, Kino 5",
      "region": "HH",
      "kategorie": "Kino",
      "beschreibung": "Christopher Nolans Odyssee-Verfilmung, deutsche Fassung.",
      "preis": "ab 13,99 €",
      "draussen": "drinnen",
      "link": "https://…",
      "imdb": "64"
    }
  ],
  "immer": [
    { "id": "miniatur-wunderland", "titel": "Miniatur Wunderland", "ort": "Speicherstadt", "region": "HH", "kategorie": "Ausstellung", "beschreibung": "…", "zeiten": "täglich ab 9:30", "preis": "Erw. 22 €", "draussen": "drinnen", "anreise": "U3 Baumwall", "link": "https://…" }
  ],
  "hinweise": [{ "titel": "Abgesagt", "text": "…" }, { "text": "Quellen u. a.: …" }]
}
```

**Termine** – Pflicht sind `id`, `titel`, `daten` (ISO-Tage aus der Woche),
`zeit`, `region`, `kategorie` und `link`; `tests/test-daten.mjs` prüft
das und alles Weitere aus dieser Tabelle:

| Feld | Bedeutung |
| --- | --- |
| `id` | stabile Kennung, klein mit Bindestrichen; gleiche Veranstaltung → gleiche `id` |
| `daten` | Tage, an denen der Termin stattfindet. Wiederholungen stehen an **jedem** ihrer Tage |
| `zeit` | Beginn `HH:MM` oder Zeitraum `HH:MM–HH:MM`; immer mit Doppelpunkt, sonst greifen die Zeitregeln nicht. Bei `ganztags` freier Text („Fr 14–22, Sa 10–22“) |
| `zeiten` | abweichende Uhrzeit je Tag, `{ "2026-10-28": "20:15" }`; zwei Vorstellungen an einem Tag: `"15:00 + 20:00"`. Nur für Tage aus `daten` |
| `ende` | Ende `HH:MM`, bekannt oder geschätzt (Film: Laufzeit + ca. 15 Min. Werbung) |
| `dauer` | Dauer in Minuten, wenn kein `ende` |
| `ganztags` | ganztägig (Messe, Markt über den Tag); steht oben im Tag |
| `ganzeWoche` | läuft an (fast) jedem Tag → Abschnitt „Läuft die ganze Woche“; `zeit` beschreibt dann die Zeiten („Di–So ab 10 Uhr“) |
| `region` | `HH` Hamburg · `LUE` Lübeck & Ostsee · `LG` Lüneburg & Heide · `STD` Stade & Altes Land · `HB` Hohwachter Bucht & Kiel · `WEI` Weitere Ziele |
| `kategorie` | z. B. Konzert, Bühne, Comedy, Kino, Party, Sport, Führung, Erlebnis, Food, Markt, Fest & Saisonal, Ausstellung |
| `draussen` | `drinnen`, `draußen` oder `beides` |
| `kostenlos` | `true`, wenn der Eintritt frei ist |
| `hohwacht` | `true`, wenn er sich mit einem Besuch in Hohwacht verbinden lässt (Region `HB` zählt automatisch) |
| `anreise` | bei Zielen außerhalb Hamburgs: Deutschlandticket und Auto |
| `unsicher` | warum eine Angabe nicht sicher ist; wird rot markiert |
| `imdb` | Platz in der IMDb Top 250 (Text, z. B. `"64"` oder `"5, 8 und 10"`) |

**Tage:** `feiertag: true` an gesetzlichen Feiertagen (dann gelten weder der
15:30-Filter noch die 21:30-Regel für den Vorabend). `vorFeiertag: true` am
Sonntag, wenn der Montag danach ein Feiertag ist.

### `daten/konzerte.json`

```json
{
  "version": 1,
  "stand": "2026-10-31T08:55",
  "konzerte": [
    {
      "id": "the-war-on-drugs-2027-03-14-hamburg",
      "datum": "2027-03-14",
      "zeit": "20:00",
      "kuenstler": "The War On Drugs",
      "titel": "Europe Tour 2027",
      "ort": "Sporthalle Hamburg",
      "stadt": "Hamburg",
      "link": "https://…",
      "neu": true,
      "ausverkauft": false,
      "vorverkauf": "ab Fr 6.11., 10 Uhr",
      "tipp": false,
      "anreise": "",
      "hinweis": ""
    }
  ]
}
```

Pflicht sind `id`, `kuenstler`, `datum`, `ort`, `stadt` und `link`. `neu` = in den letzten 7 Tagen
angekündigt, `tipp` = kein eigener Künstler, passt aber zum Geschmack.
Der Lauf führt die Liste fort: Er übernimmt die bestehenden Einträge,
ergänzt neu Angekündigtes, streicht Vergangenes und Abgesagtes und setzt
`neu` nur für Ankündigungen der letzten sieben Tage. Was dabei vergessen
wird, blendet die App trotzdem richtig aus – vergangene Konzerte zeigt sie
nie.

## Aufbau

Wie die Workout-App: kein Bauschritt, ES-Module, eigener Service Worker
(`sw.js`, Vorrat `freizeit-v…`), eigener Speicher (`freizeit.stand.v1` im
localStorage).

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
| `js/app.js` | Einstieg, Reiter, Knöpfe, Service Worker |
| `js/zeit.js` | Datum, Uhrzeit, beide Zeitregeln |
| `js/daten.js` | Laden und Prüfen der beiden Datendateien |
| `js/karte.js` | Einträge bauen und als Karte zeichnen |
| `js/teilen.js` | WhatsApp-Nachricht, Google-Kalender-Link |
| `js/speicher.js` | Filter, Merkliste, zuletzt gesehener Stand |
| `js/ansicht-*.js` | die drei Reiter |

## Tests

    npm ci                      # einmal: Playwright und ESLint
    npm run lint
    node tests/lauf.mjs         # alle: Woche, Teilen, Merkliste, Konzerte, offline, Daten
    node tests/test-daten.mjs   # nur die Datendateien – braucht kein npm ci

Die Browsertests laufen gegen feste Testdaten (`tests/hilfe.mjs`), nicht
gegen `daten/`. Auf GitHub laufen Linter und Tests bei jedem Push
(`.github/workflows/pruefung.yml`), also auch nach jedem Datenlauf.
