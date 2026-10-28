# Freizeit

Was in Hamburg und Umgebung los ist – die nächsten gut fünf Wochen, mit den
Konzerten von Tobis Lieblingskünstlern mittendrin, als Liste, Monat, Woche und Tag und auf der
Karte –, dazu ein Katalog mit Ideen für alles ohne Termin, sortiert danach,
was eine Aktivität bringt (Flow, Bewegung, Erholung, Produktiv). Und
gemeinsam geplant: Tobi schickt seinen Leuten einen Link, jeder hakt an,
worauf er Bock hat – mit Tobi oder allein/mit anderen –, und Tobi sieht in
„Wir“, worauf alle Bock haben.

**Adresse:** <https://finanzdienste.github.io/Freizeit/>
(Android: in Chrome öffnen, Menü ⋮ → „App installieren“; iPhone: in Safari
öffnen, Teilen → „Zum Home-Bildschirm“).

Vier Reiter:

| Reiter | Inhalt |
| --- | --- |
| **Programm** | Vier Ansichten wie bei Google, der gewählte Tag gilt in allen: **Liste** – Woche für Woche zum Blättern: Highlights, Filter, Tag für Tag nach Uhrzeit (Eingeplantes oben am Tag), was gerade läuft, Hinweise; **Monat** – das Blatt mit der Zahl der Termine je Tag und Punkten, wer Bock hat; **Woche** – 7 bis 24 Uhr mit den belegten Zeiten des Gastgebers und Chips für Haken, Treffer und Eingeplantes; **Tag** – Zeitstreifen und alle Termine. Nach dem Ende des Programms nur noch Konzerte der eigenen Künstler und Eingeplantes |
| **Karte** | OpenStreetMap, ein Marker je Ort (nahe zu Haufen zusammengefasst), Zeiträume von „Heute“ bis „Alles“ und „Mit Bock“, mit „💡 Ideen“ auch die Orte aus dem Ideen-Katalog |
| **Ideen** | Alles ohne Termin: Eingeplantes, „Wollen wir mal“ (Ideen mit Bock), „Tut dir gut“, Filter nach Wirkung und Rahmen, der Katalog nach Kategorien, eigene Ideen |
| **Wir** | Der gemeinsame Plan. Beim Gastgeber der Überblick: Zusammen, Wollen mit dir, Ohne dich, Pro Person, Deine Haken; Einladen, Weiteres Gerät, Auflösen. Bei den Eingeladenen: Du und Tobi, Tobi hat Bock auf, Deine Haken. Ohne Plan die eigene Bock-Liste |

Jede Karte ist zugeklappt kurz – Uhrzeit, Titel, Ort, was beim Entscheiden
hilft (Preis, „♫ Dein Künstler“, NEU, wer Bock hat) und der Knopf **Bock**
(wer eingeladen ist, wählt zwischen **Mit Tobi** und **Allein/mit
anderen**). Ein Tipp auf den Titel klappt den Rest auf: Beschreibung,
Region, drinnen/draußen, Anreise, dazu **WhatsApp** (fertige Nachricht:
Titel, Datum und Uhrzeit, Ort, Beschreibung, Preis, Anreise, Link),
**Kalender** (auf dem iPhone eine .ics-Datei für den Kalender des Geräts,
sonst ein ausgefüllter Termin in Google Kalender) und die **Quelle**.
Highlights und Filter stecken genauso hinter einem Knopf, unter „Wir“ alles
außer Einladen hinter **Mehr**. Konzerte der eigenen Künstler tragen
„♫ Dein Künstler“, der Filter „♫ Meine Künstler“ zeigt nur sie.

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
Orten mit Wahl des Orts): Er steht im Programm (in allen Ansichten) und auf der
Karte, mit WhatsApp- und Kalender-Knopf. Im gemeinsamen Plan sieht ihn, wer
die Haken des anderen sieht; plant ein Eingeladener „allein/mit anderen“,
steht es beim Gastgeber nur in „Wir“ unter „Ohne dich“, nicht in seinem
Programm.
**Gemacht** fragt „Wie war's?“ (😐 naja, 🙂 gut, 😄 super) und ob die Zeit
verflogen ist; nach einem eingeplanten Tag fragt die App von selbst. Daraus
wird **„Tut dir gut“** – vorn, was im Schnitt am besten war und öfter Flow
brachte. Dieser Verlauf bleibt nur auf dem Gerät (`verlauf` im
localStorage), er geht an keinen Server.

**Eigene Ideen** legt man mit „+ Eigene Idee“ an. Wie Eingeplantes sind sie
Bock-Haken mit Schnappschuss – im gemeinsamen Plan sieht sie, wer die Haken
des anderen sieht, ohne dass der Server etwas Neues können muss. Eine eigene
Idee gibt es, solange jemand Bock darauf hat.

Schlüssel der Bock-Haken: `i:<id>` Idee aus dem Katalog (dieselben
Kennungen wie früher „Geht immer“), `e:<zufall>` eigene Idee,
`p:<tag>:<Schlüssel der Idee>` eingeplant.

## Gemeinsam planen

Einer lädt ein – der **Gastgeber**, gedacht ist Tobi –, die anderen kommen
über einen Link dazu. Wer „Plan starten“ tippt, ist Gastgeber und bekommt
einen Link `…/Freizeit/#einladung=<code>` zum Verschicken, an jeden einzeln
oder in eine Gruppe. Der Code (`abcd-efgh-jkmn`, 12 Zeichen ohne
Verwechsler) steht hinter `#` und geht deshalb an keinen Server. Wer den
Link öffnet, sieht „Tobi lädt dich ein“, gibt seinen Namen ein und ist drin.

**Wer was sieht:**

| | sieht |
| --- | --- |
| Gastgeber | alle im Plan mit allen Haken – und ob jemand etwas mit ihm machen will oder allein/mit anderen |
| Eingeladene | den Gastgeber und sich selbst, mit den Haken der beiden; von den anderen Eingeladenen nichts |

Eingeladene haben statt „Bock“ zwei Knöpfe: **Mit Tobi** und **Allein/mit
anderen** (dieselbe Wahl noch einmal nimmt den Haken weg). Die Wahl steht als
`mitwem` (`gastgeber` oder `andere`) im Schnappschuss des Hakens; ein Haken
ohne `mitwem` – etwa aus der ersten Fassung – gilt als „mit Tobi“. Beim
Einplanen und bei eigenen Ideen fragt das Formular „Mit wem?“.

Ein **Treffer** (rot unterlegt, im Monat umrandet) ist, wo man zusammen
will: beim Gastgeber, wo er Bock hat und jemand mit ihm will; bei den
Eingeladenen, wo sie „Mit Tobi“ gewählt haben und Tobi Bock hat.

Der Überblick des Gastgebers in „Wir“ zeigt jeden kommenden Eintrag einmal,
im ersten passenden Abschnitt: **Zusammen**, **Wollen mit dir** (jemand will
mit ihm, er hat noch nicht Bock), **Ohne dich** (nur „allein/mit anderen“),
**Pro Person** (je Person „3 mit dir · 2 ohne dich“ und die Liste, dort auch
„Aus dem Plan nehmen“) und **Deine Haken**. „Auflösen“ löscht den Plan für
alle; die eigenen Haken bleiben auf dem Gerät.

**Schlüssel des Gastgebers:** Beim Starten würfelt die App einen Schlüssel
(24 Zeichen); der Server behält nur dessen Hash und zeigt alles nur, wer ihn
mitbringt. **Weiteres Gerät** gibt einen Link `#geraet=<code>.<kennung>[.<schlüssel>]`:
Auf einem zweiten Gerät geöffnet (auf dem iPhone in der App unter „Ich habe
einen Code“ eingefügt) ist man dort dieselbe Person, der Gastgeber samt
Schlüssel. Der Link ist nur für einen selbst. Ohne ihn tritt ein zweites
Gerät als neue Person bei – ein Name allein macht niemanden zu jemand
anderem.

**Wann hat Tobi Zeit?** Die belegten Zeiten des Gastgebers – nur Zeiten,
keine Titel – reisen als seine Haken `z:<Montag der Woche>` mit
`{ "z": [[von, bis], …], "stand": "…" }` (Minuten ab Montag 0:00, Berliner
Zeit). Eingeladene sehen dann an jeder Karte „✓ Tobi hat da Zeit“ oder
„Tobi ist da schon verplant“ und im Programm (Woche und Tag) die belegten
Zeiten als graue Blöcke, wie im Terminplanungs-Assistenten; der Gastgeber
sieht dasselbe und an den Karten nur, was sich mit seinem Kalender beißt.
Für Wochen ohne Zeiten sagt die App nichts. Rechnen
(Zeitzone, Mitternacht, Wochenwechsel, Zeitumstellung) tut
`js/zeiten-rechnen.js`, schicken `werkzeug/zeiten-senden.mjs` – gedacht für
eine geplante Aufgabe, die den Google Kalender liest:

```
node werkzeug/zeiten-senden.mjs --zugang "<Link „Weiteres Gerät“ des Gastgebers>" --termine termine.json
```

`termine.json` ist eine Liste `[{ "start": "2026-11-03T18:00:00+01:00", "ende": "…" }, { "start": "2026-11-05", "ende": "2026-11-06", "ganztags": true }]`
nur mit Terminen, an denen er wirklich belegt ist. Geschrieben werden fünf
Wochen ab Montag dieser Woche, auch leere (dann heißt es: frei). Die
geplante Aufgabe „Freizeit: Tobis Zeiten“ macht das dreimal täglich: Sie
liest Tobis eigene Google-Kalender (ohne als „frei“ markierte Einträge wie
Geburtstage), rechnet seine Arbeitszeit Mo–Fr dazu und ruft das Werkzeug
mit seinem Zugang als Gastgeber auf. `--sql` gibt stattdessen die
SQL-Anweisung für einen Lauf mit Datenbankzugang aus.

**Bescheid sagen (Push):** Unter „Wir“ schaltet der Gastgeber mit „🔔
Bescheid sagen“ Push-Mitteilungen ein – auch bei geschlossener App: „Kim
ist dabei“, „Kim hat Bock – mit dir: Theater früh · Di 3.11., 19:00 Uhr“,
„Kim ist doch nicht dabei“ (ein zurückgenommenes „mit dir“), „Kim hat den
Plan verlassen“; mehrere Haken derselben Person kurz nacheinander werden
eine Mitteilung. Die eigenen Haken des Gastgebers melden nichts, ein
zurückgenommenes „ohne dich“ auch nicht. Technisch: `js/push.js` holt sich
vom Browser ein Web-Push-Abo und legt es über `freizeit_push` beim Server ab
(nur der Gastgeber, bis zu fünf Geräte je Plan). Die vier Funktionen
schreiben, was zu melden ist, in `freizeit_nachricht` – nur solange ein Abo
im Plan liegt –, und ein Trigger ruft über `pg_net` die **Edge Function
`freizeit-push`** ([`supabase/functions/freizeit-push`](supabase/functions/freizeit-push)).
Die holt alles Offene mit dem Betreiber-Schlüssel ab, verschlüsselt es
selbst (RFC 8291, VAPID nach RFC 8292, nur WebCrypto, ohne Bibliothek) und
schickt es an die Push-Dienste; `sw.js` zeigt die Mitteilung, ein Tipp
öffnet „Wir“. Ihr VAPID-Schlüsselpaar erzeugt die Function beim ersten Lauf
selbst und legt es in `freizeit_einstellung` ab; den öffentlichen Teil gibt
sie der App per GET. Geheimnisse von Hand braucht es keine. Einrichten: den
SQL-Block einspielen (unten) und die Function deployen – mit der CLI
(`supabase functions deploy freizeit-push --no-verify-jwt`) oder im
Dashboard als eine Datei: `node werkzeug/push-buendeln.mjs > index.ts`,
einfügen, „Enforce JWT verification“ aus. Zugestellt ist, was einmal
versucht wurde; tote Abos (404, 410) räumt die Function weg, Nachrichten
älter als ein Tag gelten als erledigt. Geprüft: `tests/test-push.mjs`
(App, mit nachgebautem Push-Dienst), `tests/test-push-senden.mjs` (die
Function in Node: ein nachgebautes Gerät entschlüsselt, der Push-Dienst
prüft die Unterschrift) und `tests/test-sql.mjs`. Auf dem iPhone geht Push
erst in der App vom Home-Bildschirm.

**iPhone:** Die App auf dem Home-Bildschirm hat einen eigenen Speicher,
getrennt von Safari – sie kennt den Link nicht. Deshalb zeigt die Einladung
in Safari den Weg zum Home-Bildschirm und den Code; in der App fügt man ihn
unter „Wir“ ein.

**Raus:** Nimmt der Gastgeber jemanden heraus oder löst den Plan auf, merkt
das dessen App beim nächsten Abgleich („Du bist nicht mehr dabei“ bzw. „Der
Plan ist aufgelöst“) und sendet nichts mehr – von selbst tritt sie nicht
wieder ein. „Wieder beitreten“ oder „Plan vergessen“ entscheidet man selbst.

**Server:** das Supabase-Projekt der Workout-App (`js/config.js`). Die
Tabellen sind für den öffentlichen Schlüssel gesperrt; erreichbar sind nur
fünf Funktionen (vier für den Plan, `freizeit_push` für die Mitteilungen),
und die entscheiden selbst, wer was zu sehen bekommt.
Einrichten: den Block aus [`supabase/gemeinsam.sql`](supabase/gemeinsam.sql)
in *Supabase → SQL Editor* einfügen und ausführen. Der Block ist wiederholbar
und läuft auch über der ersten Fassung (zwei Tabellen, jeder sah alles):
Personen und Haken bleiben, und wer einen Plan begonnen hat, wird beim
nächsten Öffnen der App sein Gastgeber. Geprüft wird er ohne Supabase in
`tests/test-sql.mjs` (PGlite) – samt dem Weg von der ersten Fassung, die in
`tests/alt/gemeinsam-v2.sql` liegt. Grenzen: 30 Personen und 6000 Haken je
Plan, 100 Pläne, 30000 Haken insgesamt, 2000 Byte je Schnappschuss.

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
| `region` | `HH` Hamburg · `LUE` Lübeck & Ostsee · `LG` Lüneburg & Heide · `STD` Stade & Altes Land · `HB` Hohwachter Bucht & Kiel · `WIS` Wismar · `HAN` Hannover · `WEI` Weitere Ziele |
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
| `js/gemeinsam.js` | der gemeinsame Plan: Code, Schlüssel, Beitreten, weiteres Gerät, Abgleich mit Supabase, Rollen und Treffer |
| `js/zeiten.js` | die belegten Zeiten des Gastgebers: lesen, prüfen, die Zeile an der Karte |
| `js/zeiten-rechnen.js` | aus Kalenderterminen belegte Blöcke je Woche (Browser und Node) |
| `werkzeug/zeiten-senden.mjs` | schickt die Zeiten an den Plan – für eine geplante Aufgabe |
| `js/push.js` | Push-Mitteilungen für den Gastgeber: Abo holen, beim Server an- und abmelden |
| `supabase/functions/freizeit-push/` | die Edge Function: offene Nachrichten holen, verschlüsseln, an die Push-Dienste schicken |
| `werkzeug/push-buendeln.mjs` | die Function als eine Datei fürs Dashboard |
| `js/config.js` | Adresse und öffentlicher Schlüssel des Servers |
| `js/ansicht-*.js` | die vier Reiter – `ansicht-programm.js` die Liste, `ansicht-kalender.js` Monat, Woche und Tag |
| `supabase/gemeinsam.sql` | Tabellen und Funktionen für den gemeinsamen Plan |

## Tests

    npm ci                      # einmal: Playwright, ESLint, PGlite
    npm run lint
    node tests/lauf.mjs         # alle
    node tests/test-daten.mjs   # nur die Datendateien – braucht kein npm ci

| Test | prüft |
| --- | --- |
| `test-programm.mjs` | Wochen, beide Zeitregeln, Filter, Laufendes, Konzerte der eigenen Künstler |
| `test-kalender.mjs` | Monat, Woche und Tag: Zahlen, Bock-Punkte, Chips, Blättern, „Heute“, Monate nach dem Programm |
| `test-landkarte.mjs` | Marker, Zeiträume, Liste am Marker, Haken aus der Karte |
| `test-wir.mjs` | der gemeinsame Plan: Tobi lädt ein, Kim (iPhone) und Jo wählen mit/ohne Tobi und sehen einander nicht, Tobis Überblick, offline, weiteres Gerät, Herausnehmen, Verlassen, Auflösen, ein Plan aus der ersten Fassung, fremder Text |
| `test-ideen.mjs` | Katalog, Filter nach Wirkung, Saison, Bock, Einplanen (Liste, Monat), Wie war's? und „Tut dir gut“, eigene Ideen im Plan, Einplanen mit/ohne Gastgeber, fremder Text, Ideen auf der Karte |
| `test-teilen.mjs` | WhatsApp, Google Kalender, .ics – auch für Eingeplantes |
| `test-offline.mjs` | Offline-Vorrat, App ohne Netz |
| `test-daten.mjs` | `daten/programm.json`, `daten/ideen.json` und `daten/orte.json` |
| `test-zeiten.mjs` | Zeiten des Gastgebers: an den Karten (frei/verplant), in Woche und Tag als Blöcke, nirgends als Eintrag |
| `test-zeiten-rechnen.mjs` | Blöcke je Woche: Zeitzone, Mitternacht, Wochenwechsel, Zeitumstellung |
| `test-zeiten-senden.mjs` | das Werkzeug gegen einen nachgebauten Server |
| `test-sql.mjs` | `supabase/gemeinsam.sql` in PGlite: über der ersten Fassung, Rollen und was wer sieht, Schlüssel, Funktionen, Rechte, Grenzen, Push (Abos, was gemeldet wird, Abholen, VAPID-Paar) |
| `test-push.mjs` | Push in der App: anschalten, was der Server sammelt, ausschalten, ohne Erlaubnis, iPhone im Browser |
| `test-push-senden.mjs` | die Edge Function in Node: VAPID-Token, Verschlüsselung (ein nachgebautes Gerät liest sie), Texte, ein Durchlauf |

Die Browsertests laufen gegen feste Testdaten und einen nachgebauten Server
(`tests/hilfe.mjs`), nicht gegen `daten/` und nicht gegen Supabase. Auf
GitHub laufen Linter und Tests bei jedem Push
(`.github/workflows/pruefung.yml`), also auch nach jedem Datenlauf.
