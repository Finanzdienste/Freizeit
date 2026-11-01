/*
 * Laufendes für einen Tag einplanen (js/ansicht-programm.js, js/karte.js,
 * planEintrag in js/ideen.js): Was über Wochen läuft – eine Ausstellung, ein
 * Winterzauber –, lässt sich wie eine Idee auf einen Tag legen. Im Programm
 * aufklappen, „Einplanen“, Tag (nur solange es läuft) und Uhrzeit wählen.
 * Danach springt die App zu dem Tag: oben die Meldung mit „Rückgängig“,
 * darunter unter „Eingeplant“ der Plan – mit Kalender-Knopf und den Zeiten
 * des Laufenden in der Beschreibung.
 *
 * Testdaten: „Ausstellung X“ in hilfe.mjs, läuft vom 20.10. bis So 8.11.,
 * Di–So 10–18.
 */
import {
  oeffne, MO, DI, SA, SO,
} from './hilfe.mjs';

const A = await oeffne({ tag: MO, zeit: '10:00' });
const {
  page, check, zeigeTag, ansicht, gespeichert,
} = A;
const PLAN = `p:${SA}:l:ausstellung`;
const laufendKarte = () => page.locator('#abschnitt-laufend .karte', { hasText: 'Ausstellung X' });
const form = () => laufendKarte().locator('.formular[data-form="planen"]');
const plaene = async () => Object.keys((await gespeichert()).bock).filter((k) => k.startsWith('p:'));
/** Eine Karte aufklappen, wenn sie es noch nicht ist (der Zustand bleibt über Ansichten hinweg). */
const auf = async (karte) => {
  if (!(await karte.evaluate((el) => el.classList.contains('auf')))) await karte.locator('.kopfzeile').click();
};

// --- Aufklappen: „Einplanen“ neben WhatsApp
await zeigeTag(DI);
await page.click('#zaehler [data-aktion="zu-laufend"]');
const k = laufendKarte();
check(await k.count() === 1 && !(await k.locator('[data-aktion="planen"]').isVisible()), 'zugeklappt: kein „Einplanen“ – die Karte bleibt ruhig');
await k.locator('.kopfzeile').click();
check(await k.locator('[data-aktion="planen"]').isVisible() && (await k.locator('.aktionen-mehr').innerText()).startsWith('Einplanen'),
  'aufgeklappt: „Einplanen“ vor WhatsApp');
await k.locator('[data-aktion="planen"]').click();
check(await form().count() === 1 && await page.locator('.formular').count() === 1, 'das Formular geht in der Karte auf, nur dort');
check(await form().locator('.plan-datum').inputValue() === DI, 'vorgeschlagen: der Tag, den man gerade ansieht (Di)');
check(await form().locator('.plan-datum').getAttribute('min') === MO && await form().locator('.plan-datum').getAttribute('max') === SO,
  'wählbar ab heute und nur, solange es läuft (bis So 8.11.)');
await form().locator('[data-aktion="planen"]').click();
check(await form().count() === 0, '„Abbrechen“ schließt das Formular');

// --- Ein Tag, an dem es nicht mehr läuft
await k.locator('[data-aktion="planen"]').click();
await form().locator('.plan-datum').fill('2026-11-20');
await form().locator('[data-aktion="plan-speichern"]').click();
check((await form().locator('.fehlerbox').innerText()).includes('zwischen Mo 2.11. und So 8.11.') && !(await plaene()).length,
  'nach dem Ende: „Geht nur zwischen Mo 2.11. und So 8.11.“ – nichts gespeichert');

// --- Einplanen: Samstag, 14 Uhr
await form().locator('.plan-datum').fill(SA);
await form().locator('.plan-zeit').fill('14:00');
await form().locator('[data-aktion="plan-speichern"]').click();
await page.waitForSelector(`#tag-${SA}`);
check((await page.locator(`#tag-${SA} .meldung`).innerText()).includes('Eingeplant: Ausstellung X, Sa 7.11.')
  && await page.locator('#was-immer-geht .meldung').count() === 0, 'danach: der Samstag, oben die Meldung – nicht unten bei „Was immer geht“');
const plan = page.locator(`#tag-${SA} .karte`, { hasText: 'Ausstellung X' });
check(await plan.locator('.marke.plan').count() === 1 && (await page.locator(`#tag-${SA} .tagesteil`).first().innerText()).startsWith('Eingeplant')
  && (await plan.locator('.zeit').innerText()).startsWith('14:00'), '… darunter unter „Eingeplant“ die Ausstellung um 14:00');
await plan.locator('.kopfzeile').click();
check((await plan.locator('.mehr p').innerText()).startsWith('Zeiten: Di–So 10–18.'), 'die Zeiten der Ausstellung stehen vorn in der Beschreibung');
const kal = new URL(await plan.locator('a', { hasText: 'Kalender' }).getAttribute('href'));
check(kal.searchParams.get('dates').startsWith('20261107T140000'), 'der Kalender-Knopf trägt Tag und Uhrzeit');
const st = await gespeichert();
check(st.bock[PLAN] && st.bock[PLAN].titel === 'Ausstellung X' && st.bock[PLAN].idee === 'l:ausstellung' && !st.bock['l:ausstellung'],
  'gespeichert als eigener Plan (p:Tag:l:ausstellung) – der Bock aufs Laufende bleibt, wie er war');

// --- Rückgängig
await page.click(`#tag-${SA} .meldung [data-aktion="rueckgaengig"]`);
check(await page.locator(`#tag-${SA} .karte`, { hasText: 'Ausstellung X' }).count() === 0 && !(await plaene()).length && await page.locator('.meldung').count() === 0,
  '„Rückgängig“: der Plan ist wieder weg, die Meldung auch');

// --- Noch einmal, direkt am Samstag: vorgeschlagen ist der Samstag
await page.click('#zaehler [data-aktion="zu-laufend"]');
await auf(laufendKarte());
await laufendKarte().locator('[data-aktion="planen"]').click();
check(await form().locator('.plan-datum').inputValue() === SA, 'am Samstag schlägt „Einplanen“ den Samstag vor');
await form().locator('[data-aktion="plan-speichern"]').click();
await page.locator(`#tag-${SA} .meldung`).waitFor();
check(JSON.stringify(await plaene()) === JSON.stringify([PLAN]) && (await plan.locator('.zeit').innerText()).trim() === '–', 'ohne Uhrzeit eingeplant');

// --- Woche: der Plan am Samstag; „Läuft diese Woche“ schlägt ihren Samstag vor
await ansicht('woche');
check(await page.locator(`.wtag[data-tag="${SA}"] .wt-eintrag`, { hasText: 'Ausstellung X' }).count() === 1, 'in der Woche steht der Plan am Samstag');
await page.click('#zaehler [data-aktion="zu-laufend"]');
await auf(laufendKarte());
await laufendKarte().locator('[data-aktion="planen"]').click();
check(await form().locator('.plan-datum').inputValue() === SA, 'in der Woche schlägt „Einplanen“ ihren Samstag vor');
await form().locator('[data-aktion="planen"]').click();

await A.ende();
