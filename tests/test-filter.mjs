/*
 * Das Filter-Blatt (js/blatt.js, js/ansicht-filter.js): ein Knopf je Reiter,
 * das Blatt von unten als Dialog, Wahl gilt sofort, Chips mit ✕, „Alle
 * zeigen“, Zurücksetzen, Escape, Tipp daneben, der Fokus, mehrere Regionen
 * zugleich – und dass nichts quer scrollt. Dieselben Filter in Tag, Woche, Monat und Karte; „Was immer
 * geht“ unten im Programm hat sein eigenes Blatt.
 */
import { oeffne, MO, DI } from './hilfe.mjs';

const A = await oeffne({ tag: MO, zeit: '10:00' });
const { page, check, titelAm } = A;
const knopf = () => page.locator('#ansicht [data-aktion="filter-auf"]');
const blatt = () => page.locator('#blatt');
const fuss = async () => (await page.locator('#blatt .blatt-fuss .knopf.haupt').innerText()).trim();
const fokusIm = (sel) => page.evaluate((s) => Boolean(document.activeElement && document.activeElement.closest(s)), sel);
const oeffnen = async () => {
  await knopf().click();
  await page.locator('#blatt.offen').waitFor();
};
const querScroll = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// --- Der Knopf und das Blatt als Dialog
check(await knopf().getAttribute('aria-haspopup') === 'dialog' && await knopf().getAttribute('aria-expanded') === 'false', 'der Knopf „Filter“ sagt, dass er einen Dialog öffnet');
await oeffnen();
check(await blatt().getAttribute('role') === 'dialog' && await blatt().getAttribute('aria-modal') === 'true'
  && (await page.locator('#blatt-titel').innerText()) === 'Filter' && await knopf().getAttribute('aria-expanded') === 'true', 'das Blatt ist ein Dialog mit Titel „Filter“');
check(await fokusIm('#blatt'), 'der Fokus springt ins Blatt');
check(await page.evaluate(() => ['#ansicht', '.kopf', '.reiterleiste'].every((s) => document.querySelector(s).inert)), 'der Rest der Seite ist solange inert');
check(JSON.stringify(await page.$$eval('#blatt .fgruppe h3', (hs) => hs.map((h) => h.textContent))) === JSON.stringify(['Art', 'Wo', 'Was', 'Wann']),
  'Gruppen: Art, Wo, Was, Wann – ohne Standort keine Reihenfolge');
const zahlOben = (await page.locator('#zaehler').innerText()).match(/^\d+/)[0];
check(await fuss() === `${zahlOben} Termine zeigen`, `unten „${zahlOben} Termine zeigen“ – dieselbe Zahl wie oben am Tag`);
check(await page.locator('#blatt [data-aktion="blatt-zuruecksetzen"]').isDisabled(), 'ohne Filter ist „Zurücksetzen“ aus');
const regionKnopf = (k) => page.locator(`#blatt [data-aktion="region"][data-wert="${k}"]`);
const regionen = await page.$$eval('#blatt [data-aktion="region"]', (bs) => bs.map((b) => b.dataset.wert));
check(regionen[0] === '' && await regionKnopf('').getAttribute('aria-pressed') === 'true' && (await regionKnopf('AHR').innerText()) === 'Ahrensburg & Stormarn'
  && !regionen.includes('ONL') && ['SE', 'PI', 'RZ'].every((r) => regionen.includes(r)),
  'die Regionen als Schalter: vorn „Alle“ (an), dabei Ahrensburg & Stormarn und das Umland bis gut eine Stunde, ohne „Online & TV“ – das ist eine Art, kein Ort');
check(await querScroll() <= 0, 'mit offenem Blatt scrollt nichts quer (390 px)');

// --- Wahl gilt sofort, der Fokus bleibt
await page.click('#blatt [data-filter="kostenlos"]');
check(JSON.stringify(await titelAm(MO)) === JSON.stringify(['Gratis Lesung']) && await fuss() === '1 Termin zeigen',
  'kostenlos: der Tag dahinter und die Zahl unten ändern sich sofort');
check(await page.evaluate(() => document.activeElement && document.activeElement.dataset.fokus) === 'Was:kostenlos'
  && await page.locator('#blatt [data-filter="kostenlos"]').getAttribute('aria-pressed') === 'true', 'der Fokus bleibt auf dem Schalter, er steht auf an');
check(!(await page.locator('#blatt [data-aktion="blatt-zuruecksetzen"]').isDisabled()), 'jetzt geht „Zurücksetzen“');

// --- Mehrere Regionen auf einmal; „Alle“ nimmt sie zurück
await regionKnopf('HH').click();
await regionKnopf('HB').click();
check(await regionKnopf('HH').getAttribute('aria-pressed') === 'true' && await regionKnopf('HB').getAttribute('aria-pressed') === 'true'
  && await regionKnopf('').getAttribute('aria-pressed') === 'false' && await blatt().count() === 1, 'Hamburg und Hohwachter Bucht zugleich an, „Alle“ aus – das Blatt bleibt offen');
check(await page.evaluate(() => document.activeElement && document.activeElement.dataset.fokus) === 'Wo:HB', '… der Fokus bleibt auf der zuletzt getippten Region');
await regionKnopf('HB').click();
check(await regionKnopf('HB').getAttribute('aria-pressed') === 'false' && await regionKnopf('HH').getAttribute('aria-pressed') === 'true', 'noch ein Tipp: die Region ist wieder aus, die andere bleibt');
await regionKnopf('').click();
check(await regionKnopf('HH').getAttribute('aria-pressed') === 'false' && await regionKnopf('').getAttribute('aria-pressed') === 'true'
  && JSON.stringify((await A.gespeichert()).filter.regionen) === '[]', '„Alle“: keine Region mehr gewählt');
await page.keyboard.press('Tab');
check(await fokusIm('#blatt'), 'Tab bleibt im Blatt');

// --- Escape schließt, der Fokus geht zurück
await page.keyboard.press('Escape');
check(await blatt().count() === 0 && await page.evaluate(() => document.activeElement === document.querySelector('#ansicht [data-aktion="filter-auf"]')),
  'Escape schließt das Blatt, der Fokus steht wieder auf „Filter“');
check(await page.evaluate(() => !document.querySelector('#ansicht').inert) && await knopf().getAttribute('aria-expanded') === 'false', 'die Seite ist wieder bedienbar');
check(await page.locator('.filterchip').count() === 1 && (await page.locator('.filterchip').innerText()).startsWith('kostenlos')
  && await page.locator('[data-aktion="filter-auf"] .zahl-marke').innerText() === '1', 'neben dem Knopf: der Chip „kostenlos“, am Knopf die 1');
await page.keyboard.press('Escape');
check(await page.locator('.filterchip').count() === 1, 'Escape ohne Blatt tut nichts');

// --- Tipp daneben schließt; der Knopf unten auch
await oeffnen();
await page.mouse.click(195, 40);
check(await blatt().count() === 0, 'ein Tipp auf den dunklen Hintergrund schließt das Blatt');
await oeffnen();
await page.click('#blatt .blatt-fuss .knopf.haupt');
check(await blatt().count() === 0, '„… Termine zeigen“ schließt das Blatt');

// --- Chips: ✕ und „Alle zeigen“
await A.filter('feierabend');
await A.waehle('#f-kategorie', 'Bühne');
check(JSON.stringify(await page.$$eval('.filterchip', (cs) => cs.map((c) => c.dataset.chip))) === JSON.stringify(['kategorie', 'kostenlos', 'feierabend'])
  && await page.locator('[data-aktion="filter-auf"] .zahl-marke').innerText() === '3', 'drei Filter, drei Chips, der Knopf zählt 3');
check(await page.locator('.filterleiste [data-aktion="filter-weg"]').count() === 1, 'ab zwei Chips steht „Alle zeigen“ daneben');
await page.click('.filterchip[data-chip="kategorie"]');
check(await page.locator('.filterchip').count() === 2 && !(await A.gespeichert()).filter.kategorie
  && await page.evaluate(() => document.activeElement === document.querySelector('#ansicht [data-aktion="filter-auf"]')),
'✕ nimmt nur diesen Filter weg, der Fokus geht auf „Filter“');
await page.click('.filterleiste [data-aktion="filter-weg"]');
check(await page.locator('.filterchip').count() === 0 && (await titelAm(DI)).includes('Theater früh'), '„Alle zeigen“: alle Filter weg, alles wieder da');

// --- Zurücksetzen im Blatt, live
await A.filter('kuenstler');
await oeffnen();
await page.click('#blatt [data-aktion="blatt-zuruecksetzen"]');
check(await page.locator('#blatt [data-filter="kuenstler"]').getAttribute('aria-pressed') === 'false' && await page.locator('.filterchip').count() === 0
  && await page.locator('#blatt [data-aktion="blatt-zuruecksetzen"]').isDisabled(), '„Zurücksetzen“ nimmt alles zurück – im Blatt und dahinter');
await page.click('#blatt .blatt-x');

// --- Dasselbe Blatt in Woche, Monat – und auf der Karte mit „Karte“
await A.ansicht('woche');
await A.filter('kostenlos');
check(await page.locator('.prog-kopf .filterchip[data-chip="kostenlos"]').count() === 1, 'Woche: Filter-Knopf und Chip wie am Tag');
await oeffnen();
check(await fuss() === '2 Termine zeigen', 'in der Woche zählt das Blatt die Woche: „2 Termine zeigen“ (Lesung, Nachtmarkt)');
await page.click('#blatt .blatt-x');
await A.ansicht('monat');
check(await page.locator('.prog-kopf .filterchip[data-chip="kostenlos"]').count() === 1, 'Monat: derselbe Filter gilt');
await A.reiter('karte');
await page.waitForSelector('.leaflet-container');
await oeffnen();
check(JSON.stringify(await page.$$eval('#blatt .fgruppe h3', (hs) => hs.map((h) => h.textContent))) === JSON.stringify(['Art', 'Wo', 'Was', 'Wann', 'Karte'])
  && await page.locator('#blatt [data-filter="kostenlos"]').getAttribute('aria-pressed') === 'true', 'Karte: dieselben Gruppen und Filter, dazu „Karte“');
await page.click('#blatt .blatt-x');
check(await page.locator('.karte-kopf .filterchip[data-chip="kostenlos"]').count() === 1 && await querScroll() <= 0, 'auf der Karte der Chip – nichts scrollt quer');
await page.click('.karte-kopf .filterchip[data-chip="kostenlos"]');

// --- „Was immer geht“: eigenes Blatt
await A.reiter('programm');
await page.click('#ansicht [data-aktion="ideen-filter-auf"]');
await page.locator('#blatt.offen').waitFor();
check(JSON.stringify(await page.$$eval('#blatt .fgruppe h3', (hs) => hs.map((h) => h.textContent))) === JSON.stringify(['Wirkung', 'Wo', 'Rahmen', 'Saison'])
  && /^\d+ Ideen zeigen$/.test(await fuss()), '„Was immer geht“: Wirkung, Wo, Rahmen, Saison – unten „… Ideen zeigen“');
await page.click('#blatt [data-ifilter="w:flow"]');
check(await fuss() === '4 Ideen zeigen', 'Flow: unten „4 Ideen zeigen“');
await page.keyboard.press('Escape');
check(await page.locator('.immer-kopf .filterchip[data-chip="w:flow"]').count() === 1 && await querScroll() <= 0
  && await page.evaluate(() => document.activeElement === document.querySelector('#ansicht [data-aktion="ideen-filter-auf"]')),
'der Chip „⚡ Flow“ bei „Was immer geht“, der Fokus wieder auf seinem Filter-Knopf');
await page.click('.immer-kopf .filterchip[data-chip="w:flow"]');
check(await page.locator('.immer-kopf .filterchip').count() === 0 && (await A.gespeichert()).ideenFilter.wirkung.length === 0, '✕ nimmt ihn wieder weg');

// --- Ohne Bewegung, wenn gewünscht
await page.emulateMedia({ reducedMotion: 'reduce' });
await oeffnen();
check(await blatt().evaluate((el) => window.getComputedStyle(el).transitionDuration) === '0s', 'mit „weniger Bewegung“ fährt das Blatt nicht ein, es ist einfach da');
await page.keyboard.press('Escape');

// --- Nichts scrollt quer, auf keiner Seite
for (const r of ['programm', 'wir']) {
  await A.reiter(r);
  check(await querScroll() <= 0, `${r}: nichts scrollt quer (390 px)`);
}
await A.einstellungen();
check(await querScroll() <= 0, 'Einstellungen: nichts scrollt quer (390 px)');

// --- Gespeicherte Regionen: nur bekannte, jede einmal, in der Reihenfolge des Blatts
const C = await oeffne({ tag: MO, zeit: '10:00', browser: A.browser, stand: { version: 2, filter: { regionen: ['LUE', 'XX', 'HH', 'HH', 'ONL'] }, bock: {} } });
check(JSON.stringify(await C.page.$$eval('.filterchip', (cs) => cs.map((c) => c.dataset.chip))) === JSON.stringify(['r:HH', 'r:LUE']) && C.fehler.length === 0,
  'gespeicherte Regionen: Unbekanntes, Doppeltes und „Online & TV“ fallen weg – Hamburg vor Lübeck wie im Blatt');

await A.ende();
