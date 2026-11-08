/*
 * Die Gestaltung „Hafenlicht“ (css/styles.css): Termine als Tickets mit
 * Abriss; „Bock“ als Herz im Abriss, der dann im Bernstein leuchtet;
 * „in 30 Min“ und „läuft“ an Karten von heute, ohne Neuzeichnen aktuell
 * gehalten; das Wetter mit Zeichen und großer Temperatur; Zeichen an den
 * Tageszeiten; das Monatsblatt nach Dichte; Motive an den Kategorien der
 * Ideen; die Darstellung Automatisch/Hell/Dunkel (darstellung.js) und die
 * eigene Schrift (schrift/, Archivo).
 */
import {
  oeffne, testProgramm, MO, DI, SA,
} from './hilfe.mjs';

const basis = testProgramm();
const programm = testProgramm({
  tage: basis.tage.map((t) => (t.datum === MO ? { ...t, wetter: '4°/2°, bedeckt, kalt, meist trocken (Trend).', tipp: 'Fischmarkt früh.' } : t)),
  termine: [...basis.termine,
    {
      id: 'markt-heute', daten: [MO], zeit: '10:00–18:00', titel: 'Markt heute', ort: 'Rindermarkthalle', region: 'HH', kategorie: 'Markt', kostenlos: true, draussen: 'drinnen', link: 'https://example.org/markt',
    },
  ],
});
const A = await oeffne({ tag: MO, zeit: '14:30', programm });
const { page, check } = A;
const tag = page.locator(`#tag-${MO}`);
const karteMit = (text) => tag.locator('.karte', { hasText: text });

// --- Tickets
const karten = await tag.locator('.karte').count();
check(karten > 0 && await tag.locator('.karte.ticket').count() === karten && await tag.locator('.karte.ticket > .abriss > .zeit').count() === karten,
  'jede Karte am Tag ist ein Ticket: links der Abriss mit der Uhrzeit');
const markt = karteMit('Markt heute');
check((await markt.locator('.zeit').innerText()) === '10:00–18:00' && await markt.locator('.zeit wbr').count() === 1,
  'lange Zeiten brechen nach dem Strich um – der Text bleibt „10:00–18:00“');

// --- Gleich, läuft
check((await markt.locator('.live').innerText()) === 'läuft' && await markt.locator('.live.laeuft').count() === 1, '14:30: der Markt (10–18 Uhr) „läuft“');
const rallye = karteMit('Stadtrallye ohne Ort');
check((await rallye.locator('.live').innerText()) === 'in 30 Min' && await rallye.locator('.live.bald').count() === 1, '… die Stadtrallye um 15 Uhr: „in 30 Min“');
check(await karteMit('Gratis Lesung').locator('.live').isHidden(), '… die Lesung um 18 Uhr: noch nichts');
// Die Uhr läuft weiter, die App bleibt offen: Die Hinweise ändern sich an Ort und Stelle.
await markt.evaluate((el) => { el.dataset.alt = '1'; });
const vor = async (min) => page.evaluate((m) => { window.__uhrVor(m); document.dispatchEvent(new window.Event('visibilitychange')); }, min);
await vor(50);
check((await rallye.locator('.live').innerText()) === 'läuft' && await karteMit('Gratis Lesung').locator('.live').isHidden()
  && await markt.getAttribute('data-alt') === '1', '15:20: die Rallye „läuft“, die Lesung noch nicht – ohne Neuzeichnen');
await vor(85);
check((await karteMit('Gratis Lesung').locator('.live').innerText()) === 'in 75 Min', '16:45: die Lesung „in 75 Min“');
await A.zeigeTag(DI);
check(await page.locator(`#tag-${DI} .live`).count() === 0, 'an anderen Tagen kein „läuft“ und kein „gleich“');
await A.zeigeTag(MO);

// --- Bock im Abriss
check(await markt.locator('.abriss [data-bock]').count() === 1 && await markt.locator('.aktionen [data-bock]').count() === 0
  && await markt.locator('.abriss [data-bock] svg.herz').count() === 1 && (await markt.locator('.abriss [data-bock]').innerText()) === 'Bock',
'„Bock“ sitzt als Herz im Abriss, nicht mehr unten bei den Aktionen');
check(await markt.locator('.aktionen').isHidden(), 'zugeklappt bleibt unten keine leere Aktionszeile');
const farbe = (css) => page.evaluate((c) => {
  const el = document.createElement('i');
  el.style.color = c;
  document.body.append(el);
  const f = window.getComputedStyle(el).color;
  el.remove();
  return f;
}, css);
const abrissGrund = () => markt.locator('.abriss').evaluate((el) => window.getComputedStyle(el).backgroundColor);
const licht = await farbe('var(--licht)');
check(await abrissGrund() !== licht, 'ohne Bock: der Abriss in der ruhigen Fläche');
await markt.locator('.abriss [data-bock]').click();
await page.waitForTimeout(700); // das Aufleuchten ist eine kurze Animation
check(await markt.locator('.abriss [data-bock]').getAttribute('aria-pressed') === 'true' && await abrissGrund() === licht,
  'Bock: der Abriss leuchtet im Hafenlicht');
check(await markt.locator('.abriss .bock.frisch').count() === 1, '… und das Herz schlägt einmal (frisch)');
await markt.locator('.abriss [data-bock]').click();
check(await markt.locator('.abriss [data-bock]').getAttribute('aria-pressed') === 'false' && await abrissGrund() !== licht, 'noch ein Tipp: aus');
await markt.locator('.kopfzeile').click();
check(await markt.locator('.aktionen').isVisible() && await markt.locator('.aktionen a', { hasText: 'WhatsApp' }).isVisible(),
  'aufgeklappt: unten WhatsApp und Kalender');

// --- Wetter, Tipp, Tageszeiten
const wetter = tag.locator('.tag-info dd.wetter');
check(await wetter.locator('svg.wetter-zeichen').count() === 1 && (await wetter.locator('.temp').innerText()) === '4°/2°'
  && (await wetter.innerText()).includes('bedeckt, kalt, meist trocken'), 'Wetter: Zeichen, die Temperaturen groß, dann der Satz');
check(await tag.locator('.tag-info dt.tipp-titel').innerText() === 'Tipp', 'der Tipp hat seine Farbe');
const teile = await tag.locator('.tagesteil').evaluateAll((hs) => hs.map((h) => h.dataset.teil));
// 16:45: Die Rallye ist vorbei (geschätztes Ende) – übrig sind Vormittag (der Markt läuft noch) und Abend.
check(JSON.stringify(teile) === '["vormittag","abend"]', `die Tageszeiten tragen ihr Zeichen – Sonnenaufgang, Mond (${teile.join(', ')})`);

// --- Monat nach Dichte
await A.ansicht('monat');
const dichte = await page.$$eval('.feld[data-waehle]', (fs) => fs.map((f) => [f.dataset.waehle, f.style.getPropertyValue('--dichte')]).filter(([, d]) => d));
const werte = dichte.map(([, d]) => Number(d));
check(dichte.length > 0 && Math.max(...werte) === 1 && werte.every((d) => d > 0 && d <= 1), `Monat: jedes Feld mit Terminen färbt sich nach seiner Dichte (${dichte.length} Felder)`);
check(dichte.some(([d]) => d === SA), '… auch der volle Samstag');
await A.ansicht('tag');

// --- Ideen: Kategorien mit Motiv
check(await page.locator('#was-immer-geht .kategorie > summary .bildchen.motiv').count() === await page.locator('#was-immer-geht .kategorie').count(),
  '„Was immer geht“: jede Kategorie mit ihrem Motiv');

// --- Schrift
await page.evaluate(() => document.fonts.ready);
check(await page.evaluate(() => window.getComputedStyle(document.body).fontFamily.startsWith('Archivo') && document.fonts.check('800 20px Archivo')),
  'die eigene Schrift (Archivo) ist geladen');

// --- Darstellung
const schema = () => page.evaluate(() => document.documentElement.dataset.schema || '');
const grundHell = () => page.evaluate(() => {
  const m = window.getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number);
  return (m[0] + m[1] + m[2]) / 3 > 128;
});
check(await schema() === '' && await grundHell(), 'ohne Wahl: wie das Gerät – hier hell');
await A.ctx.pages()[0].emulateMedia({ colorScheme: 'dark' });
check(!(await grundHell()), '… schaltet das Gerät auf dunkel, wird es dunkel');
await A.ctx.pages()[0].emulateMedia({ colorScheme: 'light' });
await A.einstellungen();
const segment = (w) => page.locator(`#e-darstellung [data-aktion="darstellung"][data-wert="${w}"]`);
check(await segment('auto').getAttribute('aria-pressed') === 'true', 'Einstellungen → Darstellung: „Automatisch“ gewählt');
await segment('dunkel').click();
check(await schema() === 'dunkel' && !(await grundHell()) && await segment('dunkel').getAttribute('aria-pressed') === 'true'
  && await page.evaluate(() => localStorage.getItem('freizeit.darstellung')) === 'dunkel', '„Dunkel“: sofort dunkel, auf dem Gerät gemerkt');
check(await page.evaluate(() => [...document.querySelectorAll('meta[name="theme-color"]')].every((m) => m.content === '#0a1520')), '… die Browserleiste auch');
await page.reload();
check(await schema() === 'dunkel', 'nach dem Neuladen gleich dunkel – gesetzt, bevor die App startet');
await page.waitForSelector('#e-darstellung');
await segment('hell').click();
await A.ctx.pages()[0].emulateMedia({ colorScheme: 'dark' });
check(await schema() === 'hell' && await grundHell(), '„Hell“ bleibt hell, auch wenn das Gerät dunkel ist');
await segment('auto').click();
check(await schema() === '' && !(await grundHell()) && await page.evaluate(() => localStorage.getItem('freizeit.darstellung')) === null,
  '„Automatisch“: wieder wie das Gerät, nichts mehr gemerkt');
check(A.fehler.length === 0, `keine Fehler in der Konsole${A.fehler.length ? `: ${A.fehler.slice(0, 2).join(' | ')}` : ''}`);

await A.ende();
