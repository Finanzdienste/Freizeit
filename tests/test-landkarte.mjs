/*
 * Reiter „Karte“: Marker je Ort, Zeiträume, die Liste am Marker mit
 * Bock-Knopf, und dass ein Haken den Marker umfärbt, ohne die Liste zu
 * schließen. Die Kacheln liefert hilfe.mjs als leeres Bild.
 */
import { oeffne, MO, DI } from './hilfe.mjs';

const { page, check, reiter, ende } = await oeffne({ tag: MO, zeit: '10:00' });
await reiter('karte');
await page.waitForSelector('.leaflet-container .leaflet-marker-icon', { timeout: 10000 });

const modul = (fn, arg) => page.evaluate(async ({ f, a }) => {
  const m = await import('./js/ansicht-landkarte.js');
  return m[f](a);
}, { f: fn, a: arg });
const fuss = () => page.locator('#karte-fuss').innerText();
const raum = async (r) => {
  await page.click(`[data-raum="${r}"]`);
  await page.waitForTimeout(200);
};

check(await page.evaluate(() => Boolean(window.L && window.L.markerClusterGroup)), 'Leaflet und das Zusammenfassen sind geladen');
check(await page.locator('[data-raum="woche"]').getAttribute('aria-pressed') === 'true', 'voreingestellt: diese Woche');
const woche = await modul('markerZahl');
check(woche >= 10, `diese Woche: ${woche} Orte auf der Karte`);
check((await fuss()).includes('1 ohne Ortsangabe'), 'die Stadtrallye ohne Ort wird gezählt, nicht gezeigt');

await raum('heute');
check(await modul('markerZahl') === 2 && (await fuss()).startsWith('2 Einträge an 2 Orten'), 'heute: Lesung und Ausstellung, zwei Orte');
await raum('bock');
check(await modul('markerZahl') === 0, 'mit Bock: noch nichts');
await raum('alles');
const alles = await modul('markerZahl');
check(alles >= woche + 2, `alles: mehr Orte als diese Woche (${alles}), mit Konzert im Januar und Strand`);

// Die Liste am Marker und der Bock-Knopf darin.
await raum('woche');
check(await modul('markerOeffnen', 'Thalia') === true, 'der Marker des Thalia lässt sich öffnen');
const pop = page.locator('.leaflet-popup .pop');
await pop.waitFor();
check((await pop.locator('.pop-ort').innerText()) === 'Thalia' && (await pop.innerText()).includes('Theater früh'), 'die Liste nennt Ort und Termin');
check((await pop.locator('.pop-wann').first().innerText()).startsWith('Di 3.11. · 19:00'), 'mit Tag und Uhrzeit');
await pop.locator('[data-bock]').click();
check(await pop.locator('[data-bock]').getAttribute('aria-pressed') === 'true', 'Bock aus der Liste heraus – der Knopf zeigt es');
check(await page.locator('.leaflet-popup').count() === 1, 'die Liste bleibt dabei offen');
check(await page.locator('.leaflet-marker-icon .pin.ich').count() >= 1, 'der Marker trägt jetzt deine Farbe');
await raum('bock');
check(await modul('markerZahl') === 1, 'mit Bock: genau der eine Ort');

// Von der Karte ins Programm.
await modul('markerOeffnen', 'Thalia');
await page.locator('.leaflet-popup [data-zu-tag]').click();
check(await page.locator('[data-reiter="programm"]').getAttribute('aria-current') === 'page', '„im Programm“ wechselt den Reiter');
check(await page.locator(`#tag-${DI} .karte`, { hasText: 'Theater früh' }).locator('[data-bock]').getAttribute('aria-pressed') === 'true',
  'dort steht derselbe Haken');

await ende();
