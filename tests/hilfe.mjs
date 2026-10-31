/*
 * Gemeinsames für die Browsertests (tests/test-*.mjs).
 *
 * Heißt nicht test-…, damit tests/lauf.mjs die Datei nicht selbst startet.
 * Stellt bereit:
 *
 *   - die Adresse der App auf dem Testserver (tests/server.mjs),
 *   - feste Testdaten: daten/programm.json ändert sich jede Woche, der
 *     Ideen-Katalog ab und zu – die Tests dürfen von beiden nicht abhängen.
 *     oeffne() leitet die Dateien um,
 *   - einen nachgebauten Server für den gemeinsamen Plan (fakeServer()), der
 *     sich verhält wie supabase/gemeinsam.sql – mehrere Browser können ihn
 *     teilen. Echte Anfragen an Supabase gehen aus Tests nie hinaus,
 *   - Kacheln der Landkarte als leeres Bild (kein Netz nötig),
 *   - eine feste Uhr (über localStorage __testtag/__testzeit),
 *   - check() mit der Ausgabe, die tests/lauf.mjs zählt.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Wurzel des Repositorys – eine Ebene über dieser Datei. */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const APP_URL = process.env.FREIZEIT_URL || 'http://127.0.0.1:8099/index.html';
export const SCHLUESSEL = 'freizeit.stand.v1';
export const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const SUPABASE = 'https://vjyohppohmvhhxgwouti.supabase.co/rest/v1/rpc/*';
const FUNKTION = 'https://vjyohppohmvhhxgwouti.supabase.co/functions/v1/freizeit-push';
// 1×1 durchsichtig – statt Kacheln von tile.openstreetmap.org
const LEERES_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

/**
 * Stellt im Browser die Uhr, wenn __testtag (und __testzeit) im localStorage
 * stehen. Als Init-Skript vor jeder Seite: ctx.addInitScript(uhrStellen).
 */
export function uhrStellen() {
  let tag = null;
  let zeit = null;
  try {
    tag = localStorage.getItem('__testtag');
    zeit = localStorage.getItem('__testzeit');
  } catch { /* about:blank */ }
  if (!tag) return;
  const Echt = Date;
  // Fester Tag und feste Uhrzeit beim Laden – danach läuft die Uhr weiter.
  // Eine stehende Uhr hielte Leaflets Animationen an (Kacheln blieben
  // unsichtbar, Verschieben endete nie).
  const start = Echt.now();
  const fest = new Echt(`${tag}T${zeit || '12:00'}:00`).getTime();
  const jetzt = () => fest + (Echt.now() - start);
  function Mock(...args) {
    if (!(this instanceof Mock)) return new Echt(jetzt()).toString();
    return args.length === 0 ? new Echt(jetzt()) : new Echt(...args);
  }
  Mock.prototype = Echt.prototype;
  Mock.now = jetzt;
  Mock.parse = Echt.parse;
  Mock.UTC = Echt.UTC;
  window.Date = Mock;
}

const plus = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const tage = Array.from({ length: 14 }, (_, i) => plus('2026-11-02', i));
export const [MO, DI, MI, DO, FR, SA, SO] = tage;
export const [MO2, DI2, MI2, DO2, FR2, SA2, SO2] = tage.slice(7);
export const FERN = '2027-01-15';

const HH = [53.5503, 9.9930];
const geo = (dy, dx) => [Number((HH[0] + dy).toFixed(5)), Number((HH[1] + dx).toFixed(5))];

/**
 * Ein Programm über zwei Wochen, Mo 2.11. bis So 15.11.2026, ohne Feiertage,
 * dazu ein Konzert im Januar. Jeder Termin prüft eine Regel – der Name sagt,
 * welche. Online & TV steht nur in der zweiten Woche (test-online.mjs).
 */
export function testProgramm(mehr = {}) {
  return {
    version: 2,
    stand: '2026-11-02T07:01',
    von: MO,
    bis: SO2,
    infos: [{ titel: 'Ferien', text: 'keine' }],
    highlights: [{ titel: 'Highlight eins', text: 'Erster Text' }],
    tage: tage.map((datum) => ({ datum, wetter: `Wetter am ${datum}` })),
    termine: [
      { id: 'konzert-spaet', daten: [DI, FR], zeit: '20:00', titel: 'Konzert spät', ort: 'Docks', geo: geo(0.004, -0.03), region: 'HH', kategorie: 'Konzert', beschreibung: 'Endet nach Richtwert um 22:15.', draussen: 'drinnen', link: 'https://example.org/konzert' },
      { id: 'theater-frueh', daten: [DI], zeit: '19:00', titel: 'Theater früh', ort: 'Thalia', geo: geo(0.002, 0.003), region: 'HH', kategorie: 'Bühne', beschreibung: 'Schauspiel, ca. 2 Stunden.', preis: 'ab 20 €', draussen: 'drinnen', link: 'https://example.org/theater' },
      { id: 'kino-lang', daten: [MI], zeit: '19:00', ende: '22:30', titel: 'Kino lang', ort: 'Savoy', geo: geo(0.004, 0.01), region: 'HH', kategorie: 'Kino', draussen: 'drinnen', imdb: '12', link: 'https://example.org/kino' },
      { id: 'nachtmarkt', daten: [MI], zeit: '18:00–22:00', titel: 'Nachtmarkt', ort: 'Rindermarkthalle', geo: geo(0.006, -0.025), region: 'HH', kategorie: 'Markt', kostenlos: true, draussen: 'draußen', link: 'https://example.org/markt' },
      { id: 'workshop-mittags', daten: [DI], zeit: '12:30', titel: 'Workshop mittags', ort: 'Kochschule', geo: geo(-0.01, 0.02), region: 'HH', kategorie: 'Food', draussen: 'drinnen', link: 'https://example.org/workshop' },
      { id: 'party', daten: [DO, SA], zeit: '23:00', titel: 'Party', ort: 'Club', geo: geo(0.005, -0.04), region: 'HH', kategorie: 'Party', draussen: 'drinnen', link: 'https://example.org/party' },
      { id: 'gratis-lesung', daten: [MO], zeit: '18:00', titel: 'Gratis Lesung', ort: 'Bücherhalle', geo: geo(-0.002, 0.004), region: 'HH', kategorie: 'Bühne', kostenlos: true, preis: 'kostenlos', draussen: 'drinnen', link: 'https://example.org/lesung' },
      { id: 'sonntagskonzert', daten: [SO], zeit: '19:30', titel: 'Sonntagskonzert', ort: 'Fabrik', geo: geo(0.003, -0.07), region: 'HH', kategorie: 'Konzert', draussen: 'drinnen', link: 'https://example.org/so' },
      { id: 'hohwacht', daten: [SA], zeit: '11:00', titel: 'Strandwanderung', ort: 'Hohwacht', geo: [54.3197, 10.6736], region: 'HB', kategorie: 'Führung', draussen: 'draußen', anreise: 'Auto ca. 1:30 h', link: 'https://example.org/hohwacht' },
      { id: 'stueck', daten: [DI, FR], zeit: '19:30', zeiten: { [FR]: '20:00' }, dauer: 110, titel: 'Theaterstück', ort: 'Ohnsorg', geo: geo(-0.0005, 0.007), region: 'HH', kategorie: 'Bühne', draussen: 'drinnen', link: 'https://example.org/stueck' },
      { id: 'messe', daten: [SA], zeit: 'Sa 10–18', ganztags: true, titel: 'Messe', ort: 'Messehallen', geo: geo(0.011, -0.012), region: 'HH', kategorie: 'Markt', draussen: 'drinnen', link: 'https://example.org/messe' },
      { id: 'mein-konzert', daten: [DI], zeit: '20:00', titel: 'Keane', ort: 'Sporthalle', geo: geo(0.04, 0.03), region: 'HH', kategorie: 'Konzert', kuenstler: true, beschreibung: 'Tour 2026.', link: 'https://example.org/keane' },
      { id: 'ohne-ort', daten: [MO], zeit: '15:00', titel: 'Stadtrallye ohne Ort', ort: 'irgendwo', region: 'HH', kategorie: 'Erlebnis', link: 'https://example.org/rallye' },
      { id: 'zweite-woche', daten: [DI2], zeit: '18:30', titel: 'Lesung zweite Woche', ort: 'Literaturhaus', geo: geo(0.01, 0.02), region: 'HH', kategorie: 'Bühne', link: 'https://example.org/lesung2' },
      // Online & TV (zweite Woche): ohne Ort, der Sender steht in `ort`; für die 21:30-Regel zählt der Beginn.
      { id: 'cl-dazn', daten: [DI2], zeit: '21:00', dauer: 115, titel: 'Champions League: Bayern – Paris', ort: 'DAZN', online: true, region: 'ONL', kategorie: 'Sport', preis: 'im DAZN-Abo', draussen: 'drinnen', link: 'https://example.org/cl' },
      { id: 'schach-partie', daten: [MI2, FR2], zeit: '22:00', dauer: 300, titel: 'Schach-WM, Partie 5', ort: 'YouTube · FIDE', online: true, region: 'ONL', kategorie: 'Schach', kostenlos: true, draussen: 'drinnen', link: 'https://example.org/schach' },
      { id: 'laenderspiel', daten: [SA2], zeit: '20:45', dauer: 115, titel: 'Länderspiel: Deutschland – Frankreich', ort: 'ZDF', online: true, region: 'ONL', kategorie: 'Sport', kostenlos: true, draussen: 'drinnen', link: 'https://example.org/laenderspiel' },
      { id: 'twod', daten: [FERN], zeit: '19:30', titel: 'The War On Drugs', ort: 'Barclays Arena', geo: [53.5893, 9.8991], region: 'HH', kategorie: 'Konzert', kuenstler: true, neu: true, vorverkauf: 'ab Fr 6.11.', link: 'https://example.org/twod' },
    ],
    laufend: [
      { id: 'ausstellung', von: '2026-10-20', bis: '2026-11-08', zeit: 'Di–So 10–18', titel: 'Ausstellung X', ort: 'Kunsthalle', geo: geo(0.003, 0.006), region: 'HH', kategorie: 'Ausstellung', draussen: 'drinnen', link: 'https://example.org/ausstellung' },
    ],
    immer: [
      { id: 'elbstrand', titel: 'Elbstrand', ort: 'Övelgönne', geo: [53.5452, 9.9163], region: 'HH', kategorie: 'Outdoor & Natur', zeiten: 'jederzeit', kostenlos: true, draussen: 'draußen', wetterabhaengig: true, link: 'https://example.org/strand' },
    ],
    hinweise: [{ titel: 'Abgesagt', text: 'nichts' }],
    ...mehr,
  };
}

/**
 * Ein kleiner Ideen-Katalog: je Kategorie eine Idee mit dem, was die Tests
 * brauchen – Flow, Zuhause, zu zweit, Orte für die Karte, eine Idee
 * außerhalb der Saison (Tretboot im November).
 */
export function testIdeen(mehr = {}) {
  return {
    version: 1,
    stand: '2026-10-27',
    ideen: [
      { id: 'tischtennis', titel: 'Tischtennis im Park', kategorie: 'sport', text: 'An öffentlichen Platten.', wirkung: ['flow', 'bewegung'], mit: ['zu zweit', 'gruppe'], wo: 'hamburg', draussen: 'draußen', dauer: 'kurz', kostenlos: true, braucht: 'Schläger und Bälle', ziel: 'Die längste Serie schlagen.', link: 'https://example.org/tt', orte: [{ name: 'Hammer Park', teil: 'Hamm', geo: geo(0.0084, 0.0664), link: 'https://example.org/tt-hamm', info: 'zwei Platten' }, { name: 'Stadtpark Platten', teil: 'Winterhude', geo: geo(0.0466, 0.0281), link: 'https://example.org/tt-stadtpark' }] },
      { id: 'buegelperlen', titel: 'Bügelperlen', kategorie: 'kreativ', text: 'Pixel für Pixel.', wirkung: ['flow', 'erholung'], mit: ['allein', 'zu zweit'], wo: 'zuhause', draussen: 'drinnen', dauer: 'kurz', braucht: 'Perlen und Platten' },
      { id: 'story-game', titel: 'Story-Game', kategorie: 'spiele', text: "Assassin's Creed & Co.", wirkung: ['flow', 'erholung'], mit: ['allein'], wo: 'zuhause', draussen: 'drinnen', dauer: 'kurz', kostenlos: true },
      { id: 'sauna', titel: 'Sauna-Abend', kategorie: 'entspannen', text: 'Aufgüsse und Ruhe.', wirkung: ['erholung'], mit: ['allein', 'zu zweit'], wo: 'hamburg', draussen: 'drinnen', dauer: 'halbtags', preis: 'ca. 25 €', orte: [{ name: 'Therme', teil: 'Barmbek', geo: geo(0.0266, 0.0342) }] },
      { id: 'timmendorf', titel: 'Timmendorfer Strand', kategorie: 'ausflug', text: 'Ostsee mit Seebrücke.', wirkung: ['erholung', 'bewegung'], mit: ['zu zweit'], wo: 'ausflug', draussen: 'draußen', dauer: 'ganztags', anreise: 'RE8 und RB85', link: 'https://example.org/timmendorf', orte: [{ name: 'Timmendorfer Strand', geo: [54.001, 10.7853] }] },
      { id: 'tretboot', titel: 'Tretboot', kategorie: 'sport', text: 'Auf der Alster.', wirkung: ['bewegung'], mit: ['zu zweit'], wo: 'hamburg', draussen: 'draußen', dauer: 'kurz', saison: [4, 5, 6, 7, 8, 9] },
      { id: 'sprache', titel: 'Sprache lernen', kategorie: 'lernen', text: 'Jeden Tag ein bisschen.', wirkung: ['produktiv', 'flow'], mit: ['allein'], wo: 'zuhause', draussen: 'drinnen', dauer: 'kurz', kostenlos: true },
    ],
    ...mehr,
  };
}

/**
 * Der Server für den gemeinsamen Plan, nachgebaut nach supabase/gemeinsam.sql:
 * dieselben vier Funktionen, dieselben Rollen und Fehlermeldungen, Räume nach
 * Code. Wer den Raum mit Schlüssel anlegt, ist Gastgeber und sieht alles; die
 * anderen sehen ihn als „gastgeber“ und sich selbst. Ohne hinterlegten
 * Schlüssel ist Gastgeber, wer am längsten drin ist (Räume der ersten
 * Fassung). Den Schlüssel behält der nachgebaute Server im Klartext – er ist
 * ja nur ein Test.
 *
 * Zwei Browser, die denselben bekommen, sehen dieselben Räume. Ein Raum ist
 * { personen: [{ id, name }] in der Reihenfolge des Eintretens,
 *   bock: Map 'person|eintrag' → { person, eintrag, daten, geaendert },
 *   gastgeber: { person, schluessel } | null,
 *   push: Map endpoint → Abo (die Geräte des Gastgebers, freizeit_push),
 *   nachrichten: [{ art, name, daten }] – was die Datenbank für die Edge
 *   Function sammelt, sobald ein Abo da ist (neu, bock, aus, weg) }.
 * `offline = true` lässt jede Anfrage scheitern wie ohne Netz.
 */
/**
 * Push, nachgebaut: Im Test gibt es keinen Service Worker (und ohne
 * Push-Dienst kein echtes Abo). Die Attrappe antwortet wie ein Browser, der
 * eins hat – mit einem Abo, dessen Schlüssel die Form echter haben – und
 * merkt sich unter window.__push, was die App tat: Erlaubnis gefragt,
 * abonniert (mit welchem Schlüssel), gekündigt.
 * @param {string} antwort  was die Erlaubnisfrage ergibt: granted, denied, default –
 *                          oder 'keins': ein Browser ohne Push (iPhone im Browser, alte Browser)
 */
function pushAttrappe(antwort) {
  if (antwort === 'keins') {
    try { delete window.PushManager; } catch { /* dann unten */ }
    if ('PushManager' in window) Object.defineProperty(window, 'PushManager', { value: undefined, configurable: true });
    return;
  }
  // Wie ein Browser behält die Attrappe Abo und Zähler über ein Neuladen (localStorage).
  let gemerkt = { gefragt: 0, abonniert: 0, gekuendigt: 0, schluessel: null, abo: false };
  try { gemerkt = { ...gemerkt, ...JSON.parse(localStorage.getItem('__push') || '{}') }; } catch { /* frisch */ }
  const protokoll = gemerkt;
  window.__push = protokoll;
  const merken = () => { try { localStorage.setItem('__push', JSON.stringify(protokoll)); } catch { /* egal */ } };
  const b64 = (n, zeichen) => zeichen.repeat(n);
  let abo = null;
  const aboBauen = (schluessel) => ({
    endpoint: 'https://push.example.org/send/testgeraet',
    options: { applicationServerKey: schluessel ? new Uint8Array(schluessel).buffer : null },
    toJSON: () => ({ endpoint: 'https://push.example.org/send/testgeraet', keys: { p256dh: `B${b64(86, 'k')}`, auth: b64(22, 'a') } }),
    unsubscribe: async () => { protokoll.gekuendigt++; protokoll.abo = false; abo = null; merken(); return true; },
  });
  if (protokoll.abo) abo = aboBauen(protokoll.schluessel);
  const neuesAbo = (optionen) => {
    protokoll.abonniert++;
    protokoll.schluessel = optionen && optionen.applicationServerKey ? Array.from(new Uint8Array(optionen.applicationServerKey)) : null;
    protokoll.abo = true;
    abo = aboBauen(protokoll.schluessel);
    merken();
    return abo;
  };
  const registrierung = {
    pushManager: { getSubscription: async () => abo, subscribe: async (o) => neuesAbo(o) },
    showNotification: async () => {},
  };
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve(registrierung), getRegistration: async () => registrierung, register: async () => registrierung, addEventListener() {}, controller: null },
  });
  window.PushManager = function PushManager() {};
  let erlaubnis = antwort === 'denied' ? 'denied' : 'default';
  window.Notification = function Notification() {};
  Object.defineProperty(window.Notification, 'permission', { get: () => erlaubnis });
  window.Notification.requestPermission = async () => { protokoll.gefragt++; erlaubnis = antwort; merken(); return antwort; };
}

export function fakeServer() {
  const raeume = new Map();
  const aufrufe = [];
  // Der öffentliche VAPID-Schlüssel, den die Edge Function herausgibt (65 Byte base64url).
  const s = { offline: false, aufrufe, raeume, vapid: `B${'A'.repeat(86)}` };
  const melden = (r, art, person, daten = null) => {
    if (!r || !r.push || !r.push.size) return;
    const x = r.personen.find((y) => y.id === person);
    r.nachrichten.push({ art, name: x ? x.name : '', daten });
  };
  const gastgeberVon = (r) => (r.gastgeber ? r.gastgeber.person : (r.personen[0] ? r.personen[0].id : null));
  class Abbruch extends Error {}
  const rolle = (r, person, schluessel) => {
    if (!person || !r || !r.personen.some((x) => x.id === person)) return 'gast';
    if (person !== gastgeberVon(r)) return 'mitglied';
    if (r.gastgeber && r.gastgeber.schluessel !== schluessel) throw new Abbruch('falscher Schlüssel');
    return 'gastgeber';
  };
  const stand = (r, person, wer) => {
    if (!r) return { rolle: wer, personen: [], bock: [] };
    const g = gastgeberVon(r);
    const sichtbar = (id) => wer === 'gastgeber' || id === g || (wer === 'mitglied' && id === person);
    const kennung = (id) => (wer !== 'gastgeber' && id === g ? 'gastgeber' : id);
    return {
      rolle: wer,
      personen: r.personen.filter((x) => sichtbar(x.id)).map(({ id, name }) => ({ id: kennung(id), name })),
      bock: wer === 'gast' ? [] : [...r.bock.values()].filter((b) => sichtbar(b.person))
        .sort((a, b) => a.geaendert.localeCompare(b.geaendert)).map((b) => ({ ...b, person: kennung(b.person) })),
    };
  };
  const personOk = (x) => /^[a-z0-9-]{8,40}$/.test(String(x || '')) && x !== 'gastgeber';
  const ohne = (r, id) => {
    r.personen = r.personen.filter((x) => x.id !== id);
    for (const [k, b] of r.bock) if (b.person === id) r.bock.delete(k);
  };

  s.route = async (route) => {
    if (s.offline) return route.abort('internetdisconnected');
    if (!route.request().url().includes('/rpc/')) {
      // Die Edge Function: GET gibt den öffentlichen Schlüssel, POST stößt die Zustellung an.
      aufrufe.push({ name: 'freizeit-push', methode: route.request().method() });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(route.request().method() === 'GET' ? { oeffentlich: s.vapid } : { nachrichten: 0 }) });
    }
    const name = route.request().url().split('/rpc/')[1];
    const p = route.request().postDataJSON() || {};
    aufrufe.push({ name, p });
    const antwort = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const fehler = (message) => antwort(400, { code: 'P0001', message });
    const code = String(p.p_code || '').toLowerCase();
    if (!/^[a-z0-9]{4}(-?[a-z0-9]{4}){2,4}$/.test(code)) return fehler('ungültiger Code');
    const r = raeume.get(code);
    const schluessel = p.p_schluessel ?? null;
    try {
      if (name === 'freizeit_lesen') {
        if (p.p_person !== undefined && p.p_person !== null && !personOk(p.p_person)) return fehler('ungültige Person');
        if (schluessel !== null && !/^[a-z0-9]{20,64}$/.test(schluessel)) return fehler('ungültiger Schlüssel');
        return antwort(200, stand(r, p.p_person, rolle(r, p.p_person, schluessel)));
      }
      if (!personOk(p.p_person)) return fehler('ungültige Person');
      if (schluessel !== null && !/^[a-z0-9]{20,64}$/.test(schluessel)) return fehler('ungültiger Schlüssel');
      if (name === 'freizeit_ich') {
        const n = String(p.p_name || '').trim();
        if (!n || n.length > 30) return fehler('Name fehlt oder ist zu lang');
        if (!r) {
          const neu = {
            personen: [{ id: p.p_person, name: n }], bock: new Map(), gastgeber: schluessel ? { person: p.p_person, schluessel } : null,
            push: new Map(), nachrichten: [],
          };
          raeume.set(code, neu);
          return antwort(200, stand(neu, p.p_person, 'gastgeber'));
        }
        const x = r.personen.find((y) => y.id === p.p_person);
        if (x) {
          const wer = rolle(r, p.p_person, schluessel);
          x.name = n;
          if (wer === 'gastgeber' && schluessel && !r.gastgeber) r.gastgeber = { person: p.p_person, schluessel };
          return antwort(200, stand(r, p.p_person, wer));
        }
        if (r.personen.length >= 30) return fehler('Raum ist voll');
        r.personen.push({ id: p.p_person, name: n });
        melden(r, 'neu', p.p_person);
        return antwort(200, stand(r, p.p_person, 'mitglied'));
      }
      if (name === 'freizeit_bock') {
        if (p.p_daten && JSON.stringify(p.p_daten).length > 2000) return fehler('Eintrag zu groß');
        const wer = rolle(r, p.p_person, schluessel);
        if (wer === 'gast') return fehler('unbekannte Person');
        const k = `${p.p_person}|${p.p_eintrag}`;
        const alt = r.bock.get(k);
        const mitwem = (d) => (d && d.mitwem) || '';
        if (p.p_bock) {
          r.bock.set(k, { person: p.p_person, eintrag: p.p_eintrag, daten: p.p_daten || null, geaendert: new Date().toISOString() });
          if (wer === 'mitglied' && (!alt || mitwem(alt.daten) !== mitwem(p.p_daten))) melden(r, 'bock', p.p_person, { ...(p.p_daten || {}), eintrag: p.p_eintrag });
        } else {
          r.bock.delete(k);
          if (alt && wer === 'mitglied' && mitwem(alt.daten) === 'gastgeber') melden(r, 'aus', p.p_person, { ...(alt.daten || {}), eintrag: p.p_eintrag });
        }
        return antwort(200, stand(r, p.p_person, wer));
      }
      if (name === 'freizeit_weg') {
        const opfer = p.p_wer ?? p.p_person;
        if (!personOk(opfer)) return fehler('ungültige Person');
        const wer = rolle(r, p.p_person, schluessel);
        if (opfer === p.p_person) {
          if (wer === 'gastgeber' && r.gastgeber) raeume.delete(code);
          else if (r) { if (wer === 'mitglied') melden(r, 'weg', p.p_person); ohne(r, p.p_person); }
          if (r && !r.personen.length) raeume.delete(code);
          return antwort(200, stand(raeume.get(code), null, 'gast'));
        }
        if (wer !== 'gastgeber' || !r.gastgeber) return fehler('nur der Gastgeber');
        ohne(r, opfer);
        return antwort(200, stand(r, p.p_person, wer));
      }
      if (name === 'freizeit_push') {
        const abo = p.p_abo;
        if (!abo || typeof abo !== 'object' || typeof abo.endpoint !== 'string' || !/^https:\/\/\S{8,}$/.test(abo.endpoint)
          || !abo.keys || !/^[A-Za-z0-9_=-]{80,120}$/.test(abo.keys.p256dh || '') || !/^[A-Za-z0-9_=-]{16,32}$/.test(abo.keys.auth || '')) {
          return fehler('ungültiges Abo');
        }
        if (!r || rolle(r, p.p_person, schluessel) !== 'gastgeber' || !r.gastgeber) return fehler('nur der Gastgeber');
        if (!r.push) { r.push = new Map(); r.nachrichten = []; }
        if (p.p_an) {
          if (!r.push.has(abo.endpoint) && r.push.size >= 5) return fehler('zu viele Geräte');
          r.push.set(abo.endpoint, abo);
        } else {
          r.push.delete(abo.endpoint);
        }
        return antwort(200, { push: Boolean(p.p_an), geraete: r.push.size });
      }
    } catch (e) {
      if (e instanceof Abbruch) return fehler(e.message);
      throw e;
    }
    return antwort(404, { code: 'PGRST202', message: 'Could not find the function' });
  };
  return s;
}

/**
 * Einen Browser starten und die App mit Testdaten öffnen.
 * @param {object} o
 * @param {string} [o.tag]            fester Tag „2026-11-02“
 * @param {string} [o.zeit]           feste Uhrzeit „10:00“
 * @param {object|null} [o.programm]  Testdaten, null = Datei fehlt (404)
 * @param {object|null} [o.ideen]     Ideen-Katalog, null = Datei fehlt (404)
 * @param {object} [o.stand]          gespeicherter Stand vor dem Öffnen
 * @param {object} [o.server]         gemeinsamer Plan (fakeServer()), sonst ein eigener
 * @param {string} [o.ua]             anderer User-Agent (z. B. IPHONE)
 * @param {string} [o.hash]           Adresse ab # beim ersten Öffnen (z. B. „einladung=…“)
 * @param {object} [o.browser]        vorhandenen Browser mitbenutzen (zweite Person)
 * @param {string} [o.push]           Push-Attrappe statt des Browsers: 'granted' | 'denied' | 'default'
 *                                    (die Antwort auf die Erlaubnisfrage) oder 'keins' (ein Browser ohne
 *                                    Push); ohne Angabe bleibt der Browser, wie er ist
 */
export async function oeffne({
  tag = MO, zeit = '10:00', programm = testProgramm(), ideen = testIdeen(), stand = null, server = fakeServer(), ua = '', hash = '',
  viewport = { width: 390, height: 844 }, browser: geteilt = null, scale = 1, push = '',
} = {}) {
  const browser = geteilt || await chromium.launch();
  // Ohne Service Worker: Er würde die umgeleiteten Daten am Test vorbei holen.
  // Den Offline-Betrieb prüft test-offline.mjs mit Worker.
  const ctx = await browser.newContext({
    viewport, deviceScaleFactor: scale, locale: 'de-DE', serviceWorkers: 'block', ...(ua ? { userAgent: ua } : {}),
  });
  await ctx.addInitScript(uhrStellen);
  if (push) await ctx.addInitScript(pushAttrappe, push);
  const daten = { programm, ideen };
  await ctx.route('**/daten/programm.json', (route) => {
    if (daten.programm === null || daten.programm === undefined) return route.fulfill({ status: 404, body: 'fehlt' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(daten.programm) });
  });
  await ctx.route('**/daten/ideen.json', (route) => {
    if (daten.ideen === null || daten.ideen === undefined) return route.fulfill({ status: 404, body: 'fehlt' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(daten.ideen) });
  });
  await ctx.route(SUPABASE, (route) => server.route(route));
  await ctx.route(FUNKTION, (route) => server.route(route));
  await ctx.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: LEERES_PNG }));
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', (e) => fehler.push(`PAGEERROR: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/404|ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(m.text())) fehler.push(`CONSOLE: ${m.text()}`);
  });

  let fails = 0;
  let oks = 0;
  const check = (c, m) => {
    console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`);
    if (c) oks++; else { fails++; process.exitCode = 1; }
  };

  const bereit = () => page.waitForFunction(() => !document.querySelector('#ansicht').textContent.includes('Lädt'));
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.evaluate(({ t, z, s, key }) => {
    localStorage.clear();
    localStorage.setItem('__testtag', t);
    if (z) localStorage.setItem('__testzeit', z);
    if (s) localStorage.setItem(key, JSON.stringify(s));
  }, { t: tag, z: zeit, s: stand, key: SCHLUESSEL });
  // Über about:blank, damit auch ein Aufruf mit # die Seite wirklich neu lädt.
  await page.goto('about:blank');
  await page.goto(`${APP_URL}${hash ? `#${hash}` : ''}`, { waitUntil: 'networkidle' });
  await bereit();

  /** Uhr neu stellen und neu laden. */
  const uhr = async (t, z = '10:00') => {
    await page.evaluate(({ tt, zz }) => { localStorage.setItem('__testtag', tt); localStorage.setItem('__testzeit', zz); }, { tt: t, zz: z });
    await page.reload({ waitUntil: 'networkidle' });
    await bereit();
  };
  /** Andere Daten ausliefern (z. B. die Woche danach) und neu laden. */
  const datenTauschen = async (neu) => {
    daten.programm = neu;
    await page.reload({ waitUntil: 'networkidle' });
    await bereit();
  };
  /** Einen Reiter in der Leiste unten antippen (im Inhalt gibt es auch Knöpfe mit data-reiter). */
  const reiter = async (name) => {
    await page.click(`.reiterleiste [data-reiter="${name}"]`);
    await bereit();
  };
  /**
   * Einen Knopf antippen, der in einem zugeklappten Abschnitt stecken kann:
   * ist er nicht zu sehen, erst den Abschnitt aufklappen – so, wie es ein
   * Mensch täte.
   */
  const tippen = async (selektor) => {
    const knopf = page.locator(selektor).first();
    if (!(await knopf.isVisible())) await knopf.locator('xpath=ancestor::details[1]/summary').click();
    await knopf.click();
  };
  /** Die Einstellungen öffnen (der Reiter ganz rechts – er ist immer da). */
  const einstellungen = async () => {
    await page.click('.reiterleiste [data-reiter="einstellungen"]');
    await page.waitForSelector('#ansicht .seiten-titel');
  };
  /** Ein Knopf auf der Seite – steht er dort nicht, dann in den Einstellungen (Abgleich, Name, Gerät, So geht's, Verlassen …). */
  const aktion = async (name) => {
    if (!(await page.locator(`#ansicht [data-aktion="${name}"]`).count())) await einstellungen();
    await tippen(`#ansicht [data-aktion="${name}"]`);
  };
  /** Das Filter-Blatt des Reiters öffnen, darin etwas tun und es wieder schließen (✕). */
  const imFilter = async (tun) => {
    await page.click('#ansicht [data-aktion="filter-auf"]');
    await page.locator('#blatt.offen').waitFor();
    await tun();
    await page.click('#blatt .blatt-x');
    await page.locator('#blatt').waitFor({ state: 'detached' });
  };
  /** Ein Filter-Schalter im Blatt: Programm und Karte (data-filter) oder Ideen (data-ifilter). */
  const filter = (name) => imFilter(() => page.click(`#blatt [data-filter="${name}"], #blatt [data-ifilter="${name}"]`));
  /** Eine Auswahl im Filter-Blatt, etwa die Region: waehle('#f-region', 'HB'). */
  const waehle = (selektor, wert) => imFilter(() => page.selectOption(`#blatt ${selektor}`, wert));
  /** Ins Programm, in eine seiner Ansichten: liste, monat, woche, tag. */
  const ansicht = async (name) => {
    await reiter('programm');
    await page.click(`[data-kal-ansicht="${name}"]`);
    await bereit();
  };
  /** Titel der sichtbaren Karten eines Tages im Programm. */
  const titelAm = (datum) => page.$$eval(`#tag-${datum} .karte h3`, (hs) => hs.map((h) => h.textContent));
  const gespeichert = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), SCHLUESSEL);
  /** Bis der gemeinsame Plan nichts mehr zu senden hat und abgeholt ist. */
  const abgeglichen = () => page.waitForFunction((key) => {
    const st = JSON.parse(localStorage.getItem(key) || 'null');
    return st && st.gemeinsam && !st.warteschlange.length && st.gemeinsam.abgeholt;
  }, SCHLUESSEL, { timeout: 8000 });

  const ende = async ({ schliessen = true } = {}) => {
    check(fehler.length === 0, `keine Fehler in der Konsole${fehler.length ? `: ${fehler.slice(0, 3).join(' | ')}` : ''}`);
    if (schliessen) await browser.close();
    if (!oks) process.exitCode = 1;
    if (schliessen) process.exit(fails ? 1 : 0);
  };

  return {
    browser, ctx, page, check, fehler, uhr, datenTauschen, reiter, ansicht, tippen, aktion, einstellungen, imFilter, filter, waehle, titelAm,
    gespeichert, abgeglichen, ende, daten, server, stats: () => ({ oks, fails }),
  };
}
