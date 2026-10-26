/*
 * Freizeit: Sind die beiden Datendateien so, wie die App sie braucht?
 *
 * Ohne Browser und ohne Server. Die geplanten Läufe schreiben
 * daten/woche.json (montags) und daten/konzerte.json (samstags) und prüfen
 * sie hiermit, bevor sie committen:
 *
 *     node tests/test-daten.mjs
 *
 * Das Format steht in README.md. Geprüft wird vor allem, was die App
 * sonst still falsch zeigen würde: Tage außerhalb der Woche, Uhrzeiten, mit
 * denen die Zeitregeln nicht rechnen können, doppelte Kennungen (Merkliste),
 * fehlende Links.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { wocheBereinigen, konzerteBereinigen } from '../js/daten.js';
import { beginn, plusTage, wochentag } from '../js/zeit.js';
import { REGIONEN, DRAUSSEN } from '../js/text.js';

const ORDNER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'daten');

let fails = 0;
let oks = 0;
const check = (c, m) => {
  console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`);
  if (c) oks++; else fails++;
};
const name = (x) => (x && (x.id || x.titel || x.kuenstler)) || JSON.stringify(x).slice(0, 50);
/** Eine Regel für viele Einträge – nennt die ersten, die sie nicht erfüllen. */
const alle = (liste, ok, m) => {
  const schlecht = liste.filter((x) => !ok(x));
  check(!schlecht.length, `${m}${schlecht.length ? ` – nicht bei ${schlecht.length}: ${schlecht.slice(0, 5).map(name).join(', ')}` : ''}`);
};
const eindeutig = (werte, m) => {
  const doppelt = [...new Set(werte.filter((w, i) => werte.indexOf(w) !== i))];
  check(!doppelt.length, `${m}${doppelt.length ? ` – doppelt: ${doppelt.slice(0, 5).join(', ')}` : ''}`);
};

function lies(datei) {
  try {
    return JSON.parse(readFileSync(path.join(ORDNER, datei), 'utf8'));
  } catch (e) {
    check(false, `${datei} lässt sich als JSON lesen (${e.message})`);
    return null;
  }
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const echtesDatum = (s) => ISO.test(s) && new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;
const STAND = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const UHR = /^([01]?\d|2[0-3]):[0-5]\d$/;
const KENNUNG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const LINK = /^https?:\/\/[^\s/]+\.[^\s]+$/;
const text = (s) => typeof s === 'string' && s.trim() !== '';
const jaNein = (x) => x === undefined || typeof x === 'boolean';
const mitUhrzeit = (s) => typeof s === 'string' && beginn(s) !== null;
const istListe = (x) => Array.isArray(x);

/** Kalenderwoche nach ISO 8601 (die Woche mit dem 4. Januar ist KW 1). */
function isoWoche(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
  const kw1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4, 12));
  kw1.setUTCDate(kw1.getUTCDate() - ((kw1.getUTCDay() + 6) % 7) + 3);
  return 1 + Math.round((d - kw1) / (7 * 86400000));
}

// ---------------------------------------------------------------- woche.json
const w = lies('woche.json');
if (w) {
  check(w.version === 1, 'woche.json: version 1');
  check(STAND.test(w.stand || ''), `woche.json: stand als „JJJJ-MM-TTTHH:MM“ (${w.stand})`);
  const montag = echtesDatum(w.von || '') && wochentag(w.von) === 'Montag';
  check(montag, `woche.json: von ist ein Montag (${w.von})`);
  if (montag) {
    check(w.bis === plusTage(w.von, 6), `woche.json: bis ist der Sonntag danach (${w.bis})`);
    check(w.kw === isoWoche(w.von), `woche.json: kw passt zum Montag (${w.kw}, richtig wäre ${isoWoche(w.von)})`);
  }
  const woche = montag ? [0, 1, 2, 3, 4, 5, 6].map((n) => plusTage(w.von, n)) : [];
  const inWoche = (d) => woche.includes(d);

  check(istListe(w.tage) && JSON.stringify(w.tage.map((t) => t.datum)) === JSON.stringify(woche), 'tage: jeder der sieben Tage genau einmal, der Reihe nach');
  const tage = istListe(w.tage) ? w.tage : [];
  alle(tage, (t) => jaNein(t.feiertag) && jaNein(t.vorFeiertag), 'tage: feiertag und vorFeiertag sind true/false');
  alle(tage.filter((t) => t.vorFeiertag), (t) => wochentag(t.datum) === 'Sonntag', 'tage: vorFeiertag steht nur am Sonntag');

  const termine = istListe(w.termine) ? w.termine : [];
  check(termine.length >= 10, `termine: mindestens zehn – weniger heißt, das Absuchen ist schiefgegangen (${termine.length})`);
  alle(termine, (e) => KENNUNG.test(e.id || ''), 'termine: id klein, mit Bindestrichen');
  eindeutig(termine.map((e) => e.id), 'termine: jede id nur einmal');
  alle(termine, (e) => text(e.titel), 'termine: Titel');
  alle(termine, (e) => istListe(e.daten) && e.daten.length > 0 && e.daten.every(inWoche), 'termine: daten nicht leer und alle in dieser Woche');
  alle(termine, (e) => !istListe(e.daten) || new Set(e.daten).size === e.daten.length, 'termine: kein Tag doppelt in daten');
  alle(termine, (e) => (e.ganztags || e.ganzeWoche ? text(e.zeit) : mitUhrzeit(e.zeit)),
    'termine: zeit mit Uhrzeit „HH:MM“ (frei formuliert nur bei ganztags/ganzeWoche)');
  alle(termine, (e) => e.zeiten === undefined || (typeof e.zeiten === 'object' && Object.entries(e.zeiten).every(([d, z]) => (e.daten || []).includes(d) && mitUhrzeit(z))),
    'termine: zeiten nur für eigene Tage, jeweils mit Uhrzeit');
  alle(termine, (e) => e.ende === undefined || UHR.test(e.ende), 'termine: ende als „HH:MM“');
  alle(termine, (e) => e.dauer === undefined || (Number.isInteger(e.dauer) && e.dauer > 0 && e.dauer <= 720), 'termine: dauer in Minuten (1–720)');
  alle(termine, (e) => Object.hasOwn(REGIONEN, e.region), `termine: region eine von ${Object.keys(REGIONEN).join(', ')}`);
  alle(termine, (e) => text(e.kategorie), 'termine: Kategorie');
  alle(termine, (e) => e.draussen === undefined || Object.hasOwn(DRAUSSEN, e.draussen), 'termine: draussen ist drinnen, draußen oder beides');
  alle(termine, (e) => LINK.test(e.link || ''), 'termine: Link mit http(s)');
  alle(termine, (e) => ['ganztags', 'ganzeWoche', 'kostenlos', 'hohwacht'].every((f) => jaNein(e[f])), 'termine: ganztags, ganzeWoche, kostenlos, hohwacht sind true/false');
  alle(termine, (e) => e.imdb === undefined || text(String(e.imdb)), 'termine: imdb ist ein Platz');

  const immer = istListe(w.immer) ? w.immer : [];
  check(immer.length > 0, `immer: Ausflugsziele vorhanden (${immer.length})`);
  alle(immer, (e) => KENNUNG.test(e.id || ''), 'immer: id klein, mit Bindestrichen');
  eindeutig(immer.map((e) => e.id), 'immer: jede id nur einmal');
  alle(immer, (e) => text(e.titel) && Object.hasOwn(REGIONEN, e.region) && LINK.test(e.link || ''), 'immer: Titel, Region und Link');
  alle(immer, (e) => e.draussen === undefined || Object.hasOwn(DRAUSSEN, e.draussen), 'immer: draussen ist drinnen, draußen oder beides');

  for (const feld of ['infos', 'highlights', 'hinweise']) {
    const liste = w[feld] === undefined ? [] : w[feld];
    check(istListe(liste) && liste.every((x) => x && text(x.text)), `${feld}: Liste von Einträgen mit text`);
  }
  const fehler = [];
  wocheBereinigen(w, fehler);
  check(!fehler.length, `die App übernimmt die Woche ohne Beanstandung${fehler.length ? `: ${fehler.slice(0, 3).join(' | ')}` : ''}`);
}

// ------------------------------------------------------------- konzerte.json
const k = lies('konzerte.json');
if (k) {
  check(k.version === 1, 'konzerte.json: version 1');
  check(k.stand === '' || STAND.test(k.stand || ''), `konzerte.json: stand leer oder „JJJJ-MM-TTTHH:MM“ (${k.stand})`);
  check(istListe(k.konzerte), 'konzerte.json: konzerte ist eine Liste');
  const konzerte = istListe(k.konzerte) ? k.konzerte : [];
  alle(konzerte, (x) => KENNUNG.test(x.id || ''), 'konzerte: id klein, mit Bindestrichen');
  eindeutig(konzerte.map((x) => x.id), 'konzerte: jede id nur einmal');
  alle(konzerte, (x) => text(x.kuenstler), 'konzerte: Künstler');
  alle(konzerte, (x) => echtesDatum(x.datum || ''), 'konzerte: datum ist ein Tag „JJJJ-MM-TT“');
  alle(konzerte, (x) => !x.zeit || mitUhrzeit(x.zeit), 'konzerte: zeit leer oder mit Uhrzeit „HH:MM“');
  alle(konzerte, (x) => text(x.ort) && text(x.stadt), 'konzerte: Ort und Stadt');
  alle(konzerte, (x) => LINK.test(x.link || ''), 'konzerte: Link mit http(s)');
  alle(konzerte, (x) => ['neu', 'ausverkauft', 'tipp'].every((f) => jaNein(x[f])), 'konzerte: neu, ausverkauft, tipp sind true/false');
  const fehler = [];
  konzerteBereinigen(k, fehler);
  check(!fehler.length, `die App übernimmt die Konzerte ohne Beanstandung${fehler.length ? `: ${fehler.slice(0, 3).join(' | ')}` : ''}`);
}

console.log(`${fails ? 'FEHLER' : 'Alles gut'}: ${oks} von ${oks + fails} Prüfungen bestanden.`);
process.exit(fails || !oks ? 1 : 0);
