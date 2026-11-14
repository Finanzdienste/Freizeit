/*
 * „Für dich“ (js/ki-tipp.js): welche Termine Claude zu sehen bekommt (je Tag,
 * Woche, Monat), was Tobi schon vorhat, wie die Antwort gelesen wird, der
 * Schlüssel in den Einstellungen (eigener oder der aus Boxenstopp) und der
 * Kasten im Tag, in der Woche und im Monat. Die API von Anthropic ist
 * nachgebaut – aus Tests geht keine echte Anfrage hinaus.
 */
import {
  oeffne, testProgramm, MO, DI, MI, FR, SA, MO2,
} from './hilfe.mjs';

globalThis.localStorage = { getItem: () => null, setItem() {} };
const ki = await import('../js/ki-tipp.js');
const { programmBereinigen } = await import('../js/daten.js');

const A = await oeffne({ tag: MO, zeit: '10:00' });
const { page, check, ctx } = A;

// --- Ohne Browser: Kandidaten, Anfrage, Antwort
const p = programmBereinigen(testProgramm());
const jetzt = { datum: DI, minuten: 600 };
const plus6 = (iso) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 6); return d.toISOString().slice(0, 10); };
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
// Tag, Woche, Monat: der Zeitraum, was Tobi darin schon vorhat, und wie viele Tipps.
const tag = ki.zeitraum('tag', DI);
const monat = ki.zeitraum('monat', '2026-11');
check(tag.von === DI && tag.bis === DI && tag.kontextVon === MO && tag.kontextBis === plus6(MO) && tag.schluessel === `t:${DI}`
  && monat.von === '2026-11-01' && monat.bis === '2026-11-30' && monat.schluessel === 'm:2026-11' && ki.zeitraum('woche', MO).schluessel === MO,
'zeitraum: der Tag (Kontext seine Woche), der Monat bis zum Monatsletzten, die Woche unter ihrem Montag wie bisher');
check(ki.kandidaten(p, tag, MO, jetzt).every((x) => x.datum === DI) && ki.kandidaten(p, tag, MO, jetzt).some((x) => x.e.id === 'mein-konzert'),
  'Kandidaten für einen Tag: nur dieser Tag');
const imMonat = ki.kandidaten(p, monat, DI, jetzt);
check(imMonat.some((x) => x.datum < MO2) && imMonat.some((x) => x.datum >= MO2), 'Kandidaten für den Monat: aus allen Wochen mit Programm');
const mitBock = { verlauf: [], bock: { [`t:stueck:${DI}`]: { titel: 'Stück', datum: DI, kategorie: 'Bühne' } } };
const ohneDienstag = ki.kandidaten(p, MO, DI, jetzt, mitBock).find((x) => x.e.id === 'stueck');
check(ohneDienstag && ohneDienstag.datum === FR, '… worauf er an einem Tag schon Bock hat, kommt dort nicht noch einmal (das Stück steht am Freitag)');
const schach = (d, n) => [`t:schach-${n}:${d}`, { quelle: 'termin', titel: `Schach-WM: Partie ${n}`, datum: d, zeit: '14:00', kategorie: 'Schach', online: true }];
const vielSchach = {
  verlauf: [],
  bock: Object.fromEntries([schach(MO, 1), schach(DI, 2), schach(MI, 3), schach(FR, 4), schach(MO2, 5),
    ['p:i:bouldern:2026-11-07', { quelle: 'plan', titel: 'Bouldern', datum: SA, kat: 'Sport' }],
    ['t:anderswo:2026-12-20', { quelle: 'termin', titel: 'Weit weg', datum: '2026-12-20', kategorie: 'Konzert' }]]),
};
const vor = ki.vorhaben(vielSchach, ki.zeitraum('woche', MO));
check(vor.length === 5 && vor.filter((z) => z.includes('Schach-WM') && z.includes('(Schach, Online & TV)')).length === 4 && vor.some((z) => z.includes('Bouldern') && z.includes('eingeplant'))
  && !vor.some((z) => z.includes('Partie 5') || z.includes('Weit weg')) && vor[0].startsWith(`- Mo ${Number(MO.slice(8))}.11. 14:00`),
'vorhaben: Haken (auch Online & TV) und Eingeplantes der Woche, nach Tag – nichts außerhalb');
const monatsRumpf = ki.anfrageBauen(imMonat, vielSchach, monat);
const mText = monatsRumpf.messages[0].content;
check(monatsRumpf.output_config.format.schema.properties.tipps.description.includes('drei') && mText.startsWith('Termine dieses Monats')
  && mText.includes('Was er in diesem Monat schon vorhat:') && mText.includes('Partie 5') && monatsRumpf.system.includes('Abwechslung')
  && monatsRumpf.system.includes('drei Termine des Monats') && !mText.includes('Worauf er sonst gerade Bock hat:\n- Schach'),
'Anfrage für den Monat: drei Tipps, was er schon vorhat (alles Schach), Abwechslung verlangt – das Schach nicht noch einmal unter „sonst Bock“');
const tagRumpf = ki.anfrageBauen(ki.kandidaten(p, tag, MO, jetzt), vielSchach, tag);
const vorTeil = (t) => t.split('schon vorhat:')[1].split('\n\n')[0];
check(tagRumpf.output_config.format.schema.properties.tipps.description === 'Genau ein Tipp.' && tagRumpf.messages[0].content.includes('Was er in dieser Woche schon vorhat:')
  && !vorTeil(tagRumpf.messages[0].content).includes('Partie 5') && vorTeil(tagRumpf.messages[0].content).includes('Partie 2'),
'Anfrage für einen Tag: ein Tipp, das Vorhaben seiner Woche (die nächste Woche nicht)');
const drei = ki.antwortLesen(antwort([{ nr: 1, warum: 'a' }, { nr: 2, warum: 'b' }, { nr: 3, warum: 'c' }, { nr: 4, warum: 'd' }]), imMonat, 3);
check(drei.length === 3 && ki.antwortLesen(antwort([{ nr: 1, warum: 'a' }, { nr: 2, warum: 'b' }]), imMonat, 1).length === 1, 'Antwort: so viele Tipps, wie die Art verlangt');

const mitHighlight = { ...p, highlights: [{ titel: 'Di 3.11.: Keane in der Sporthalle', text: 'Das Konzert der Woche', datum: DI }] };
check(ki.istHighlight(mitHighlight, keane.e, DI) && !ki.istHighlight(mitHighlight, keane.e, MI) && !ki.istHighlight(mitHighlight, stueck.e, DI),
  'istHighlight: der Termin steht im Highlight seines Tages – am anderen Tag nicht, ein anderer Termin auch nicht');
const hlListe = ki.kandidaten(mitHighlight, tag, MO, jetzt);
const hlRumpf = ki.anfrageBauen(hlListe, { verlauf: [], bock: {} }, tag);
check(hlRumpf.messages[0].content.split('\n').some((z) => z.includes('Keane') && z.includes('★ HIGHLIGHT LAUT PROGRAMM'))
  && hlRumpf.system.includes('Klasse und Größe') && hlRumpf.system.includes('Gemeindesaal') && hlRumpf.output_config.effort === 'low',
'Anfrage: Highlights markiert, Klasse und Größe vor passendem Thema, mit wenig Nachdenken (effort low)');

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
  const zeilen = text.split('\n').filter((z) => /^\[\d+\]/.test(z));
  const nr = (z) => Number(z.match(/^\[(\d+)\]/)[1]);
  // So viele Tipps, wie das Schema verlangt: erst Keane und das Theater, dann von oben.
  const beschreibung = body.output_config.format.schema.properties.tipps.description;
  const zahl = beschreibung.includes('ein Tipp') ? 1 : (beschreibung.includes('drei') ? 3 : 2);
  const gruende = { Keane: 'Keane live – dein Künstler.', 'Theater früh': 'Ein ruhiger Theaterabend nach der Arbeit.' };
  const wahl = [...Object.keys(gruende).map((t) => zeilen.find((z) => z.includes(t))).filter(Boolean), ...zeilen]
    .filter((z, i, a) => a.indexOf(z) === i).slice(0, zahl);
  await new Promise((r) => { setTimeout(r, 300); });
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(antwort(wahl.map((z) => ({ nr: nr(z), warum: gruende[Object.keys(gruende).find((t) => z.includes(t))] || 'Mal was anderes.' })))),
  });
});

await A.ansicht('woche');
check(await page.locator('#fuer-dich[data-auto] [data-aktion="ki-tipp"]').innerText() === 'Zwei Tipps holen' && anfragen.length === 0,
  'mit Schlüssel: „Für dich“ oben in der Woche – noch ohne Anfrage');
await page.locator('#fuer-dich [data-aktion="ki-tipp"][disabled]').waitFor();
await page.locator('#fuer-dich .fd-tipp').nth(1).waitFor();
check(await page.locator('#fuer-dich[data-auto]').count() === 0, '… nach einer guten Sekunde fragt die App von allein, ohne Knopfdruck');
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

// --- Im Tag: ein Tipp für den Tag, ohne Tageszeile davor
await A.ansicht('tag');
const tagKasten = page.locator(`#tag-${MO} #fuer-dich[data-art="tag"]`);
check((await tagKasten.innerText()).includes('das Beste des Tages'), 'im Tag: „Für dich“ – das Beste des Tages');
await page.locator('#fuer-dich .fd-tipp').first().waitFor();
const tagAnfrage = anfragen.at(-1).body;
check(await page.locator('#fuer-dich .fd-tipp').count() === 1 && await page.locator('#fuer-dich .fd-tag').count() === 0
  && tagAnfrage.output_config.format.schema.properties.tipps.description === 'Genau ein Tipp.' && tagAnfrage.messages[0].content.startsWith('Termine an diesem Tag'),
'… von allein: ein Tipp mit Grund und Karte, ohne Tag davor – gefragt nach einem Tipp für diesen Tag');
// Schnell weiterblättern löst nichts aus – erst der Tag, auf dem man bleibt.
const vorBlaettern = anfragen.length;
await page.click('[data-aktion="kal-vor"]');
await page.waitForTimeout(300);
await page.click('[data-aktion="kal-vor"]');
await page.locator(`#tag-${MI} #fuer-dich .fd-tipp`).first().waitFor();
await page.waitForTimeout(1500);
check(anfragen.length === vorBlaettern + 1 && anfragen.at(-1).body.messages[0].content.split('\n')[1].startsWith('[1] Mi '),
  `schnell zwei Tage weiter: nur eine Anfrage, für den Tag, auf dem man bleibt (${anfragen.length - vorBlaettern})`);

// --- Im Monat: drei Tipps, je mit dem Tag
await A.ansicht('monat');
const monatsKasten = page.locator('#fuer-dich[data-art="monat"]');
check(await monatsKasten.count() === 1, 'im Monat: „Für dich“ unter dem Kalender');
await page.locator('#fuer-dich .fd-tipp').nth(2).waitFor();
check(await page.locator('#fuer-dich .fd-tipp').count() === 3 && await page.locator('#fuer-dich .fd-tag').count() === 3
  && anfragen.at(-1).body.messages[0].content.includes('Was er in diesem Monat schon vorhat:'),
'… von allein drei Tipps, je mit ihrem Tag – Claude sieht, was du in dem Monat schon vorhast');
await A.ansicht('woche');
check(await page.locator('#fuer-dich .fd-tipp').count() === 2, '… die Tipps der Woche bleiben davon unberührt');

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
