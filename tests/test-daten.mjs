/*
 * Ist daten/programm.json so, wie die App sie braucht?
 *
 * Ohne Browser und ohne Server, ohne npm ci. Der Montagslauf schreibt
 * daten/programm.json (und pflegt daten/orte.json) und prüft vor dem Commit
 * – geprüft wird dabei auch der Ideen-Katalog daten/ideen.json:
 *
 *     node tests/test-daten.mjs
 *
 * Das Format steht in README.md. Geprüft wird vor allem, was die App sonst
 * still falsch zeigen würde: Tage außerhalb des Zeitraums, Uhrzeiten, mit
 * denen die Zeitregeln nicht rechnen können, doppelte Kennungen (Bock-Haken
 * hängen daran), fehlende Links und Orte für die Karte.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { programmBereinigen } from '../js/daten.js';
import { ideenBereinigen, KATEGORIEN, WIRKUNG, WO, DAUER } from '../js/ideen.js';
import { beginn, plusTage, wochentag } from '../js/zeit.js';
import { REGIONEN, DRAUSSEN } from '../js/text.js';

const ORDNER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'daten');

let fails = 0;
let oks = 0;
const check = (c, m) => {
  console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`);
  if (c) oks++; else fails++;
};
const name = (x) => (x && (x.id || x.titel)) || JSON.stringify(x).slice(0, 50);
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
/** Koordinaten [Breite, Länge] irgendwo in Deutschland – ein Dreher (Länge, Breite) fällt auf. */
const geoOk = (g) => istListe(g) && g.length === 2 && g.every((x) => typeof x === 'number' && Number.isFinite(x))
  && g[0] >= 47 && g[0] <= 55.2 && g[1] >= 5.8 && g[1] <= 15.1;
const tageZwischen = (a, b) => Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000);

const p = lies('programm.json');
if (p) {
  check(p.version === 2, 'programm.json: version 2');
  check(STAND.test(p.stand || ''), `programm.json: stand als „JJJJ-MM-TTTHH:MM“ (${p.stand})`);
  const montag = echtesDatum(p.von || '') && wochentag(p.von) === 'Montag';
  check(montag, `programm.json: von ist ein Montag (${p.von})`);
  const sonntag = echtesDatum(p.bis || '') && wochentag(p.bis) === 'Sonntag';
  check(sonntag, `programm.json: bis ist ein Sonntag (${p.bis})`);
  const spanne = montag && sonntag ? tageZwischen(p.von, p.bis) + 1 : 0;
  check(spanne >= 7 && spanne <= 56, `programm.json: eine bis acht Wochen (${spanne} Tage)`);
  const imZeitraum = (d) => d >= p.von && d <= p.bis;
  const zeitraum = spanne ? Array.from({ length: spanne }, (_, i) => plusTage(p.von, i)) : [];

  check(istListe(p.tage) && JSON.stringify(p.tage.map((t) => t.datum)) === JSON.stringify(zeitraum), 'tage: jeder Tag von–bis genau einmal, der Reihe nach');
  const tage = istListe(p.tage) ? p.tage : [];
  alle(tage, (t) => jaNein(t.feiertag) && jaNein(t.vorFeiertag), 'tage: feiertag und vorFeiertag sind true/false');
  alle(tage.filter((t) => t.vorFeiertag), (t) => wochentag(t.datum) === 'Sonntag', 'tage: vorFeiertag steht nur am Sonntag');

  const termine = istListe(p.termine) ? p.termine : [];
  check(termine.length >= 10, `termine: mindestens zehn – weniger heißt, das Absuchen ist schiefgegangen (${termine.length})`);
  alle(termine, (e) => KENNUNG.test(e.id || ''), 'termine: id klein, mit Bindestrichen');
  eindeutig(termine.map((e) => e.id), 'termine: jede id nur einmal');
  alle(termine, (e) => text(e.titel), 'termine: Titel');
  alle(termine, (e) => e.ganzeWoche === undefined, 'termine: kein ganzeWoche mehr – was über Tage läuft, gehört nach laufend');
  const weit = (e) => e.kuenstler || e.tipp;
  alle(termine, (e) => istListe(e.daten) && e.daten.length > 0 && e.daten.every((d) => echtesDatum(d)
    && (imZeitraum(d) || (weit(e) && d >= p.von && tageZwischen(p.von, d) <= 400))),
  'termine: daten nicht leer und alle im Zeitraum (Konzerte der eigenen Künstler und Tipps bis zu 400 Tage voraus)');
  alle(termine, (e) => !istListe(e.daten) || new Set(e.daten).size === e.daten.length, 'termine: kein Tag doppelt in daten');
  alle(termine, (e) => (e.ganztags ? text(e.zeit) : mitUhrzeit(e.zeit)), 'termine: zeit mit Uhrzeit „HH:MM“ (frei formuliert nur bei ganztags)');
  alle(termine, (e) => e.zeiten === undefined || (typeof e.zeiten === 'object' && Object.entries(e.zeiten).every(([d, z]) => (e.daten || []).includes(d) && mitUhrzeit(z))),
    'termine: zeiten nur für eigene Tage, jeweils mit Uhrzeit');
  alle(termine, (e) => e.ende === undefined || UHR.test(e.ende), 'termine: ende als „HH:MM“');
  alle(termine, (e) => e.dauer === undefined || (Number.isInteger(e.dauer) && e.dauer > 0 && e.dauer <= 720), 'termine: dauer in Minuten (1–720)');
  alle(termine, (e) => Object.hasOwn(REGIONEN, e.region), `termine: region eine von ${Object.keys(REGIONEN).join(', ')}`);
  alle(termine, (e) => text(e.kategorie), 'termine: Kategorie');
  alle(termine.filter((e) => e.kuenstler), (e) => e.kategorie === 'Konzert', 'termine: Konzerte der eigenen Künstler haben die Kategorie Konzert');
  alle(termine, (e) => e.draussen === undefined || Object.hasOwn(DRAUSSEN, e.draussen), 'termine: draussen ist drinnen, draußen oder beides');
  alle(termine, (e) => LINK.test(e.link || ''), 'termine: Link mit http(s)');
  alle(termine, (e) => ['ganztags', 'kostenlos', 'hohwacht', 'kuenstler', 'neu', 'ausverkauft', 'tipp'].every((f) => jaNein(e[f])),
    'termine: ganztags, kostenlos, hohwacht, kuenstler, neu, ausverkauft, tipp sind true/false');
  alle(termine, (e) => e.imdb === undefined || text(String(e.imdb)), 'termine: imdb ist ein Platz');
  alle(termine, (e) => e.geo === undefined || geoOk(e.geo), 'termine: geo ist [Breite, Länge] in Deutschland');
  const mitGeo = termine.filter((e) => e.geo).length;
  check(!termine.length || mitGeo >= termine.length * 0.8, `termine: mindestens 80 % mit Ort für die Karte (${mitGeo} von ${termine.length})`);

  const laufend = istListe(p.laufend) ? p.laufend : [];
  alle(laufend, (e) => KENNUNG.test(e.id || ''), 'laufend: id klein, mit Bindestrichen');
  eindeutig(laufend.map((e) => e.id), 'laufend: jede id nur einmal');
  alle(laufend, (e) => text(e.titel) && text(e.zeit), 'laufend: Titel und Zeiten (Text)');
  alle(laufend, (e) => echtesDatum(e.von || '') && echtesDatum(e.bis || '') && e.von <= e.bis, 'laufend: von und bis als Tage, von ≤ bis');
  alle(laufend, (e) => e.bis >= p.von && e.von <= p.bis, 'laufend: überschneidet sich mit dem Zeitraum');
  alle(laufend, (e) => Object.hasOwn(REGIONEN, e.region) && text(e.kategorie) && LINK.test(e.link || ''), 'laufend: Region, Kategorie und Link');
  alle(laufend, (e) => e.geo === undefined || geoOk(e.geo), 'laufend: geo ist [Breite, Länge] in Deutschland');

  // „immer“ gibt es nur noch aus älteren Läufen – die Ausflugsziele stehen im Ideen-Katalog.
  const immer = istListe(p.immer) ? p.immer : [];
  alle(immer, (e) => KENNUNG.test(e.id || ''), 'immer (falls vorhanden): id klein, mit Bindestrichen');
  eindeutig(immer.map((e) => e.id), 'immer: jede id nur einmal');
  alle(immer, (e) => text(e.titel) && Object.hasOwn(REGIONEN, e.region) && LINK.test(e.link || ''), 'immer: Titel, Region und Link');
  alle(immer, (e) => e.draussen === undefined || Object.hasOwn(DRAUSSEN, e.draussen), 'immer: draussen ist drinnen, draußen oder beides');
  alle(immer, (e) => e.geo === undefined || geoOk(e.geo), 'immer: geo ist [Breite, Länge] in Deutschland');

  for (const feld of ['infos', 'highlights', 'hinweise']) {
    const liste = p[feld] === undefined ? [] : p[feld];
    check(istListe(liste) && liste.every((x) => x && text(x.text)), `${feld}: Liste von Einträgen mit text`);
  }
  const fehler = [];
  programmBereinigen(p, fehler);
  check(!fehler.length, `die App übernimmt das Programm ohne Beanstandung${fehler.length ? `: ${fehler.slice(0, 3).join(' | ')}` : ''}`);
}

// Der Ideen-Katalog (von Hand gepflegt, Format in README.md).
const id = lies('ideen.json');
if (id) {
  const ideen = istListe(id.ideen) ? id.ideen : [];
  check(id.version === 1 && istListe(id.ideen), 'ideen.json: version 1 mit ideen');
  check(ideen.length >= 50, `ideen.json: genug Ideen (${ideen.length})`);
  alle(ideen, (x) => KENNUNG.test(x.id || ''), 'ideen: id klein, mit Bindestrichen');
  eindeutig(ideen.map((x) => x.id), 'ideen: jede id nur einmal – Bock-Haken und Verlauf hängen daran');
  alle(ideen, (x) => text(x.titel) && text(x.text), 'ideen: Titel und Text');
  alle(ideen, (x) => KATEGORIEN.some(([k]) => k === x.kategorie), `ideen: kategorie eine von ${KATEGORIEN.map(([k]) => k).join(', ')}`);
  alle(ideen, (x) => istListe(x.wirkung) && x.wirkung.every((w) => Object.hasOwn(WIRKUNG, w)), `ideen: wirkung aus ${Object.keys(WIRKUNG).join(', ')}`);
  alle(ideen, (x) => istListe(x.mit) && x.mit.length > 0 && x.mit.every((m) => ['allein', 'zu zweit', 'gruppe'].includes(m)), 'ideen: mit aus allein, zu zweit, gruppe');
  alle(ideen, (x) => Object.hasOwn(WO, x.wo), `ideen: wo eins von ${Object.keys(WO).join(', ')}`);
  alle(ideen, (x) => Object.hasOwn(DRAUSSEN, x.draussen), 'ideen: draussen ist drinnen, draußen oder beides');
  alle(ideen, (x) => Object.hasOwn(DAUER, x.dauer), `ideen: dauer eins von ${Object.keys(DAUER).join(', ')}`);
  alle(ideen, (x) => x.saison === undefined || (istListe(x.saison) && x.saison.length > 0 && x.saison.every((m) => Number.isInteger(m) && m >= 1 && m <= 12)),
    'ideen: saison sind Monate 1–12');
  alle(ideen, (x) => jaNein(x.kostenlos) && jaNein(x.hohwacht), 'ideen: kostenlos und hohwacht sind true/false');
  alle(ideen, (x) => x.link === undefined || LINK.test(x.link), 'ideen: Link mit http(s)');
  alle(ideen, (x) => ['preis', 'ziel', 'braucht', 'zeiten', 'anreise'].every((k) => x[k] === undefined || text(x[k])), 'ideen: preis, ziel, braucht, zeiten, anreise sind Text');
  alle(ideen, (x) => x.orte === undefined || (istListe(x.orte) && x.orte.every((o) => o && text(o.name)
    && (o.geo === undefined || geoOk(o.geo)) && (o.link === undefined || LINK.test(o.link)))), 'ideen: Orte mit Name, geo in Deutschland, Link mit http(s)');
  alle(ideen.filter((x) => x.wo === 'ausflug'), (x) => text(x.anreise), 'ideen: Ausflüge mit Anreise');
  const fehler = [];
  const sauber = ideenBereinigen(id, fehler);
  check(!fehler.length && sauber && sauber.length === ideen.length, `die App übernimmt alle Ideen${fehler.length ? `: ${fehler.slice(0, 3).join(' | ')}` : ''}`);
}

// Die Ortsliste des Laufs (nur seine Hilfe – die App liest sie nicht).
if (existsSync(path.join(ORDNER, 'orte.json'))) {
  const o = lies('orte.json');
  if (o) {
    check(o.version === 1 && o.orte && typeof o.orte === 'object', 'orte.json: version 1 mit orte');
    const schlecht = Object.entries(o.orte || {}).filter(([, g]) => !geoOk(g)).map(([k]) => k);
    check(!schlecht.length, `orte.json: jede Angabe ist [Breite, Länge] in Deutschland${schlecht.length ? ` – nicht bei: ${schlecht.slice(0, 5).join(', ')}` : ''}`);
  }
}

console.log(`${fails ? 'FEHLER' : 'Alles gut'}: ${oks} von ${oks + fails} Prüfungen bestanden.`);
process.exit(fails || !oks ? 1 : 0);
