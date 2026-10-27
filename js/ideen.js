/*
 * Ideen: alles, was man ohne festen Termin unternehmen kann – vom
 * Tischtennis im Park bis zum Bügelperlen-Abend.
 *
 * Drei Quellen:
 *   - der feste Katalog daten/ideen.json (von Hand gepflegt, siehe README),
 *   - eigene Ideen, die man in der App anlegt,
 *   - Ausflugsziele, die ein älterer Montagslauf noch als „immer“ in
 *     programm.json geschrieben hat (dieselben Kennungen wie im Katalog).
 *
 * Schlüssel für Bock-Haken, wie bei den Terminen (karte.js):
 *   i:<id>                    Idee aus dem Katalog – früher „Geht immer“
 *   e:<zufall>                eigene Idee
 *   p:<tag>:<Schlüssel der Idee>  eine Idee, eingeplant für einen Tag
 *
 * Eigene und eingeplante Ideen brauchen keinen eigenen Server: Sie sind
 * Bock-Haken mit Schnappschuss wie jeder andere – eine eigene Idee gibt es,
 * solange jemand Bock darauf hat. Was man gemacht hat und wie es war
 * („Wie war's?“), bleibt nur auf dem Gerät (speicher.js, verlauf).
 */
import { sichererLink } from './text.js';
import { aktuell } from './speicher.js';
import { hakenDerAnderen, ohneGastgeber } from './gemeinsam.js';

export const KATEGORIEN = [
  ['sport', 'Sport & Bewegung'],
  ['spiele', 'Spiele & Gaming'],
  ['kreativ', 'Kreativ & Handwerk'],
  ['genuss', 'Kochen & Genuss'],
  ['natur', 'Natur & Draußen'],
  ['kultur', 'Kultur & Stadt'],
  ['entspannen', 'Entspannen'],
  ['lernen', 'Lernen & Projekte'],
  ['ausflug', 'Ausflüge'],
];
const KATEGORIE_TEXT = Object.fromEntries(KATEGORIEN);
export const WIRKUNG = { flow: '⚡ Flow', bewegung: 'Bewegung', erholung: 'Erholung', produktiv: 'Produktiv' };
export const WO = { zuhause: 'Zuhause', hamburg: 'Hamburg', ausflug: 'Ausflug' };
export const DAUER = { kurz: 'bis 2 Std.', halbtags: 'halber Tag', ganztags: 'ganzer Tag' };
const MIT = ['allein', 'zu zweit', 'gruppe'];
export const BEWERTUNG = { 1: ['😐', 'naja'], 2: ['🙂', 'gut'], 3: ['😄', 'super'] };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const liste = (x) => (Array.isArray(x) ? x : []);
const text = (x) => (typeof x === 'string' ? x : '');
const geoOk = (g) => Array.isArray(g) && g.length === 2
  && g.every((x) => typeof x === 'number' && Number.isFinite(x))
  && Math.abs(g[0]) <= 90 && Math.abs(g[1]) <= 180;

/** Eine Idee in der Form, mit der die Ansichten arbeiten. */
function idee(x, schluessel) {
  const orte = liste(x.orte).filter((o) => o && typeof o.name === 'string' && o.name)
    .map((o) => ({ name: o.name, teil: text(o.teil), geo: geoOk(o.geo) ? o.geo : null, link: sichererLink(o.link), info: text(o.info) }));
  const mitOrt = orte.find((o) => o.geo);
  const wo = Object.hasOwn(WO, x.wo) ? x.wo : 'hamburg';
  const kat = Object.hasOwn(KATEGORIE_TEXT, x.kategorie) ? x.kategorie : 'eigene';
  return {
    quelle: 'idee',
    schluessel,
    datum: null,
    zeit: '',
    titel: String(x.titel || 'Idee'),
    beschreibung: text(x.text || x.beschreibung),
    kat,
    kategorie: KATEGORIE_TEXT[kat] || 'Eigene Idee',
    wirkung: liste(x.wirkung).filter((w) => Object.hasOwn(WIRKUNG, w)),
    mit: liste(x.mit).filter((m) => MIT.includes(m)),
    wo,
    draussen: ['drinnen', 'draußen', 'beides'].includes(x.draussen) ? x.draussen : '',
    dauer: Object.hasOwn(DAUER, x.dauer) ? x.dauer : '',
    kostenlos: x.kostenlos === true,
    preis: text(x.preis),
    saison: liste(x.saison).filter((m) => Number.isInteger(m) && m >= 1 && m <= 12),
    braucht: text(x.braucht),
    ziel: text(x.ziel),
    zeiten: text(x.zeiten),
    anreise: text(x.anreise),
    hohwacht: x.hohwacht === true,
    link: sichererLink(x.link),
    orte,
    ort: orte.length === 1 ? orte[0].name : '',
    geo: mitOrt ? mitOrt.geo : null,
    region: wo === 'ausflug' ? '' : 'HH',
  };
}

/** Katalog prüfen: Ideen mit Kennung, Titel und bekannter Kategorie. */
export function ideenBereinigen(roh, fehler = []) {
  if (!roh || typeof roh !== 'object' || roh.version !== 1 || !Array.isArray(roh.ideen)) {
    fehler.push('ideen.json ist leer oder hat ein unbekanntes Format');
    return null;
  }
  return roh.ideen.filter((x) => {
    const ok = x && typeof x.id === 'string' && /^[a-z0-9-]+$/.test(x.id) && x.titel && Object.hasOwn(KATEGORIE_TEXT, x.kategorie);
    if (!ok) fehler.push(`Idee ohne Kennung, Titel oder Kategorie übersprungen: ${JSON.stringify(x).slice(0, 80)}`);
    return ok;
  }).map((x) => idee(x, `i:${x.id}`));
}

const IMMER_KATEGORIE = { Ausstellung: 'kultur', Führung: 'kultur', Erlebnis: 'kultur', Food: 'genuss', 'Therme & Bad': 'entspannen', 'Outdoor & Natur': 'natur' };

/** Ein Ausflugsziel, das ein Montagslauf noch als „immer“ geschrieben hat. */
export function ideeAusImmer(e) {
  const hh = e.region === 'HH';
  return idee({
    titel: e.titel,
    kategorie: hh || e.kategorie === 'Therme & Bad' ? (IMMER_KATEGORIE[e.kategorie] || 'kultur') : 'ausflug',
    text: e.beschreibung,
    wirkung: { 'Outdoor & Natur': ['bewegung', 'erholung'], 'Therme & Bad': ['erholung'] }[e.kategorie] || [],
    mit: ['zu zweit'],
    wo: hh ? 'hamburg' : 'ausflug',
    draussen: e.draussen,
    dauer: hh ? 'halbtags' : 'ganztags',
    kostenlos: e.kostenlos,
    preis: e.preis,
    zeiten: e.zeiten,
    anreise: e.anreise,
    hohwacht: e.region === 'HB' || e.hohwacht,
    link: e.link,
    orte: e.geo ? [{ name: e.ort || e.titel, geo: e.geo }] : [],
  }, `i:${e.id}`);
}

/** Katalog und Ausflugsziele aus dem Programm, die der Katalog nicht kennt. */
export function alleIdeen(katalog, p) {
  const da = new Set(liste(katalog).map((x) => x.schluessel));
  const extra = liste(p && p.immer).filter((e) => e && e.id && e.titel && !da.has(`i:${e.id}`)).map(ideeAusImmer);
  return [...liste(katalog), ...extra];
}

/** Eine eigene Idee (oder eine aus dem Katalog verschwundene) aus ihrem Schnappschuss. */
export function ideeAusSchnappschuss(schluessel, s = {}) {
  return {
    ...idee({ ...s, kategorie: s.kat }, schluessel),
    eigene: schluessel.startsWith('e:'),
    urheber: text(s.urheber).slice(0, 30),
  };
}

/** Eine neue eigene Idee. */
export function neueIdee({ titel, text: notiz = '', wo = 'hamburg', wirkung = [], urheber = '' }) {
  const zufall = [...crypto.getRandomValues(new Uint8Array(10))].map((b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
  return ideeAusSchnappschuss(`e:${zufall}`, { titel, text: notiz, wo, wirkung, urheber });
}

/**
 * Eine Idee für einen Tag einplanen – ein Eintrag wie ein Termin. Hat die
 * Idee mehrere Orte, sagt `ort` (die Stelle in x.orte), welcher es wird;
 * ohne Wahl bleibt der Ort offen.
 */
export function planEintrag(x, datum, zeit = '', ort = null) {
  const gewaehlt = Number.isInteger(ort) && x.orte[ort] ? x.orte[ort] : (x.orte.length === 1 ? x.orte[0] : null);
  return {
    quelle: 'plan',
    schluessel: `p:${datum}:${x.schluessel}`,
    idee: x.schluessel,
    titel: x.titel,
    datum,
    zeit: /^\d{1,2}:\d{2}$/.test(zeit) ? zeit : '',
    ort: gewaehlt ? gewaehlt.name : '',
    geo: gewaehlt ? gewaehlt.geo : null,
    link: (gewaehlt && gewaehlt.link) || x.link || '',
    beschreibung: x.beschreibung,
    kategorie: x.kategorie,
    region: x.region,
    anreise: x.anreise,
    preis: x.preis,
    kostenlos: x.kostenlos,
  };
}

/** Ein eingeplanter Eintrag aus seinem Schnappschuss – der Tag steht im Schlüssel. */
export function planAusSchnappschuss(schluessel, s = {}) {
  const datum = schluessel.slice(2, 12);
  if (!schluessel.startsWith('p:') || !ISO.test(datum)) return null;
  return {
    quelle: 'plan',
    schluessel,
    idee: schluessel.slice(13),
    titel: String(s.titel || 'Eingeplant'),
    datum,
    zeit: /^\d{1,2}:\d{2}$/.test(s.zeit || '') ? s.zeit : '',
    ort: text(s.ort),
    geo: geoOk(s.geo) ? s.geo : null,
    link: sichererLink(s.link),
    beschreibung: text(s.beschreibung),
    kategorie: text(s.kategorie),
    region: text(s.region),
    anreise: text(s.anreise),
    preis: text(s.preis),
    kostenlos: s.kostenlos === true,
  };
}

/**
 * Schnappschüsse aller Haken mit diesem Präfix: eigene zuerst, dann die der
 * anderen. Was jemand ausdrücklich ohne den Gastgeber vorhat, steht nur in
 * seinem Überblick („Wir“), nicht in seinem Kalender.
 */
function haken(praefix, st) {
  const m = new Map();
  for (const [k, v] of Object.entries(st.bock)) if (k.startsWith(praefix)) m.set(k, v);
  for (const b of hakenDerAnderen()) {
    if (b.eintrag.startsWith(praefix) && !m.has(b.eintrag) && !ohneGastgeber(b)) m.set(b.eintrag, b.daten || {});
  }
  return m;
}

const reihenfolge = (e) => `${e.datum} ${e.zeit ? e.zeit.padStart(5, '0') : '99:99'}`;

/** Alles Eingeplante, von wem auch immer – nach Tag und Uhrzeit. */
export function geplante(st = aktuell()) {
  return [...haken('p:', st)].map(([k, s]) => planAusSchnappschuss(k, s)).filter(Boolean)
    .sort((a, b) => reihenfolge(a).localeCompare(reihenfolge(b)));
}

/** Alle eigenen Ideen (von allen im Plan). */
export function eigeneIdeen(st = aktuell()) {
  return [...haken('e:', st)].map(([k, s]) => ideeAusSchnappschuss(k, s))
    .sort((a, b) => a.titel.localeCompare(b.titel, 'de'));
}

/** Ideen, auf die jemand Bock hat – aus dem Katalog, sonst aus dem Schnappschuss. */
export function ideenMitBock(alle, st = aktuell()) {
  const nachSchluessel = new Map(alle.map((x) => [x.schluessel, x]));
  return [...haken('i:', st), ...haken('e:', st)].map(([k, s]) => nachSchluessel.get(k) || ideeAusSchnappschuss(k, s));
}

/** Passt die Idee zum Ideen-Filter? Alle gewählten Wirkungen müssen zutreffen. */
export function passtIdee(x, f) {
  if (f.wirkung.length && !f.wirkung.every((w) => x.wirkung.includes(w))) return false;
  if (f.wo && x.wo !== f.wo) return false;
  if (f.drinnen && !f.draussen && x.draussen === 'draußen') return false;
  if (f.draussen && !f.drinnen && x.draussen === 'drinnen') return false;
  if (f.kostenlos && !x.kostenlos) return false;
  if (f.kurz && x.dauer !== 'kurz') return false;
  if (f.zuZweit && x.mit.length && !x.mit.includes('zu zweit')) return false;
  return true;
}

export const ideenFilterAn = (f) => Boolean(f.wirkung.length || f.wo || f.drinnen || f.draussen || f.kostenlos || f.kurz || f.zuZweit);

/** Passt die Idee in diesen Monat (1–12)? Ohne Saison immer. */
export const inSaison = (x, monat) => !x.saison.length || x.saison.includes(monat);

const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

/** [10, 11, 12, 1, 2, 3] → „Okt–Mär“; Lücken werden zu mehreren Spannen. */
export function saisonText(saison) {
  const s = new Set(saison);
  if (!s.size || s.size === 12) return '';
  const nach = (m) => (m % 12) + 1;
  const vor = (m) => ((m + 10) % 12) + 1;
  const spannen = [];
  for (let m = 1; m <= 12; m++) {
    if (!s.has(m) || s.has(vor(m))) continue;
    let e = m;
    while (s.has(nach(e))) e = nach(e);
    spannen.push(e === m ? MONATE[m - 1] : `${MONATE[m - 1]}–${MONATE[e - 1]}`);
  }
  return spannen.join(', ');
}

/** Gemacht und bewertet, je Idee: wie oft, wie gut, wie oft mit Flow, wann zuletzt. */
export function bilanz(verlauf) {
  const m = new Map();
  for (const v of liste(verlauf)) {
    const b = m.get(v.schluessel) || { schluessel: v.schluessel, titel: v.titel || '', n: 0, bewertet: 0, summe: 0, flow: 0, zuletzt: '' };
    b.n += 1;
    if (v.bewertung >= 1 && v.bewertung <= 3) { b.bewertet += 1; b.summe += v.bewertung; }
    if (v.flow) b.flow += 1;
    if ((v.datum || '') > b.zuletzt) b.zuletzt = v.datum;
    if (v.titel) b.titel = v.titel;
    m.set(v.schluessel, b);
  }
  return m;
}

/**
 * Was dir guttut: im Schnitt mindestens „gut“, vorn, was am besten war und
 * öfter Flow brachte. Wiederholungen zählen ein wenig mit.
 */
export function tutGut(verlauf, n = 5) {
  return [...bilanz(verlauf).values()]
    .filter((b) => b.bewertet && b.summe / b.bewertet >= 2)
    .map((b) => ({ ...b, schnitt: b.summe / b.bewertet, wert: b.summe / b.bewertet + 0.5 * (b.flow / b.n) + 0.05 * Math.min(b.n, 5) }))
    .sort((a, b) => b.wert - a.wert || b.zuletzt.localeCompare(a.zuletzt))
    .slice(0, n);
}

const tage = (von, bis) => Math.round((new Date(`${bis}T12:00:00`) - new Date(`${von}T12:00:00`)) / 86400000);

/** „heute“, „gestern“, „vor 5 Tagen“, „vor 3 Wochen“, „vor 2 Monaten“. */
export function vorZeit(datum, heute) {
  const d = tage(datum, heute);
  if (d <= 0) return 'heute';
  if (d === 1) return 'gestern';
  if (d < 14) return `vor ${d} Tagen`;
  if (d < 60) return `vor ${Math.floor(d / 7)} Wochen`;
  return `vor ${Math.floor(d / 30)} Monaten`;
}
