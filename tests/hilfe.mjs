/*
 * Gemeinsames für die Browsertests (tests/test-*.mjs).
 *
 * Heißt nicht test-…, damit tests/lauf.mjs die Datei nicht selbst startet.
 * Stellt bereit:
 *
 *   - die Adresse der App auf dem Testserver (tests/server.mjs),
 *   - feste Testdaten: Die echten Dateien unter daten/ ändern sich jede
 *     Woche, die Tests dürfen davon nicht abhängen. oeffne() leitet die beiden
 *     Datendateien deshalb auf die Testdaten um,
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

/**
 * Stellt im Browser die Uhr fest, wenn __testtag (und __testzeit) im
 * localStorage stehen. Als Init-Skript vor jeder Seite: ctx.addInitScript(uhrStellen).
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
  const fest = new Echt(`${tag}T${zeit || '12:00'}:00`).getTime();
  function Mock(...args) {
    if (!(this instanceof Mock)) return new Echt(fest).toString();
    return args.length === 0 ? new Echt(fest) : new Echt(...args);
  }
  Mock.prototype = Echt.prototype;
  Mock.now = () => fest;
  Mock.parse = Echt.parse;
  Mock.UTC = Echt.UTC;
  window.Date = Mock;
}

const tage = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'];
export const [MO, DI, MI, DO, FR, SA, SO] = tage;

/**
 * Eine Testwoche, Mo 2.11. bis So 8.11.2026, ohne Feiertage. Jeder Termin
 * prüft eine Regel – der Name sagt, welche.
 */
export function testWoche(mehr = {}) {
  return {
    version: 1,
    stand: '2026-11-02T07:01',
    kw: 45,
    von: MO,
    bis: SO,
    infos: [{ titel: 'Ferien', text: 'keine' }],
    highlights: [{ titel: 'Highlight eins', text: 'Erster Text' }],
    tage: tage.map((datum) => ({ datum, wetter: `Wetter am ${datum}` })),
    termine: [
      { id: 'konzert-spaet', daten: [DI, FR], zeit: '20:00', titel: 'Konzert spät', ort: 'Docks', region: 'HH', kategorie: 'Konzert', beschreibung: 'Endet nach Richtwert um 22:15.', draussen: 'drinnen', link: 'https://example.org/konzert' },
      { id: 'theater-frueh', daten: [DI], zeit: '19:00', titel: 'Theater früh', ort: 'Thalia', region: 'HH', kategorie: 'Bühne', beschreibung: 'Schauspiel, ca. 2 Stunden.', preis: 'ab 20 €', draussen: 'drinnen', link: 'https://example.org/theater' },
      { id: 'kino-lang', daten: [MI], zeit: '19:00', ende: '22:30', titel: 'Kino lang', ort: 'Savoy', region: 'HH', kategorie: 'Kino', draussen: 'drinnen', imdb: '12', link: 'https://example.org/kino' },
      { id: 'nachtmarkt', daten: [MI], zeit: '18:00–22:00', titel: 'Nachtmarkt', ort: 'Rindermarkthalle', region: 'HH', kategorie: 'Markt', kostenlos: true, draussen: 'draußen', link: 'https://example.org/markt' },
      { id: 'workshop-mittags', daten: [DI], zeit: '12:30', titel: 'Workshop mittags', ort: 'Kochschule', region: 'HH', kategorie: 'Food', draussen: 'drinnen', link: 'https://example.org/workshop' },
      { id: 'party', daten: [DO, SA], zeit: '23:00', titel: 'Party', ort: 'Club', region: 'HH', kategorie: 'Party', draussen: 'drinnen', link: 'https://example.org/party' },
      { id: 'gratis-lesung', daten: [MO], zeit: '18:00', titel: 'Gratis Lesung', ort: 'Bücherhalle', region: 'HH', kategorie: 'Bühne', kostenlos: true, preis: 'kostenlos', draussen: 'drinnen', link: 'https://example.org/lesung' },
      { id: 'ausstellung', daten: tage, ganzeWoche: true, zeit: 'täglich 10–18', titel: 'Ausstellung X', ort: 'Kunsthalle', region: 'HH', kategorie: 'Ausstellung', draussen: 'drinnen', link: 'https://example.org/ausstellung' },
      { id: 'sonntagskonzert', daten: [SO], zeit: '19:30', titel: 'Sonntagskonzert', ort: 'Fabrik', region: 'HH', kategorie: 'Konzert', draussen: 'drinnen', link: 'https://example.org/so' },
      { id: 'hohwacht', daten: [SA], zeit: '11:00', titel: 'Strandwanderung', ort: 'Hohwacht', region: 'HB', kategorie: 'Führung', draussen: 'draußen', anreise: 'Auto ca. 1:30 h', link: 'https://example.org/hohwacht' },
      { id: 'stueck', daten: [DI, FR], zeit: '19:30', zeiten: { [FR]: '20:00' }, dauer: 110, titel: 'Theaterstück', ort: 'Ohnsorg', region: 'HH', kategorie: 'Bühne', draussen: 'drinnen', link: 'https://example.org/stueck' },
      { id: 'messe', daten: [SA], zeit: 'Sa 10–18', ganztags: true, titel: 'Messe', ort: 'Messehallen', region: 'HH', kategorie: 'Markt', draussen: 'drinnen', link: 'https://example.org/messe' },
    ],
    immer: [
      { id: 'elbstrand', titel: 'Elbstrand', ort: 'Övelgönne', region: 'HH', kategorie: 'Outdoor & Natur', zeiten: 'jederzeit', kostenlos: true, draussen: 'draußen', wetterabhaengig: true, link: 'https://example.org/strand' },
    ],
    hinweise: [{ titel: 'Abgesagt', text: 'nichts' }],
    ...mehr,
  };
}

export function testKonzerte(mehr = {}) {
  return {
    version: 1,
    stand: '2026-10-31T08:55',
    konzerte: [
      { id: 'alt', datum: '2026-10-01', zeit: '20:00', kuenstler: 'Vorbei Band', ort: 'Knust', stadt: 'Hamburg', link: 'https://example.org/alt' },
      { id: 'dez', datum: '2026-12-05', zeit: '20:00', kuenstler: 'Keane', titel: 'Tour 2026', ort: 'Sporthalle', stadt: 'Hamburg', link: 'https://example.org/keane' },
      { id: 'neu', datum: '2027-01-15', zeit: '19:30', kuenstler: 'The War On Drugs', titel: 'Europe Tour', ort: 'Barclays Arena', stadt: 'Hamburg', neu: true, vorverkauf: 'ab Fr 6.11.', link: 'https://example.org/twod' },
      { id: 'maerz', datum: '2027-03-14', kuenstler: 'Kurt Vile', ort: 'Pumpe', stadt: 'Kiel', ausverkauft: true, link: 'https://example.org/vile' },
    ],
    ...mehr,
  };
}

/**
 * Einen Browser starten und die App mit Testdaten öffnen.
 * @param {object} o
 * @param {string} [o.tag]        fester Tag „2026-11-02“
 * @param {string} [o.zeit]       feste Uhrzeit „10:00“
 * @param {object|null} [o.woche] Testwoche, null = Datei fehlt (404)
 * @param {object|null} [o.konzerte]
 * @param {object} [o.stand]      gespeicherter Stand vor dem Öffnen
 */
export async function oeffne({ tag = MO, zeit = '10:00', woche = testWoche(), konzerte = testKonzerte(), stand = null, viewport = { width: 390, height: 844 } } = {}) {
  const browser = await chromium.launch();
  // Ohne Service Worker: Er würde die umgeleiteten Daten am Test vorbei holen.
  // Den Offline-Betrieb prüft test-offline.mjs mit Worker.
  const ctx = await browser.newContext({ viewport, locale: 'de-DE', serviceWorkers: 'block' });
  await ctx.addInitScript(uhrStellen);
  const daten = { woche, konzerte };
  await ctx.route('**/daten/*.json', (route) => {
    const name = route.request().url().match(/daten\/(\w+)\.json/)[1];
    const inhalt = daten[name];
    if (inhalt === null || inhalt === undefined) return route.fulfill({ status: 404, body: 'fehlt' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(inhalt) });
  });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', (e) => fehler.push(`PAGEERROR: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) fehler.push(`CONSOLE: ${m.text()}`); });

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
  await page.reload({ waitUntil: 'networkidle' });
  await bereit();

  /** Uhr neu stellen und neu laden. */
  const uhr = async (t, z = '10:00') => {
    await page.evaluate(({ tt, zz }) => { localStorage.setItem('__testtag', tt); localStorage.setItem('__testzeit', zz); }, { tt: t, zz: z });
    await page.reload({ waitUntil: 'networkidle' });
    await bereit();
  };
  /** Andere Daten ausliefern (z. B. die Woche danach) und neu laden. */
  const datenTauschen = async (neu) => {
    Object.assign(daten, neu);
    await page.reload({ waitUntil: 'networkidle' });
    await bereit();
  };
  const reiter = async (name) => {
    await page.click(`[data-reiter="${name}"]`);
    await bereit();
  };
  /** Titel der sichtbaren Karten eines Tages. */
  const titelAm = (datum) => page.$$eval(`#tag-${datum} .karte h3`, (hs) => hs.map((h) => h.textContent));
  const gespeichert = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), SCHLUESSEL);

  const ende = async () => {
    check(fehler.length === 0, `keine Fehler in der Konsole${fehler.length ? `: ${fehler.slice(0, 3).join(' | ')}` : ''}`);
    await browser.close();
    if (!oks) process.exitCode = 1;
    process.exit(fails ? 1 : 0);
  };

  return { browser, ctx, page, check, fehler, uhr, datenTauschen, reiter, titelAm, gespeichert, ende, daten };
}
