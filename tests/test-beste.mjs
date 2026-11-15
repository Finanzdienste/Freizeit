/*
 * Das Beste zuerst: Jeder Termin hat einen Score (0–100, vom Monatslauf),
 * und danach sortiert das Programm – der Tag (Vorgabe „Beste zuerst“, sonst
 * Uhrzeit oder Entfernung), „Das Beste der Woche“ und „Das Beste im Monat“.
 * Was man selbst schon vorhat, drückt Termine derselben Kategorie in den
 * Tagen drumherum (filter.js: abwechslung). „Für dich“ mit Claude gibt es
 * nicht mehr – auch der Schlüssel verschwindet vom Gerät.
 *
 * Am Di (Testdaten aus hilfe.mjs, 21:30-Regel an): Workshop mittags (Food,
 * 66), Theater früh (Bühne, 40), Theaterstück (Bühne, 70), Keane (eigener
 * Künstler, 95). „Konzert spät“ (72) fällt am Di unter die 21:30-Regel.
 */
import {
  oeffne, testProgramm, MO, DI, FR,
} from './hilfe.mjs';
import { score, rang, abwechslung, reihenfolge } from '../js/filter.js';

const SCORES = {
  'workshop-mittags': 66, 'theater-frueh': 40, stueck: 70, 'mein-konzert': 95, 'konzert-spaet': 72, 'gratis-lesung': 55,
};
const basis = testProgramm();
const programm = testProgramm({
  termine: basis.termine.map((e) => (e.id in SCORES ? { ...e, score: SCORES[e.id] } : e)),
});

const A = await oeffne({ tag: MO, zeit: '10:00', programm });
const {
  page, check, zeigeTag, ansicht, gespeichert, imFilter, einstellungen, reiter,
} = A;

// --- Ohne Browser: Score, Abwechslung, Reihenfolge
check(score({ score: 87 }) === 87 && score({}) === 50 && score({ score: '87' }) === 50 && score({ score: 87.5 }) === 50,
  'score: ganze Zahl aus den Daten, sonst die Mitte (50)');
const bock = {
  [`t:gratis-lesung:${MO}`]: { titel: 'Gratis Lesung', kategorie: 'Bühne', datum: MO },
  [`t:stueck:${FR}`]: { titel: 'Theaterstück', kategorie: 'Bühne', datum: FR },
  'l:ausstellung': { titel: 'Ausstellung X', kategorie: 'Ausstellung', von: '2026-10-20', bis: '2026-11-08' },
};
const malus = abwechslung(bock);
check(malus({ id: 'theater-frueh', kategorie: 'Bühne' }, DI) === 16, 'Abwechslung: zwei eigene Bühnen-Haken in der Nähe – 16 Punkte weniger');
check(malus({ id: 'stueck', kategorie: 'Bühne' }, DI) === 8 && malus({ schluessel: `t:stueck:${DI}`, kategorie: 'Bühne' }, DI) === 8,
  'der Termin selbst an einem anderen Tag zählt nicht mit – ob Daten (id) oder Eintrag (schluessel)');
check(malus({ id: 'x', kategorie: 'Bühne' }, '2026-11-20') === 0, 'mehr als sechs Tage weg: kein Abzug');
check(malus({ id: 'x', kategorie: 'Bühne', kuenstler: true }, DI) === 0 && malus({ id: 'x', kategorie: 'Food' }, DI) === 0,
  'eigene Künstler und andere Kategorien: kein Abzug');
const voll = abwechslung(Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`t:s${i}:${DI}`, { kategorie: 'Schach', datum: DI }])));
check(voll({ id: 'partie', kategorie: 'Schach' }, DI) === 24, 'höchstens 24 Punkte – auch bei sechs Schachabenden');
check(rang({ score: 70, kategorie: 'Bühne', id: 'y' }, DI, { malus }) === 54 && rang({ score: 70 }, DI, {}) === 70, 'rang: Score minus Abzug');
check(reihenfolge({}) === 'beste' && reihenfolge({ nachZeit: true }) === 'zeit' && reihenfolge({ nachEntfernung: true }) === 'beste'
  && reihenfolge({ nachEntfernung: true, bezug: { lat: 1 } }) === 'entfernung', 'Reihenfolge: Vorgabe das Beste, Entfernung nur mit Bezugspunkt');

// --- Im Browser: der Tag
const titel = (d) => page.$$eval(`#tag-${d} .karte h3`, (hs) => hs.map((h) => h.textContent));
const karteAm = (d, text) => page.locator(`#tag-${d} .karte`, { hasText: text });

await zeigeTag(DI);
check(JSON.stringify(await titel(DI)) === JSON.stringify(['Keane', 'Theaterstück', 'Workshop mittags', 'Theater früh']),
  `Di: das Beste zuerst – Keane, Theaterstück, Workshop, Theater (${(await titel(DI)).join(', ')})`);
check((await page.locator(`#tag-${DI} .tagesteil`).innerText()).startsWith('Das Beste zuerst') && await page.locator(`#tag-${DI} .tagesteil .tt-zahl`).innerText() === '4',
  'eine Überschrift „Das Beste zuerst“ mit der Zahl');
await karteAm(DI, 'Keane').locator('.kopfzeile').click();
check(await karteAm(DI, 'Keane').locator('.mehr .marke.score').innerText() === 'Score 95', 'aufgeklappt: „Score 95“');

// Uhrzeit: wieder nach Tageszeit gegliedert, und es bleibt gespeichert.
await imFilter(() => page.click('#blatt [data-aktion="reihenfolge"][data-wert="zeit"]'));
check(JSON.stringify(await titel(DI)) === JSON.stringify(['Workshop mittags', 'Theater früh', 'Theaterstück', 'Keane'])
  && (await gespeichert()).filter.nachZeit === true, 'Reihenfolge „Uhrzeit“: nach Beginn, gespeichert');
await imFilter(() => page.click('#blatt [data-aktion="reihenfolge"][data-wert="beste"]'));
check((await titel(DI))[0] === 'Keane' && (await gespeichert()).filter.nachZeit === false, 'zurück auf „Beste zuerst“');

// Abwechslung: Ein Haken auf der Lesung am Montag (Bühne) drückt die Bühnen am Dienstag.
await zeigeTag(MO);
await karteAm(MO, 'Gratis Lesung').locator('[data-bock]').first().click();
check(Boolean((await gespeichert()).bock[`t:gratis-lesung:${MO}`]), 'Haken auf der Lesung am Montag');
await zeigeTag(DI);
check(JSON.stringify(await titel(DI)) === JSON.stringify(['Keane', 'Workshop mittags', 'Theaterstück', 'Theater früh']),
  `Di danach: das Theaterstück rutscht unter den Workshop – Abwechslung (${(await titel(DI)).join(', ')})`);

// --- Woche: „Das Beste der Woche“ statt „Für dich“
await ansicht('woche');
const woche = page.locator('#woche-beste');
const zeilen = () => woche.locator('.kz-titel').allInnerTexts();
check(await page.locator('#fuer-dich, [data-aktion="ki-tipp"]').count() === 0, 'kein „Für dich“ mehr, kein Knopf für Claude');
check(await woche.locator('.tagesteil').innerText() === 'Das Beste der Woche' && (await zeilen()).length === 5,
  `die Woche: „Das Beste der Woche“ mit fünf Zeilen (${(await zeilen()).join(' · ')})`);
check((await zeilen())[0] === '♫ Keane' && (await zeilen())[1] === 'Konzert spät' && !(await zeilen()).includes('Gratis Lesung'),
  'oben Keane, dann „Konzert spät“ (am Fr ohne 21:30-Regel) – die angehakte Lesung fehlt');
check((await zeilen()).filter((t) => t === 'Theaterstück').length <= 1, 'jede Veranstaltung nur einmal, auch wenn sie an zwei Tagen ist');
check(await woche.locator('.konzert-zeile').first().locator('.kz-datum').innerText() === 'Di 3.11.', 'mit Tag');
await woche.locator('.konzert-zeile').first().click();
await page.locator(`#tag-${DI}`).waitFor();
check(await page.locator('[data-kal-ansicht="tag"]').getAttribute('aria-pressed') === 'true', 'ein Tipp öffnet den Tag');

// --- Monat
await ansicht('monat');
const monat = page.locator('#monat-beste');
check(await monat.locator('.tagesteil').innerText() === 'Das Beste im Monat' && await monat.locator('.konzert-zeile').count() === 8
  && await monat.locator('.kz-titel').first().innerText() === '♫ Keane', 'der Monat: „Das Beste im Monat“, acht Zeilen, oben Keane');
check(await page.locator('#fuer-dich').count() === 0, 'auch im Monat kein „Für dich“');

// --- Einstellungen ohne KI-Tipp, und der alte Schlüssel ist weg
await einstellungen();
check(await page.locator('#e-ki, #ki-schluessel').count() === 0, 'Einstellungen: kein KI-Tipp mehr');
await page.evaluate(() => {
  localStorage.setItem('freizeit.ki.v1', JSON.stringify({ schluessel: 'sk-ant-test', tipps: {} }));
  localStorage.setItem('boxenstopp.ki.v1', JSON.stringify({ schluessel: 'sk-ant-boxenstopp' }));
});
await page.reload();
await page.waitForSelector('.reiterleiste');
check(await page.evaluate(() => localStorage.getItem('freizeit.ki.v1') === null && localStorage.getItem('boxenstopp.ki.v1') !== null),
  'beim Start räumt die App den eigenen Claude-Schlüssel weg – den von Boxenstopp nicht');
await reiter('programm');

await A.ende();
