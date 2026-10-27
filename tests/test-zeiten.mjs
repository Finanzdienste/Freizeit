/*
 * Wann hat der Gastgeber Zeit? Seine belegten Zeiten (Haken z:<Montag>,
 * siehe js/zeiten.js) – an den Karten der Eingeladenen „hat da Zeit“ bzw.
 * „ist da schon verplant“, beim Gastgeber nur, was sich beißt, und unter
 * „Wir“ als Wochenraster. Als Eintrag tauchen die Zeiten nirgends auf.
 *
 * Die Zeiten legt der Test direkt in den nachgebauten Server, so wie sie
 * eine geplante Aufgabe oder die App des Gastgebers schreiben würde.
 */
import { oeffne, fakeServer, MO, DI, FR, SA, MO2, DI2 } from './hilfe.mjs';

const server = fakeServer();
const A = await oeffne({ tag: MO, server });
const { check } = A;
const karteAm = (x, tag, titel) => x.page.locator(`#tag-${tag} .karte`, { hasText: titel });
const hinweis = async (x, tag, titel) => {
  const k = karteAm(x, tag, titel).locator('.zeit-hinweis');
  return (await k.count()) ? k.innerText() : '';
};
async function synchron(x) {
  const vorher = (await x.gespeichert()).gemeinsam?.abgeholt;
  await x.page.click('[data-aktion="abgleichen"]');
  await x.page.waitForFunction((v) => JSON.parse(localStorage.getItem('freizeit.stand.v1')).gemeinsam.abgeholt !== v, vorher, { timeout: 6000 }).catch(() => {});
  await x.page.waitForTimeout(150);
}

// Tobi startet den Plan, Kim tritt bei.
await A.reiter('wir');
await A.page.fill('#wir-name', 'Tobi');
await A.page.click('[data-aktion="starten"]');
await A.page.waitForFunction(() => document.querySelector('#ansicht').innerText.includes('Tobi (du)'));
const tobi = (await A.gespeichert()).gemeinsam;
const code = tobi.code;
const raum = server.raeume.get(code);
check(!(await A.page.locator('#wir-zeiten').count()), 'ohne Zeiten kein Abschnitt „Deine Zeiten“');

// Die Zeiten: Di 18:00–20:30, Fr 8–17, Sa 22 Uhr bis So 2 Uhr; in der Woche danach Mi 19–21.
const T = 24 * 60;
const marke = (mo, z) => raum.bock.set(`${tobi.ich.id}|z:${mo}`, {
  person: tobi.ich.id, eintrag: `z:${mo}`, geaendert: new Date().toISOString(), daten: { z, stand: '2026-11-02T07:10' },
});
marke(MO, [[T + 18 * 60, T + 20 * 60 + 30], [4 * T + 8 * 60, 4 * T + 17 * 60], [5 * T + 22 * 60, 6 * T + 2 * 60]]);
marke(MO2, [[2 * T + 19 * 60, 2 * T + 21 * 60], [9999, 1]]);

const B = await oeffne({ tag: MO, server, hash: `einladung=${code}`, browser: A.browser });
await B.page.fill('#wir-name', 'Kim');
await B.page.click('[data-aktion="beitreten"]');
await B.page.waitForFunction(() => document.querySelector('#ansicht').innerText.includes('Kim (du)'));
await B.page.click('[data-aktion="hilfe-weg"]');

// --- Kim: an den Karten
await B.reiter('programm');
check((await hinweis(B, DI, 'Theater früh')) === 'Tobi ist da schon verplant', 'Di 19 Uhr Theater: Tobi ist da schon verplant (belegt 18:00–20:30)');
check((await hinweis(B, DI, 'Workshop mittags')) === '✓ Tobi hat da Zeit', 'Di 12:30 Workshop: Tobi hat da Zeit');
check((await hinweis(B, FR, 'Konzert spät')) === '✓ Tobi hat da Zeit', 'Fr 20 Uhr Konzert: frei – belegt war nur bis 17 Uhr');
check((await hinweis(B, SA, 'Party')) === 'Tobi ist da schon verplant', 'Sa 23 Uhr Party: verplant – der Block geht über Mitternacht');
check((await hinweis(B, SA, 'Messe')) === '', 'Ganztägiges bekommt keine Zeile');
await B.page.click('[data-aktion="woche-vor"]');
check((await hinweis(B, DI2, 'Lesung zweite Woche')) === '✓ Tobi hat da Zeit', 'Woche danach: Di 18:30 Lesung – frei (belegt ist dort nur Mi 19–21)');

// --- Kim: das Wochenraster unter „Wir“
await B.reiter('wir');
const z = B.page.locator('#wir-zeiten');
check(await z.count() === 1 && (await z.locator('.abschnitt-titel').innerText()) === 'Wann hat Tobi Zeit?', 'unter „Wir“: „Wann hat Tobi Zeit?“');
check((await z.innerText()).includes('Stand Mo 2.11., 07:10 Uhr'), '… mit dem Stand der Zeiten');
const zeile = (i) => z.locator('.zr-zeile').nth(i).getAttribute('aria-label');
check(await z.locator('.zr-zeile').count() === 7, 'sieben Tage, Mo bis So');
check((await zeile(1)).endsWith('belegt 18:00–20:30') && (await zeile(4)).endsWith('belegt 08:00–17:00') && (await zeile(0)).endsWith('frei'),
  'Di belegt 18:00–20:30, Fr 08:00–17:00, Mo frei');
check((await zeile(5)).endsWith('belegt 22:00–24:00'), 'Sa: der Block bis Mitternacht – die Nacht danach liegt außerhalb des Rasters (8–24 Uhr)');
check(await z.locator('.zr-zeile').nth(1).locator('b').count() === 1, 'Di hat einen dunklen Block');
check(await z.locator('[data-aktion="zeiten-zurueck"]').isDisabled() && !(await z.locator('[data-aktion="zeiten-vor"]').isDisabled()), 'blättern: zurück geht nicht, vor schon');
await z.locator('[data-aktion="zeiten-vor"]').click();
check((await B.page.locator('#wir-zeiten .zr-zeile').nth(2).getAttribute('aria-label')).endsWith('belegt 19:00–21:00'), 'Woche danach: Mi 19–21 belegt (ein kaputter Block fällt weg)');

// --- Tobi: nur, was sich beißt; keine Einträge aus den Zeiten
await A.reiter('wir');
await synchron(A);
await A.reiter('programm');
check((await hinweis(A, DI, 'Theater früh')) === 'Bei dir steht da schon was im Kalender', 'Tobi: am Theater „Bei dir steht da schon was im Kalender“');
check((await hinweis(A, DI, 'Workshop mittags')) === '', 'wo es passt, sagt die App Tobi nichts');
await A.reiter('wir');
check(await A.page.locator('#wir-zeiten').count() === 1 && (await A.page.locator('#wir-zeiten .abschnitt-titel').innerText()) === 'Deine Zeiten',
  'Tobi sieht unter „Wir“ seine Zeiten, wie die anderen sie sehen');
const st = await A.gespeichert();
check(!Object.keys(st.bock).some((k) => k.startsWith('z:')), 'die Zeiten landen nicht in Tobis eigenen Haken');
check(!(await A.page.locator('#ansicht').innerText()).includes('Eintrag') && !(await B.page.locator('#ansicht').innerText()).includes('Eintrag'),
  'und nirgends als Eintrag');
check(await A.page.locator('#wir-neu').isHidden(), 'neue Zeiten sind kein „neuer Haken“');

check(B.fehler.length === 0, `Kim: keine Fehler in der Konsole${B.fehler.length ? `: ${B.fehler.slice(0, 2).join(' | ')}` : ''}`);
await A.ende();
