/*
 * Freizeit: der Reiter „Diese Woche“ mit beiden Zeitregeln und den Filtern.
 *
 * Die Testwoche (hilfe.mjs) hat für jede Regel einen eigenen Termin:
 * „Konzert spät“ endet nach Richtwert um 22:15, „Theater früh“ laut
 * Beschreibung um 21:00, „Kino lang“ mit festem Ende um 22:30, der
 * „Nachtmarkt“ ist zum Kommen und Gehen, die „Party“ beginnt um 23 Uhr.
 */
import { oeffne, testWoche, MO, DI, MI, DO, FR, SA, SO } from './hilfe.mjs';

const { page, check, uhr, titelAm, datenTauschen, gespeichert, ende } = await oeffne({ tag: MO, zeit: '10:00' });

// --- Aufbau
check(await page.locator('.highlights li').count() === 1, 'Highlights stehen oben');
check((await page.locator('.kicker').first().innerText()).includes('KW 45'), 'Kopf nennt die Kalenderwoche');
check(await page.locator('.tag').first().getAttribute('id') === `tag-${MO}`, 'der erste Tag ist heute (Montag)');
check(await page.locator(`#tag-${MO} .heute`).count() === 1, 'heute ist markiert');
check(await page.locator('[data-aktion="vergangene"]').count() === 0, 'am Montag gibt es keine vergangenen Tage');
check((await page.locator('#stand').innerText()).includes('Mo 2.11.'), 'der Kopf nennt den Stand der Daten');

// --- 21:30-Regel
const di = await titelAm(DI);
check(!di.includes('Konzert spät'), 'Di: Konzert um 20 Uhr (Ende ca. 22:15) ist ausgeblendet');
check(di.includes('Theater früh'), 'Di: Theater 19 Uhr mit „ca. 2 Stunden“ steht drin');
check(di.includes('Theaterstück'), 'Di: Stück 19:30 + 110 Min. (21:20) steht drin');
const theater = page.locator(`#tag-${DI} .karte`, { hasText: 'Theater früh' });
check((await theater.locator('.bis').innerText()) === 'bis ca. 21:00', 'Di: geschätztes Ende steht an der Karte');
check((await page.locator(`#tag-${DI} .tag-info`).innerText()).includes('Ausgeblendet: 1 Termin, der erst nach 21:30 endet'), 'Di: Hinweis nennt die ausgeblendete Zahl');
const mi = await titelAm(MI);
check(!mi.includes('Kino lang'), 'Mi: Film mit Ende 22:30 ist ausgeblendet');
check(mi.includes('Nachtmarkt'), 'Mi: Nachtmarkt 18–22 Uhr bleibt (zum Kommen und Gehen)');
check(!(await titelAm(DO)).includes('Party'), 'Do: Party um 23 Uhr ist ausgeblendet');
const fr = await titelAm(FR);
check(fr.includes('Konzert spät'), 'Fr: dasselbe Konzert steht drin – kein Arbeitstag danach');
const stueckFr = page.locator(`#tag-${FR} .karte`, { hasText: 'Theaterstück' });
check((await stueckFr.locator('.zeit').innerText()).startsWith('20:00'), 'Fr: abweichende Tageszeit wird benutzt');
check((await stueckFr.locator('.bis').count()) === 0, 'Fr: kein geschätztes Ende, wo die Regel nicht gilt');
check((await titelAm(SA)).includes('Party'), 'Sa: Party steht drin');
check(!(await titelAm(SO)).includes('Sonntagskonzert'), 'So: Konzert 19:30 (Ende ca. 21:45) ist ausgeblendet');
const sa = await titelAm(SA);
check(sa[0] === 'Messe', 'Sa: Ganztägiges steht oben');
check(await page.locator(`#tag-${SA} .karte.hohwacht`, { hasText: 'Strandwanderung' }).count() === 1, 'Sa: Hohwacht-Termin ist markiert');

// --- Ganze Woche und Geht immer
check(await page.locator('#abschnitt-woche .karte', { hasText: 'Ausstellung X' }).count() === 1, 'Ausstellung steht unter „Läuft die ganze Woche“');
check(!(await titelAm(MO)).includes('Ausstellung X'), '… und nicht noch einmal an jedem Tag');
check((await page.locator(`#tag-${MO} .tag-info`).innerText()).includes('Außerdem 1 Angebot'), 'der Tag verweist auf die Wochenangebote');
check(await page.locator('#abschnitt-immer .karte', { hasText: 'Elbstrand' }).count() === 1, 'Elbstrand steht unter „Geht immer“');

// --- Filter
await page.click('[data-filter="kostenlos"]');
check(JSON.stringify(await titelAm(MO)) === JSON.stringify(['Gratis Lesung']), 'kostenlos: Mo nur noch die Gratis-Lesung');
check(!(await titelAm(DI)).length, 'kostenlos: Di ohne Treffer');
check((await page.locator('#zaehler').innerText()).startsWith('2 Termine'), 'kostenlos: Zähler stimmt (Lesung, Nachtmarkt)');
await page.reload({ waitUntil: 'networkidle' });
check(await page.locator('[data-filter="kostenlos"]').getAttribute('aria-pressed') === 'true', 'der Filter überlebt das Neuladen');
await page.click('[data-filter="kostenlos"]');

await page.click('[data-filter="feierabend"]');
check(!(await titelAm(DI)).includes('Workshop mittags'), 'Mo–Fr ab 15:30: Workshop um 12:30 fällt weg');
check((await titelAm(SA)).includes('Strandwanderung'), 'Mo–Fr ab 15:30: Samstag bleibt ungefiltert');
check((await page.locator(`#tag-${DI} .tag-info`).innerText()).includes('Filter aktiv'), 'Mo–Fr ab 15:30: der Tag sagt, dass gefiltert wird');
await page.click('[data-filter="feierabend"]');
check((await titelAm(DI)).includes('Workshop mittags'), 'Filter aus: Workshop wieder da');

await page.selectOption('#f-region', 'HB');
check(JSON.stringify(await titelAm(SA)) === JSON.stringify(['Strandwanderung']), 'Region Hohwachter Bucht: nur die Strandwanderung');
await page.selectOption('#f-region', '');
const st = await gespeichert();
check(st && st.filter.region === '' && st.filter.kostenlos === false, 'Filter stehen im Speicher');

// --- vergangene Tage
await uhr(MI, '18:00');
check(await page.locator(`#tag-${MO}`).count() === 0 && await page.locator(`#tag-${DI}`).count() === 0, 'Mi: Mo und Di sind eingeklappt');
check((await page.locator('[data-aktion="vergangene"]').innerText()).includes('(2)'), 'Mi: Knopf nennt zwei vergangene Tage');
await page.click('[data-aktion="vergangene"]');
check(await page.locator(`#tag-${MO}.vorbei`).count() === 1, 'nach dem Tipp sind sie wieder da, als vergangen markiert');
await page.click('[data-aktion="vergangene"]');

// --- Feiertag: Freitag frei, also gilt Donnerstagabend keine 21:30-Grenze
await datenTauschen({ woche: testWoche({ tage: testWoche().tage.map((t) => (t.datum === FR ? { ...t, feiertag: true } : t)) }) });
check((await titelAm(DO)).includes('Party'), 'vor einem Feiertag gilt die 21:30-Grenze nicht');

// --- veraltete Woche
await uhr('2026-11-10');
check((await page.locator('.banner').innerText()).includes('letzten Woche'), 'nach Sonntag weist ein Banner auf veraltete Daten hin');

// --- ohne Wochendaten
await datenTauschen({ woche: null });
check((await page.locator('#ansicht').innerText()).includes('Keine Wochendaten'), 'ohne woche.json erscheint ein Hinweis statt einer leeren Seite');

await ende();
