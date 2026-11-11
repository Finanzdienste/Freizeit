/*
 * „Für dich“ (js/ki-tipp.js): welche Termine Claude zu sehen bekommt, wie die
 * Antwort gelesen wird, der Schlüssel in den Einstellungen (eigener oder der
 * aus Boxenstopp) und der Kasten in der Woche. Die API von Anthropic ist
 * nachgebaut – aus Tests geht keine echte Anfrage hinaus.
 */
import { oeffne, testProgramm, MO, DI, FR, MO2 } from './hilfe.mjs';

globalThis.localStorage = { getItem: () => null, setItem() {} };
const ki = await import('../js/ki-tipp.js');
const { programmBereinigen } = await import('../js/daten.js');

const A = await oeffne({ tag: MO, zeit: '10:00' });
const { page, check, ctx } = A;

// --- Ohne Browser: Kandidaten, Anfrage, Antwort
const p = programmBereinigen(testProgramm());
const jetzt = { datum: DI, minuten: 600 };
const liste = ki.kandidaten(p, MO, DI, jetzt);
const ids = liste.map((x) => x.e.id);
check(!ids.includes('gratis-lesung') && liste.every((x) => x.datum >= DI), 'Kandidaten: erst ab heute – der Montag ist vorbei');
check(ids.includes('mein-konzert') && !liste.some((x) => x.e.id === 'konzert-spaet' && x.datum === DI),
  '… die 21:30-Regel gilt (das späte Konzert am Dienstag fehlt), das Konzert des eigenen Künstlers bleibt');
const stueck = liste.find((x) => x.e.id === 'stueck');
check(stueck && stueck.datum === DI && stueck.auch.join() === FR && ids.filter((i) => i === 'stueck').length === 1,
  '… ein Termin an zwei Tagen steht einmal, der zweite Tag als „auch“');
check(liste.map((x) => x.nr).join() === liste.map((_, i) => i + 1).join(), '… durchnummeriert ab 1');
const zweite = ki.kandidaten(p, MO2, MO2, jetzt);
check(zweite.some((x) => x.e.id === 'zweite-woche') && !zweite.some((x) => x.e.region === 'ONL'), '… ohne Online & TV');

const rumpf = ki.anfrageBauen(liste, { verlauf: [{ schluessel: 'i:x', titel: 'Bouldern', bewertung: 3 }], bock: {} });
check(rumpf.model === ki.MODELL && rumpf.output_config.format.type === 'json_schema' && rumpf.messages[0].content.includes('Bouldern (super)')
  && rumpf.messages[0].content.includes(`[${stueck.nr}]`) && rumpf.messages[0].content.includes('(auch Fr)'),
'Anfrage: Modell, JSON nach Schema, Bewertetes aus dem Verlauf und die Zeilen mit Nummern');

const antwort = (tipps) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ tipps }) }] });
const keane = liste.find((x) => x.e.id === 'mein-konzert');
const gelesen = ki.antwortLesen(antwort([
  { nr: 999, warum: 'erfunden' }, { nr: keane.nr, warum: 'Keane!' }, { nr: keane.nr, warum: 'doppelt' }, { nr: stueck.nr, warum: 'Theater' }, { nr: 1, warum: 'dritter' },
]), liste);
check(gelesen.length === 2 && gelesen[0].id === 'mein-konzert' && gelesen[1].id === 'stueck' && gelesen[1].datum === DI,
  'Antwort: erfundene Nummern und Doppelte fallen weg, höchstens zwei Tipps');
const wirft = (f) => { try { f(); return false; } catch { return true; } };
check(wirft(() => ki.antwortLesen({ stop_reason: 'refusal', content: [] }, liste)) && wirft(() => ki.antwortLesen({ content: [{ type: 'text', text: 'Quatsch' }] }, liste))
  && wirft(() => ki.antwortLesen(antwort([{ nr: 999, warum: 'x' }]), liste)),
'… Ablehnung, unlesbare Antwort und keine gültige Nummer sind ein Fehler');

// --- Im Browser: ohne Schlüssel kein Kasten
await A.ansicht('woche');
check(await page.locator('#fuer-dich').count() === 0, 'ohne Schlüssel: kein „Für dich“ in der Woche');

await A.einstellungen();
check(await page.locator('#e-ki').count() === 1 && (await page.locator('#e-ki').innerText()).includes('Noch kein Schlüssel'), 'Einstellungen: der Abschnitt KI-Tipp, noch ohne Schlüssel');
await page.fill('#ki-schluessel', 'kein-schluessel');
await page.click('[data-aktion="ki-speichern"]');
check((await page.locator('#e-ki [role="alert"]').innerText()).includes('sk-ant-'), '… ein falscher Schlüssel wird nicht genommen');
const SCHLUESSEL = `sk-ant-api03-${'x'.repeat(40)}abcd`;
await page.fill('#ki-schluessel', SCHLUESSEL);
await page.press('#ki-schluessel', 'Enter');
await page.locator('#e-ki', { hasText: 'Eigener Schlüssel' }).waitFor();
check((await page.locator('#e-ki').innerText()).includes('…abcd') && await page.locator('#ki-schluessel').count() === 0,
  '… ein richtiger wird gespeichert (Enter reicht), gezeigt werden nur die letzten vier Zeichen');

// --- Fragen
const anfragen = [];
let status = 200;
await ctx.route(ki.API, async (route) => {
  const req = route.request();
  const body = JSON.parse(req.postData() || '{}');
  anfragen.push({ headers: req.headers(), body });
  if (status !== 200) return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: { message: 'invalid x-api-key' } }) });
  const text = body.messages[0].content;
  const nr = (titel) => Number(text.split('\n').find((z) => z.includes(titel)).match(/^\[(\d+)\]/)[1]);
  await new Promise((r) => { setTimeout(r, 300); });
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(antwort([{ nr: nr('Keane'), warum: 'Keane live – dein Künstler.' }, { nr: nr('Theater früh'), warum: 'Ein ruhiger Theaterabend nach der Arbeit.' }])),
  });
});

await A.ansicht('woche');
check(await page.locator('#fuer-dich [data-aktion="ki-tipp"]').innerText() === 'Zwei Tipps holen', 'mit Schlüssel: „Für dich“ oben in der Woche, mit dem Knopf');
await page.click('#fuer-dich [data-aktion="ki-tipp"]');
await page.locator('#fuer-dich [data-aktion="ki-tipp"][disabled]').waitFor();
await page.locator('#fuer-dich .fd-tipp').nth(1).waitFor();
const tipps = await page.locator('#fuer-dich .fd-tipp').allInnerTexts();
check(tipps.length === 2 && tipps[0].includes('Keane live') && tipps[0].includes('Keane') && tipps[1].includes('Theater früh'),
  '… zwei Tipps: je der Grund und die Karte des Termins');
const h = anfragen[0].headers;
check(anfragen.length === 1 && h['x-api-key'] === SCHLUESSEL && h['anthropic-dangerous-direct-browser-access'] === 'true' && anfragen[0].body.model === ki.MODELL,
  '… eine Anfrage, mit dem Schlüssel und dem Kopf für den Aufruf aus dem Browser');
check(anfragen[0].body.messages[0].content.includes('Gratis Lesung'), '… heute (Montag, 10 Uhr) ist dabei, was noch kommt');
await page.click('#fuer-dich .fd-tag >> nth=0');
await page.locator(`#tag-${DI}`).waitFor();
check(true, '… der Tag am Tipp öffnet den Tag');

await A.ansicht('woche');
check(await page.locator('#fuer-dich .fd-tipp').count() === 2 && await page.locator('#fuer-dich [data-aktion="ki-tipp"]').innerText() === 'Neu fragen',
  '… die Tipps bleiben stehen, der Knopf heißt jetzt „Neu fragen“');
await page.reload({ waitUntil: 'networkidle' });
await A.ansicht('woche');
check(await page.locator('#fuer-dich .fd-tipp').count() === 2 && anfragen.length === 1, '… auch nach dem Neuladen – ohne neue Anfrage');

status = 401;
await page.click('#fuer-dich [data-aktion="ki-tipp"]');
await page.locator('#fuer-dich .fehlerbox').waitFor();
check((await page.locator('#fuer-dich .fehlerbox').innerText()).includes('Schlüssel wird nicht angenommen') && await page.locator('#fuer-dich .fd-tipp').count() === 2,
  'Fehler: verständlich gesagt, die alten Tipps bleiben');
status = 200;

// --- Der Schlüssel aus Boxenstopp
await A.einstellungen();
await page.click('[data-aktion="ki-weg"]');
await page.locator('#e-ki', { hasText: 'Noch kein Schlüssel' }).waitFor();
check(true, 'den eigenen Schlüssel löschen');
await page.evaluate((s) => localStorage.setItem('boxenstopp.ki.v1', JSON.stringify({ schluessel: s, stand: '2026-11-01' })), SCHLUESSEL.replace('abcd', 'bbbb'));
await page.reload({ waitUntil: 'networkidle' });
await A.einstellungen();
check((await page.locator('#e-ki').innerText()).includes('Schlüssel aus Boxenstopp') && await page.locator('#ki-schluessel').count() === 1,
  'ohne eigenen: der Schlüssel aus Boxenstopp – ein eigener lässt sich trotzdem eintragen');
await page.evaluate(() => localStorage.setItem('boxenstopp.ki.v1', JSON.stringify({ schluessel: `AQ.${'g'.repeat(40)}` })));
await page.reload({ waitUntil: 'networkidle' });
await A.einstellungen();
check((await page.locator('#e-ki').innerText()).includes('Noch kein Schlüssel'), '… ein Gemini-Schlüssel aus Boxenstopp zählt nicht');

check(A.fehler.length === 0, `keine Fehler in der Konsole${A.fehler.length ? `: ${A.fehler.slice(0, 2).join(' | ')}` : ''}`);
await A.ende();
