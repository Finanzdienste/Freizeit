/*
 * Reiter „Karte“: Marker je Ort, der Zeitraum, das Filter-Blatt mit der
 * Gruppe „Karte“ (nur mit Bock, Orte aus Ideen), die Liste am Marker mit
 * Bock-Knopf, und dass ein Haken den Marker umfärbt, ohne die Liste zu
 * schließen. Die Kacheln liefert hilfe.mjs als leeres Bild.
 */
import { oeffne, MO, DI } from './hilfe.mjs';

const {
  page, check, reiter, imFilter, gespeichert, ende,
} = await oeffne({ tag: MO, zeit: '10:00' });
await reiter('karte');
await page.waitForSelector('.leaflet-container .leaflet-marker-icon', { timeout: 10000 });

const modul = (fn, arg) => page.evaluate(async ({ f, a }) => {
  const m = await import('./js/ansicht-landkarte.js');
  return m[f](a);
}, { f: fn, a: arg });
const fuss = () => page.locator('#karte-fuss').innerText();
const raum = async (r) => {
  await page.selectOption('#k-raum', r);
  await page.waitForTimeout(200);
};
/** „Nur mit Bock“ im Filter-Blatt an- oder ausmachen – eine offene Liste blendet Leaflet dabei in 200 ms aus. */
const nurBock = async () => {
  await imFilter(() => page.click('#blatt [data-aktion="karte-bock"]'));
  await page.waitForTimeout(250);
};

check(await page.evaluate(() => Boolean(window.L && window.L.markerClusterGroup)), 'Leaflet und das Zusammenfassen sind geladen');
check(await page.locator('#k-raum').inputValue() === 'woche' && await page.locator('#k-raum option').count() === 5, 'der Zeitraum ist eine Auswahl – voreingestellt: diese Woche');
check(await page.locator('.karte-kopf [data-aktion="filter-auf"]').count() === 1 && await page.locator('.karte-kopf .filterchip').count() === 0,
  'daneben der Filter-Knopf, noch ohne Chips');
const woche = await modul('markerZahl');
check(woche >= 10, `diese Woche: ${woche} Orte auf der Karte`);
check((await fuss()).includes('1 ohne Ortsangabe'), 'die Stadtrallye ohne Ort wird gezählt, nicht gezeigt');

await raum('heute');
check(await modul('markerZahl') === 2 && (await fuss()).startsWith('2 Einträge an 2 Orten'), 'heute: Lesung und Ausstellung, zwei Orte');
await nurBock();
check(await modul('markerZahl') === 0, 'nur mit Bock: noch nichts');
check(await page.locator('.karte-kopf .filterchip[data-chip="karte-bock"]').count() === 1 && (await gespeichert()).karteBock === true, '„nur mit Bock“ steht als Chip da und bleibt gespeichert');
await page.click('.karte-kopf .filterchip[data-chip="karte-bock"]');
await page.waitForTimeout(200);
check(await modul('markerZahl') === 2 && (await gespeichert()).karteBock === false, '✕ am Chip: wieder alles im Zeitraum');
await raum('alles');
const alles = await modul('markerZahl');
check(alles >= woche + 1, `alles: mehr Orte als diese Woche (${alles}), mit dem Konzert im Januar`);
check((await fuss()).includes('3 online, nur im Programm'), 'Online & TV steht nicht auf der Karte – die Zeile darunter zählt es');
await page.click('.karte-kopf [data-aktion="filter-auf"]');
check(await page.locator('#blatt [data-aktion="karte-ideen"]').getAttribute('aria-pressed') === 'false' && await page.locator('#blatt [data-aktion="reihenfolge"]').count() === 0
  && /^\d+ Einträge zeigen$/.test((await page.locator('#blatt .blatt-fuss .knopf.haupt').innerText()).trim()),
'im Blatt der Karte: die Gruppe „Karte“ (Ideen erst einmal aus), keine Reihenfolge, unten „… Einträge zeigen“');
await page.click('#blatt .blatt-x');

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
await nurBock();
check(await modul('markerZahl') === 1, 'nur mit Bock: genau der eine Ort');

// Von der Karte ins Programm.
await modul('markerOeffnen', 'Thalia');
await page.locator('.leaflet-popup [data-zu-tag]').click();
check(await page.locator('[data-reiter="programm"]').getAttribute('aria-current') === 'page', '„im Programm“ wechselt den Reiter');
check(await page.locator(`#tag-${DI} .karte`, { hasText: 'Theater früh' }).locator('[data-bock]').getAttribute('aria-pressed') === 'true',
  'dort steht derselbe Haken');

await ende();
