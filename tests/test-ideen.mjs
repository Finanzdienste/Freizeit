/*
 * Reiter „Ideen“: Katalog nach Kategorien, Filter nach Wirkung, Saison,
 * Bock, Einplanen (steht dann in Programm und Kalender), „Gemacht“ mit
 * „Wie war's?“ und „Tut dir gut“, eigene Ideen – allein und im gemeinsamen
 * Plan, wo Eingeladene „mit Tobi“ oder ohne ihn einplanen –, fremder Text,
 * und die Ideen auf der Karte.
 *
 * Testdaten: testIdeen() in hilfe.mjs (sieben Ideen, das Tretboot hat im
 * November keine Saison), dazu der Elbstrand aus programm.json „immer“.
 */
import { oeffne, fakeServer, MO, SA, SO2 } from './hilfe.mjs';

const server = fakeServer();
const A = await oeffne({ tag: MO, zeit: '10:00', server });
const { page, check, reiter, uhr, gespeichert } = A;
const kat = (k) => page.locator(`details.kategorie[data-kat="${k}"]`);
const karteIn = (p, bereich, titel) => p.locator(`${bereich} .karte`, { hasText: titel });
const sichtbar = () => page.$$eval('details.kategorie .karte h3', (hs) => hs.map((h) => h.textContent).sort());
const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// --- Katalog
await reiter('ideen');
check(await page.locator('[data-reiter="ideen"]').getAttribute('aria-current') === 'page', 'der Reiter Ideen ist offen');
const zaehler = await page.locator('#ideen-zaehler').innerText();
check(zaehler.startsWith('7 Ideen') && zaehler.includes('1 außerhalb der Saison'), `sieben Ideen, das Tretboot hat im November keine Saison (${zaehler})`);
check(await page.locator('details.kategorie').count() === 7 && await page.locator('details.kategorie[open]').count() === 0,
  'sieben Kategorien mit Ideen, alle eingeklappt');
check((await kat('natur').locator('summary').innerText()).includes('Elbstrand'), 'der Elbstrand aus „Geht immer“ steht bei Natur & Draußen');
check(await page.locator('#abschnitt-wollen, #abschnitt-geplant, #abschnitt-gut').count() === 0, 'ohne Haken und Verlauf keine leeren Abschnitte oben');

// --- Filter nach Wirkung und Rahmen
await page.click('[data-ifilter="w:flow"]');
check(gleich(await sichtbar(), ['Bügelperlen', 'Sprache lernen', 'Story-Game', 'Tischtennis im Park']), 'Flow: vier Ideen');
check(await page.locator('details.kategorie:not([open])').count() === 0, 'mit Filter sind die Kategorien aufgeklappt');
await page.click('[data-ifilter="wo:zuhause"]');
check(gleich(await sichtbar(), ['Bügelperlen', 'Sprache lernen', 'Story-Game']), 'Flow und Zuhause: drei');
await page.click('[data-ifilter="x:zuZweit"]');
check(gleich(await sichtbar(), ['Bügelperlen']), 'Flow, Zuhause und zu zweit: nur die Bügelperlen');
const f = (await gespeichert()).ideenFilter;
check(f.wirkung.includes('flow') && f.wo === 'zuhause' && f.zuZweit === true, 'die Filter stehen im Speicher');
await page.click('[data-aktion="ideen-filter-weg"]');
check(await page.locator('details.kategorie[open]').count() === 0, '„Filter zurücksetzen“ klappt die Kategorien wieder ein');

// --- Saison
await page.click('[data-aktion="saison-alle"]');
check((await kat('sport').locator('.kat-zahl').innerText()) === '2', 'außerhalb der Saison zeigen: das Tretboot ist da');
await kat('sport').locator('summary').click();
check((await karteIn(page, 'details[data-kat="sport"]', 'Tretboot').innerText()).includes('Saison Apr–Sep'), '… mit seiner Saison');
await page.click('[data-aktion="saison-alle"]');
check((await kat('sport').locator('.kat-zahl').innerText()) === '1', 'und wieder nur, was jetzt Saison hat');

// --- Bock
const tt = karteIn(page, 'details[data-kat="sport"]', 'Tischtennis');
check((await tt.locator('.ziel').innerText()).startsWith('⚡ Flow-Ziel:') && await tt.locator('.orte li').count() === 2, 'die Karte zeigt Flow-Ziel und Orte');
await tt.locator('[data-bock]').click();
check(await karteIn(page, '#abschnitt-wollen', 'Tischtennis').count() === 1, 'Bock: die Idee steht unter „Wollen wir mal“');
check(await kat('sport').getAttribute('open') !== null, 'die aufgeklappte Kategorie bleibt dabei offen');
await page.reload({ waitUntil: 'networkidle' });
check(await karteIn(page, '#abschnitt-wollen', 'Tischtennis').count() === 1, 'nach dem Neuladen noch da');

// --- Einplanen
await karteIn(page, '#abschnitt-wollen', 'Tischtennis').locator('[data-aktion="planen"]').click();
const planForm = page.locator('#abschnitt-wollen .formular');
check(await planForm.count() === 1 && await page.locator('.formular').count() === 1, 'das Formular geht nur dort auf, wo man getippt hat');
check(await planForm.locator('.plan-datum').inputValue() === SA, 'Einplanen schlägt den nächsten Samstag vor');
await planForm.locator('.plan-zeit').fill('15:00');
check(await planForm.locator('.plan-ort option').count() === 3, 'bei mehreren Orten fragt das Formular, welcher es wird');
await planForm.locator('.plan-ort').selectOption({ label: 'Hammer Park (Hamm)' });
await planForm.locator('[data-aktion="plan-speichern"]').click();
check((await page.locator('.meldung').innerText()).includes('Eingeplant: Tischtennis im Park, Sa 7.11.'), 'eine Meldung bestätigt es');
const geplant = karteIn(page, '#abschnitt-geplant', 'Tischtennis');
check(await geplant.count() === 1 && (await geplant.locator('.marke.plan').innerText()) === 'Eingeplant', 'unter „Eingeplant“ steht der Termin');
check((await geplant.locator('.unter').innerText()) === 'Hammer Park · 15:00 Uhr' && (await geplant.locator('.zeit').innerText()).startsWith('Sa 7.11.'),
  'mit Tag, Uhrzeit und dem gewählten Ort');
const kal = await geplant.locator('a', { hasText: 'Kalender' }).getAttribute('href');
check(kal.includes('20261107T150000'), 'der Kalender-Knopf trägt Tag und Uhrzeit');
check((await gespeichert()).bock[`p:${SA}:i:tischtennis`].titel === 'Tischtennis im Park', 'als Haken mit Schnappschuss gespeichert');

await reiter('programm');
check(await page.locator(`#tag-${SA} .karte`, { hasText: 'Tischtennis' }).locator('.marke.plan').count() === 1, 'im Programm steht es am Samstag');
await A.ansicht('monat');
check(await page.locator(`.feld[data-tag="${SA}"] .pkt.ich`).count() === 1, 'im Monat ein Punkt am Samstag');
await page.locator(`.feld[data-tag="${SA}"]`).click();
check(await page.locator('#kal-tag .karte', { hasText: 'Tischtennis' }).count() === 1, '… und darunter der Plan');

// --- Gemacht, Wie war's?, Tut dir gut
await reiter('ideen');
await kat('kreativ').locator('summary').click();
const perlen = karteIn(page, 'details[data-kat="kreativ"]', 'Bügelperlen');
await perlen.locator('[data-aktion="gemacht"]').click();
await perlen.locator('.gesicht').nth(2).click();
await perlen.locator('.gemacht-flow').check();
await perlen.locator('[data-aktion="gemacht-speichern"]').click();
check((await page.locator('.meldung').innerText()).includes('Gemacht: Bügelperlen 😄 ⚡'), 'gespeichert mit 😄 und Flow');
check(await karteIn(page, '#abschnitt-gut', 'Bügelperlen').count() === 1, '„Tut dir gut“: die Bügelperlen');
check((await perlen.locator('.verlauf').innerText()).includes('1× gemacht · zuletzt heute · 😄 · ⚡ 1× Flow'), 'die Karte nennt, wann und wie es war');
let st = await gespeichert();
check(st.verlauf.length === 1 && st.verlauf[0].schluessel === 'i:buegelperlen' && st.verlauf[0].bewertung === 3 && st.verlauf[0].flow === true,
  'der Verlauf liegt auf dem Gerät');
await page.click('[data-aktion="rueckgaengig"]');
st = await gespeichert();
check(st.verlauf.length === 0 && await page.locator('#abschnitt-gut').count() === 0, '„Rückgängig“ nimmt es wieder heraus');
await perlen.locator('[data-aktion="gemacht"]').click();
await perlen.locator('.gesicht').nth(0).click();
await perlen.locator('[data-aktion="gemacht-speichern"]').click();
check(await page.locator('#abschnitt-gut .karte').count() === 0 && (await page.locator('#abschnitt-gut .bilanz').innerText()).includes('1× etwas gemacht'),
  '„naja“ zählt mit, steht aber nicht unter „Tut dir gut“');

// --- Nach dem Tag: Wie war's?
await uhr(SO2);
check(await page.locator('[data-reiter="ideen"]').getAttribute('aria-current') === 'page', 'nach dem Neuladen wieder im Reiter Ideen');
const frage = page.locator('#abschnitt-geplant .frage-karte', { hasText: 'Tischtennis' });
check(await frage.count() === 1, 'nach dem Tag fragt die App: Wie war\'s?');
await frage.locator('[data-aktion="gemacht"]').click();
await frage.locator('.gesicht').nth(2).click();
await frage.locator('[data-aktion="gemacht-speichern"]').click();
check(await page.locator('.frage-karte').count() === 0, 'danach ist die Frage weg');
check(await karteIn(page, '#abschnitt-gut', 'Tischtennis').count() === 1, '… und Tischtennis steht unter „Tut dir gut“');
st = await gespeichert();
check(st.verlauf.some((v) => v.schluessel === 'i:tischtennis' && v.datum === SA && v.plan === `p:${SA}:i:tischtennis`), 'der Verlauf kennt Tag und Plan');

// --- Eigene Idee
await page.click('[data-aktion="idee-neu"]');
await page.click('[data-aktion="idee-speichern"]');
check((await page.locator('.formular .fehlerbox').innerText()).includes('Was ist die Idee'), 'ohne Titel geht es nicht');
await page.fill('.idee-titel', 'Kanu auf der Wandse');
await page.locator('.idee-wirkung[value="flow"]').check();
await page.click('[data-aktion="idee-speichern"]');
check(await karteIn(page, '#abschnitt-eigene', 'Kanu auf der Wandse').count() === 1, 'die eigene Idee steht unter „Eigene Ideen“');
check(await karteIn(page, '#abschnitt-wollen', 'Kanu auf der Wandse').locator('.marke.eigen').count() === 1, '… und mit Bock unter „Wollen wir mal“');
await page.click('[data-ifilter="w:produktiv"]');
check(await page.locator('#abschnitt-eigene').count() === 0, 'auch eigene Ideen gehorchen dem Filter');
await page.click('[data-ifilter="w:produktiv"]');
await reiter('wir');
check((await page.locator('#ansicht').innerText()).includes('Außerdem 2 Ideen mit Bock'), '„Wir“ verweist auf die Ideen mit Bock');

// --- Im Plan: Tobi startet ihn, Kim tritt bei
await page.fill('#wir-name', 'Tobi');
await page.click('[data-aktion="starten"]');
await page.waitForFunction(() => document.querySelector('#ansicht').innerText.includes('Tobi (du)'));
await A.abgeglichen();
const code = (await page.locator('#einladungslink').inputValue()).split('#einladung=')[1];
await reiter('ideen');
await page.click('[data-aktion="idee-neu"]');
await page.fill('.idee-titel', 'Flohmarkt-Runde');
await page.click('[data-aktion="idee-speichern"]');
await kat('entspannen').locator('summary').click();
await karteIn(page, 'details[data-kat="entspannen"]', 'Sauna').locator('[data-aktion="planen"]').click();
await page.locator('details[data-kat="entspannen"] .plan-datum').fill(SO2);
await page.locator('details[data-kat="entspannen"] .plan-zeit').fill('19:00');
await page.locator('details[data-kat="entspannen"] [data-aktion="plan-speichern"]').click();
await A.abgeglichen();
await page.waitForFunction(() => !JSON.parse(localStorage.getItem('freizeit.stand.v1')).warteschlange.length);

const B = await oeffne({ tag: SO2, server, browser: A.browser });
await B.reiter('wir');
await B.page.fill('#wir-code', code);
await B.page.fill('#wir-name-code', 'Kim');
await B.page.click('[data-aktion="beitreten-code"]');
await B.page.waitForFunction(() => document.querySelector('#ansicht').innerText.includes('Kim (du)'));
await B.reiter('ideen');
const floh = karteIn(B.page, '#abschnitt-wollen', 'Flohmarkt-Runde');
check(await floh.count() === 1 && (await floh.locator('.wer').innerText()).includes('Tobi'), 'Kim sieht Tobis eigene Idee mit seinem Haken');
check((await floh.locator('.marke.eigen').innerText()) === 'Eigene Idee von Tobi', '… mit seinem Namen');
check(await karteIn(B.page, '#abschnitt-eigene', 'Kanu auf der Wandse').count() === 1, 'auch die Idee von vor dem Plan ist angekommen');
const sauna = karteIn(B.page, '#abschnitt-geplant', 'Sauna-Abend');
const werSauna = await sauna.locator('.wer').innerText();
check(await sauna.count() === 1 && werSauna.includes('Tobi') && werSauna.includes('hat Bock'), 'Kim sieht, was Tobi eingeplant hat');
await sauna.locator('[data-mitwem="gastgeber"]').click();
check(await karteIn(B.page, '#abschnitt-geplant', 'Sauna-Abend').locator('[data-mitwem="gastgeber"]').getAttribute('aria-pressed') === 'true', 'Kim sagt „Mit Tobi“ dazu');
await B.page.waitForFunction(() => !JSON.parse(localStorage.getItem('freizeit.stand.v1')).warteschlange.length);
await B.ansicht('monat');
check(await B.page.locator(`.feld[data-tag="${SO2}"].treffer`).count() === 1, 'im Monat: ihr habt beide Bock');

// Kim plant zweimal: Tischtennis mit Tobi, Bügelperlen allein/mit anderen.
await B.reiter('ideen');
const planeB = async (k, titel, mitwem) => {
  const d = B.page.locator(`details.kategorie[data-kat="${k}"]`);
  if (await d.getAttribute('open') === null) await d.locator('summary').click();
  await karteIn(B.page, `details[data-kat="${k}"]`, titel).locator('[data-aktion="planen"]').click();
  const form = d.locator('.formular');
  check(await form.locator('.plan-mitwem').count() === 2 && await form.locator('.plan-mitwem[value="gastgeber"]').isChecked(),
    `${titel}: Kim wählt beim Einplanen, mit wem – vorgewählt „Mit Tobi“`);
  await form.locator('.plan-datum').fill(SO2);
  await form.locator(`.plan-mitwem[value="${mitwem}"]`).check();
  await form.locator('[data-aktion="plan-speichern"]').click();
};
await planeB('sport', 'Tischtennis', 'gastgeber');
await planeB('kreativ', 'Bügelperlen', 'andere');
await B.page.waitForFunction(() => !JSON.parse(localStorage.getItem('freizeit.stand.v1')).warteschlange.length);
const kimsPlaene = [...[...server.raeume.values()][0].bock.values()].filter((b) => b.eintrag.startsWith(`p:${SO2}:`) && b.daten.mitwem);
const wie = (idee) => kimsPlaene.find((b) => b.eintrag.endsWith(idee))?.daten.mitwem;
check(kimsPlaene.length === 3 && wie('i:sauna') === 'gastgeber' && wie('i:tischtennis') === 'gastgeber' && wie('i:buegelperlen') === 'andere',
  'beim Server: Kims Haken auf die Pläne, jeweils mit „mit wem“');
await reiter('wir');
await page.click('[data-aktion="abgleichen"]');
await page.waitForFunction(() => document.querySelector('#ansicht').innerText.includes('Bügelperlen'), null, { timeout: 6000 }).catch(() => {});
check(await karteIn(page, '#wir-mit-dir', 'Tischtennis').count() === 1 && await karteIn(page, '#wir-ohne-dich', 'Bügelperlen').count() === 1,
  'Tobi sieht beide Pläne in „Wir“: Tischtennis „Wollen mit dir“, Bügelperlen „Ohne dich“');
await reiter('ideen');
check(await karteIn(page, '#abschnitt-geplant', 'Tischtennis').count() === 1 && await karteIn(page, '#abschnitt-geplant', 'Bügelperlen').count() === 0,
  '… in seinem Kalender und unter „Eingeplant“ steht nur, was Kim mit ihm machen will');

// Fremder Text aus dem Plan richtet nichts an – und Eingeladene sehen ihn gar nicht.
const raum = [...server.raeume.values()][0];
raum.personen.push({ id: 'pzzzzzzzzzzzzzz', name: 'Mallory' });
raum.bock.set('pzzzzzzzzzzzzzz|e:boese', {
  person: 'pzzzzzzzzzzzzzz', eintrag: 'e:boese', geaendert: new Date().toISOString(),
  daten: { titel: '<img src=x onerror=alert(1)>', beschreibung: '<script>alert(2)</script>', link: 'javascript:alert(3)', wirkung: ['flow', '<b>x</b>'], urheber: '<i>M</i>' },
});
await reiter('wir');
await page.click('[data-aktion="abgleichen"]');
await page.waitForFunction(() => document.querySelector('#ansicht').innerText.includes('Mallory'), null, { timeout: 6000 });
await reiter('ideen');
const boese = karteIn(page, '#abschnitt-eigene', '<img');
check(await boese.count() === 1 && await page.locator('#abschnitt-eigene img, #abschnitt-eigene script').count() === 0, 'ein Titel mit HTML steht als Text da');
check(await boese.locator('a.quelle').count() === 0 && (await boese.locator('.marke.wirkung').count()) === 1, 'ein javascript:-Link wird kein Link, eine unbekannte Wirkung fällt weg');
await B.reiter('wir');
await B.page.click('[data-aktion="abgleichen"]');
await B.page.waitForTimeout(500);
await B.reiter('ideen');
check(await karteIn(B.page, '#abschnitt-eigene', '<img').count() === 0 && !(await B.page.locator('#ansicht').innerText()).includes('Mallory'),
  'Kim sieht weder Mallory noch Mallorys Idee');

// --- Auf der Karte
const modul = (fn, arg) => page.evaluate(async ({ f: name, a }) => {
  const m = await import('./js/ansicht-landkarte.js');
  return m[name](a);
}, { f: fn, a: arg });
await reiter('karte');
await page.waitForSelector('.leaflet-container');
await page.waitForTimeout(300);
const vorher = await modul('markerZahl');
await page.click('[data-aktion="karte-ideen"]');
await page.waitForTimeout(300);
const nachher = await modul('markerZahl');
check(nachher >= vorher + 4 && (await page.locator('#karte-fuss').innerText()).includes('aus den Ideen'), `mit „Ideen“ kommen ihre Orte dazu (${vorher} → ${nachher})`);
check((await gespeichert()).karteIdeen === true, 'der Schalter bleibt gespeichert');
check(await modul('markerOeffnen', 'Hammer Park') === true, 'der Marker der Tischtennisplatte lässt sich öffnen');
const pop = page.locator('.leaflet-popup .pop');
await pop.waitFor();
check((await pop.locator('.pop-wann').first().innerText()).startsWith('Idee · Sport & Bewegung'), 'die Liste sagt, dass es eine Idee ist');
await pop.locator('[data-zu-idee]').click();
check(await page.locator('[data-reiter="ideen"]').getAttribute('aria-current') === 'page', '„bei den Ideen“ wechselt den Reiter');
check(await page.locator('#idee-i-tischtennis').isVisible(), '… und die Idee ist aufgeklappt');

check(B.fehler.length === 0, `Kim: keine Fehler in der Konsole${B.fehler.length ? `: ${B.fehler.slice(0, 2).join(' | ')}` : ''}`);
await A.ende();
