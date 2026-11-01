/*
 * Wann hat der Gastgeber Zeit? Seine belegten Zeiten (Haken z:<Montag>,
 * siehe js/zeiten.js) – an den Karten der Eingeladenen „hat da Zeit“ bzw.
 * „ist da schon verplant“, beim Gastgeber nur, was sich beißt, und im
 * Programm als schraffierte Blöcke im Zeitstreifen (Tag und Woche) mit einem
 * Satz dazu. Als Eintrag tauchen die Zeiten nirgends auf.
 *
 * Die Zeiten legt der Test direkt in den nachgebauten Server, so wie sie
 * eine geplante Aufgabe oder die App des Gastgebers schreiben würde.
 */
import { oeffne, fakeServer, MO, DI, FR, SA, MO2, DI2, MI2 } from './hilfe.mjs';

const server = fakeServer();
const A = await oeffne({ tag: MO, server });
const { check } = A;
/** Die Karte an einem Tag im Programm – öffnet dafür den Tag (Ansicht Tag). */
const karteAm = async (x, tag, titel) => {
  await x.zeigeTag(tag);
  return x.page.locator(`#tag-${tag} .karte`, { hasText: titel });
};
const hinweis = async (x, tag, titel) => {
  const k = (await karteAm(x, tag, titel)).locator('.zeit-hinweis');
  return (await k.count()) ? k.innerText() : '';
};
async function synchron(x) {
  const vorher = (await x.gespeichert()).gemeinsam?.abgeholt;
  await x.aktion('abgleichen');
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
check(!(await A.page.locator('.zeiten-hinweis').count()), 'ohne Zeiten kein Hinweis unter „Wir“');

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
check((await hinweis(B, DI2, 'Lesung zweite Woche')) === '✓ Tobi hat da Zeit', 'Woche danach: Di 18:30 Lesung – frei (belegt ist dort nur Mi 19–21)');

// --- Kim: im Programm – Woche und Tag
await B.reiter('wir');
const hinweis2 = B.page.locator('.zeiten-hinweis');
check(await hinweis2.count() === 1 && (await hinweis2.innerText()).includes('Wann Tobi Zeit hat (Stand Mo 2.11., 07:10 Uhr)'), 'unter „Wir“ ein Hinweis mit dem Stand – die Zeiten selbst stehen im Programm');
await hinweis2.locator('[data-kal-wechsel="woche"]').click();
check(await B.page.locator('[data-reiter="programm"]').getAttribute('aria-current') === 'page' && await B.page.locator('[data-kal-ansicht="woche"]').getAttribute('aria-pressed') === 'true',
  'der Hinweis führt ins Programm, Ansicht Woche');
await B.page.click('[data-aktion="kal-heute"]');
check((await B.page.locator('.kal-titel').innerText()).startsWith('KW 45'), '„Heute“ holt die laufende Woche – der Tag ist in allen Ansichten derselbe');
const bloecke = (tag) => B.page.locator(`.wtag[data-tag="${tag}"] .zs-belegt`);
check(await bloecke(DI).count() === 1 && await bloecke(FR).count() === 1 && await bloecke(MO).count() === 0 && await bloecke(SA).count() === 1,
  'in den Tageskarten: Di, Fr und Sa (22–24 Uhr) mit einem belegten Block, Mo frei');
const breite = (tag) => bloecke(tag).evaluate((el) => [parseFloat(el.style.left), el.style.width]);
const [diLinks] = await breite(DI);
check(diLinks > 64.6 && diLinks < 64.8, `Di: der Block beginnt bei 18 Uhr (${diLinks} % von 7–24 Uhr)`);
check((await B.page.locator('.legende').innerText()).includes('Tobi ist belegt'), 'die Legende erklärt die schraffierten Blöcke');
await B.page.click('[data-aktion="kal-vor"]');
check(await B.page.locator(`.wtag[data-tag="${MI2}"] .zs-belegt`).count() === 1 && await B.page.locator('.wtag .zs-belegt').count() === 1,
  'Woche danach: nur Mi 19–21 belegt (ein kaputter Block fällt weg)');
await B.page.click(`.wtag[data-tag="${DI2}"]`);
check((await B.page.locator(`#tag-${DI2} .deine-zeit`).innerText()).includes('Tobi hat den ganzen Tag Zeit.') && (await B.page.locator(`#tag-${DI2} .dz-titel`).innerText()) === 'Wann Tobi kann',
  'Tag Di der zweiten Woche: „Wann Tobi kann – Tobi hat den ganzen Tag Zeit.“');
for (let i = 0; i < 7; i++) await B.page.click('[data-aktion="kal-zurueck"]');
check((await B.page.locator('.kal-titel').innerText()).startsWith('Dienstag, 3.11.') && (await B.page.locator(`#tag-${DI} .dz-satz`).innerText()) === 'Tobi ist belegt 18:00–20:30. Frei ab 20:30.'
  && await B.page.locator(`#tag-${DI} .deine-zeit .zs-belegt`).count() === 1, 'Di 3.11.: „Tobi ist belegt 18:00–20:30. Frei ab 20:30.“ und der Block im Zeitstreifen');

// --- Tobi: nur, was sich beißt; keine Einträge aus den Zeiten
await A.reiter('wir');
await synchron(A);
await A.reiter('programm');
check((await hinweis(A, DI, 'Theater früh')) === 'Bei dir steht da schon was im Kalender', 'Tobi: am Theater „Bei dir steht da schon was im Kalender“');
check((await hinweis(A, DI, 'Workshop mittags')) === '', 'wo es passt, sagt die App Tobi nichts');
await A.reiter('wir');
check((await A.page.locator('.zeiten-hinweis').innerText()).startsWith('Deine belegten Zeiten aus dem Kalender'), 'Tobi: unter „Wir“ der Hinweis auf seine Zeiten');
await A.ansicht('woche');
check(await A.page.locator(`.wtag[data-tag="${DI}"] .zs-belegt`).count() === 1 && (await A.page.locator('.legende').innerText()).includes('belegt (Kalender)'),
  'Tobi sieht in der Woche seine Zeiten, wie die anderen sie sehen');
await A.zeigeTag(DI);
check((await A.page.locator(`#tag-${DI} .dz-satz`).innerText()) === 'Belegt 18:00–20:30. Frei ab 20:30.' && (await A.page.locator(`#tag-${DI} .dz-titel`).innerText()) === 'Deine Zeit',
  '… und am Tag „Deine Zeit: Belegt 18:00–20:30. Frei ab 20:30.“');
const st = await A.gespeichert();
check(!Object.keys(st.bock).some((k) => k.startsWith('z:')), 'die Zeiten landen nicht in Tobis eigenen Haken');
check(!(await A.page.locator('#ansicht').innerText()).includes('Eintrag') && !(await B.page.locator('#ansicht').innerText()).includes('Eintrag'),
  'und nirgends als Eintrag');
check(await A.page.locator('#wir-neu').isHidden(), 'neue Zeiten sind kein „neuer Haken“');

check(B.fehler.length === 0, `Kim: keine Fehler in der Konsole${B.fehler.length ? `: ${B.fehler.slice(0, 2).join(' | ')}` : ''}`);
await A.ende();
