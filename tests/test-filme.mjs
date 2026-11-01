/*
 * IMDb Top 250 (js/filme.js, js/ansicht-filme.js): die Tür unten bei „Was
 * immer geht“, die eigene Seite (#filme) mit Suche, Genre und Auswahl,
 * aufklappen (Beschreibung, Regie, IMDb), Bock – allein und im gemeinsamen
 * Plan, wo Eingeladene „Mit Tobi gucken“ sagen und Tobi sieht, wer welchen
 * Film mit ihm sehen will –, die Zeile in „Wir“ und der Weg zurück.
 *
 * Testdaten: testFilme() in hilfe.mjs (vier Filme, einer ohne IMDb-ID).
 */
import { oeffne, fakeServer, MO } from './hilfe.mjs';

const server = fakeServer();
const A = await oeffne({ tag: MO, server });
const {
  page, check, reiter, gespeichert,
} = A;
const karte = (p, titel) => p.locator('#filmliste .karte.film', { hasText: titel });
const titel = (p) => p.$$eval('#filmliste .karte.film h3', (hs) => hs.map((h) => h.textContent.trim()));
const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const leer = (p) => p.waitForFunction(() => !JSON.parse(localStorage.getItem('freizeit.stand.v1')).warteschlange.length);

// --- Die Tür bei „Was immer geht“
const tuer = page.locator('#was-immer-geht .filme-tuer');
check(await tuer.count() === 1 && (await tuer.locator('.ft-zahl').innerText()) === '4' && (await tuer.locator('.ft-titel').innerText()) === 'IMDb Top 250',
  'unten bei „Was immer geht“ steht die Tür zur IMDb Top 250, mit der Zahl der Filme');
await tuer.click();
await page.waitForSelector('#filmliste');
check(new URL(page.url()).hash === '#filme' && gleich(await titel(page), ['Die Verurteilten', 'Der Pate', 'Inception', '12th Fail']),
  'ein Tipp öffnet die eigene Seite (#filme), die Filme nach Platz');
check(await page.evaluate(() => window.scrollY) === 0 && await page.locator('#was-immer-geht').count() === 0, 'die Seite steht oben, ohne das Programm darunter');
check((await karte(page, 'Der Pate').locator('.film-platz').innerText()).endsWith('2')
  && (await karte(page, 'Der Pate').locator('.unter').innerText()) === 'The Godfather · 1972 · 2 Std. 55 Min. · Krimi, Drama',
'links der Platz, darunter Original, Jahr, Länge und Genre');
check((await karte(page, 'Inception').locator('.unter').innerText()).startsWith('2010 · '), 'ist der Titel schon das Original, steht er nicht doppelt');
check((await karte(page, 'Die Verurteilten').locator('.unter').innerText()).startsWith('★ 9,3 · The Shawshank Redemption · 1994'), 'mit Bewertung vorn: „★ 9,3“');
check((await page.locator('.filme-titelblock .fein').innerText()) === 'Stand 29.9.2025 · jede Woche frisch von IMDb', 'oben der Stand der Liste');
check(await page.locator('.reiterleiste [data-reiter="programm"][aria-current="page"]').count() === 1, 'unten bleibt „Programm“ markiert');
check(await page.locator('[data-aktion="filme-nur"][data-wert="andere"]').count() === 0, 'ohne Plan gibt es nur „Alle“ und „Mit Bock“');

// --- Aufklappen
const pate = karte(page, 'Der Pate');
check(!(await pate.locator('.mehr p').isVisible()) && !(await pate.locator('a.quelle').isVisible()), 'zugeklappt: keine Beschreibung, kein Link');
await pate.locator('.kopfzeile').click();
check((await pate.locator('.mehr p').innerText()) === 'Eine Mafiafamilie und ihr Erbe.' && (await pate.locator('.film-regie').innerText()) === 'Regie: Francis Ford Coppola'
  && (await pate.locator('a.quelle').getAttribute('href')) === 'https://www.imdb.com/de/title/tt0068646/', 'aufgeklappt: Beschreibung, Regie und der Link zu IMDb');
await karte(page, '12th Fail').locator('.kopfzeile').click();
check((await karte(page, '12th Fail').locator('a.quelle').getAttribute('href')) === 'https://www.imdb.com/find/?q=12th%20Fail%202023&s=tt&ttype=ft',
  'ohne IMDb-ID führt der Link zur Suche bei IMDb');

// --- Suche, Genre
await page.fill('#filme-suche', 'nolan');
check(gleich(await titel(page), ['Inception']) && (await page.locator('#filme-zahl').innerText()) === '1 Film von 4'
  && await page.evaluate(() => document.activeElement.id) === 'filme-suche', 'Suche nach Regie: nur Inception – das Feld behält beim Tippen den Fokus');
await page.fill('#filme-suche', 'xyz');
check(await page.locator('#filmliste .karte').count() === 0 && (await page.locator('#filmliste').innerText()).startsWith('Kein Film passt'), 'nichts gefunden: ein Satz statt einer leeren Seite');
await page.click('[data-aktion="filme-alle"]');
check(await page.locator('#filmliste .karte').count() === 4 && await page.locator('#filme-suche').inputValue() === '', '„Alle zeigen“ leert die Suche');
await page.selectOption('#filme-genre', 'Drama');
check(gleich(await titel(page), ['Die Verurteilten', 'Der Pate', '12th Fail']) && (await page.locator('#filme-zahl').innerText()) === '3 Filme von 4', 'Genre Drama: drei Filme');
await page.selectOption('#filme-genre', '');

// --- Bock
await karte(page, 'Inception').locator('[data-bock]').click();
check(await karte(page, 'Inception').locator('[data-bock]').getAttribute('aria-pressed') === 'true' && Boolean((await gespeichert()).bock['f:tt1375666']),
  'Bock auf Inception – gespeichert unter f:tt1375666');
await page.click('[data-aktion="filme-nur"][data-wert="bock"]');
check(gleich(await titel(page), ['Inception']) && (await page.locator('[data-aktion="filme-nur"][data-wert="bock"]').innerText()) === 'Mit Bock 1', '„Mit Bock 1“: nur Inception');

// --- Zurück
await page.click('[data-aktion="filme-zu"]');
await page.waitForSelector('#was-immer-geht');
check(new URL(page.url()).hash !== '#filme' && (await page.locator('.filme-tuer .ft-bock').innerText()) === '1 mit deinem Bock',
  'zurück ins Programm – die Tür zählt deinen Bock');
check(Math.abs(await page.evaluate(() => document.querySelector('#was-immer-geht').getBoundingClientRect().top)) < 200, '… und steht wieder bei „Was immer geht“');

// --- Wir
await reiter('wir');
check((await page.locator('#ansicht').innerText()).includes('1 Film mit Bock'), '„Wir“: der Film steht als Zeile in deiner Bock-Liste, nicht als Termin');
await page.click('[data-aktion="zu-filme"]');
await page.waitForSelector('#filmliste');
check(gleich(await titel(page), ['Inception']) && new URL(page.url()).hash === '#filme', '… ein Tipp darauf öffnet die Filme mit Bock');
await reiter('programm');
check(await page.locator('#filmliste').count() === 0 && await page.locator('#was-immer-geht').count() === 1, 'ein Tipp auf „Programm“ unten schließt die Filme');

// --- Im Plan: Tobi startet, Kim tritt bei und will einen Film mit Tobi gucken
await reiter('wir');
await page.fill('#wir-name', 'Tobi');
await page.click('[data-aktion="starten"]');
await page.waitForFunction(() => document.querySelector('#ansicht').innerText.includes('Tobi (du)'));
await A.abgeglichen();
const code = (await page.locator('#einladungslink').inputValue()).split('#einladung=')[1];

const B = await oeffne({ tag: MO, server, browser: A.browser });
await B.reiter('wir');
await B.page.fill('#wir-code', code);
await B.page.fill('#wir-name-code', 'Kim');
await B.page.click('[data-aktion="beitreten-code"]');
await B.page.waitForFunction(() => document.querySelector('#ansicht').innerText.includes('Kim (du)'));
await B.reiter('programm');
await B.page.click('.filme-tuer');
await B.page.waitForSelector('#filmliste');
const knoepfe = karte(B.page, 'Der Pate').locator('[data-bock]');
check(await knoepfe.count() === 1 && (await knoepfe.innerText()) === 'Mit Tobi gucken' && await knoepfe.getAttribute('data-mitwem') === 'gastgeber',
  'Kim hat je Film einen Knopf: „Mit Tobi gucken“');
check((await karte(B.page, 'Inception').locator('.wer').innerText()).includes('Tobi')
  && (await B.page.locator('[data-aktion="filme-nur"][data-wert="andere"]').innerText()) === 'Tobi will 1', 'Kim sieht Tobis Bock auf Inception – und „Tobi will 1“');
await knoepfe.click();
check((await karte(B.page, 'Der Pate').locator('[data-bock]').innerText()) === 'Mit Tobi gucken ✓', 'Kim will den Paten mit Tobi gucken');
await leer(B.page);

await A.aktion('abgleichen');
await A.abgeglichen();
await reiter('programm');
await page.click('.filme-tuer');
await page.waitForSelector('#filmliste');
const mitDir = page.locator('[data-aktion="filme-nur"][data-wert="andere"]');
check((await mitDir.innerText()) === 'Mit dir 1', 'Tobi sieht oben „Mit dir 1“');
await mitDir.click();
check(gleich(await titel(page), ['Der Pate']) && (await karte(page, 'Der Pate').locator('.wer').innerText()).includes('will mit dir'),
  '… darunter den Paten: „Kim will mit dir“');
await reiter('wir');
check(await page.locator('#wir-mit-dir .karte', { hasText: 'Der Pate' }).count() === 1, 'in „Wir“ steht der Film unter „Wollen mit dir“');
check(B.fehler.length === 0, `Kim: keine Fehler in der Konsole${B.fehler.length ? `: ${B.fehler.slice(0, 2).join(' | ')}` : ''}`);

await A.ende();
