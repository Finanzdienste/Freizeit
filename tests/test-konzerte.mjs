/*
 * Freizeit: der Reiter „Konzerte“ – neu Angekündigtes zuerst, dann nach
 * Monat, Vergangenes nicht. Der Punkt an der Leiste zeigt neue Daten an, bis
 * man den Reiter einmal geöffnet hat.
 */
import { oeffne, testKonzerte } from './hilfe.mjs';

const { page, check, reiter, datenTauschen, ende } = await oeffne({ tag: '2026-11-02' });

check(await page.locator('#konzerte-neu').isVisible(), 'neue Konzertdaten: Punkt an der Leiste');
await reiter('konzerte');
check(!(await page.locator('#konzerte-neu').isVisible()), 'nach dem Öffnen ist der Punkt weg');

const abschnitte = await page.$$eval('.abschnitt .monat', (hs) => hs.map((h) => h.textContent));
check(JSON.stringify(abschnitte) === JSON.stringify(['Neu angekündigt', 'Dezember 2026', 'Januar 2027', 'März 2027']), 'Neu angekündigt zuerst, dann die Monate');
check(await page.locator('.karte', { hasText: 'Vorbei Band' }).count() === 0, 'vergangene Konzerte fehlen');
const neu = page.locator('.abschnitt').filter({ hasText: 'Neu angekündigt' }).locator('.karte');
check((await neu.locator('h3').innerText()) === 'The War On Drugs', 'das neue Konzert steht oben');
check(await neu.locator('.marke.neu').count() === 1 && (await neu.innerText()).includes('Vorverkauf ab Fr 6.11.'), 'NEU und Vorverkaufsstart sind markiert');
const twod = page.locator('.karte', { hasText: 'The War On Drugs' }).first();
check((await twod.locator('.zeit').innerText()) === 'Fr 15.1.', 'Datum in der linken Spalte');
check((await twod.locator('.unter').innerText()).includes('Barclays Arena, Hamburg · 19:30 Uhr'), 'Ort, Stadt und Uhrzeit darunter');
check(await page.locator('.karte', { hasText: 'Kurt Vile' }).locator('.marke.warn', { hasText: 'ausverkauft' }).count() === 1, 'Ausverkauftes ist markiert');
const wa = decodeURIComponent((await twod.locator('a', { hasText: 'WhatsApp' }).getAttribute('href')).split('text=')[1]);
check(wa.includes('*The War On Drugs*') && wa.includes('📅 Freitag, 15.1.2027, 19:30 Uhr'), 'WhatsApp-Nachricht zum Konzert');
const kal = new URL(await twod.locator('a', { hasText: 'Kalender' }).getAttribute('href'));
check(kal.searchParams.get('dates') === '20270115T193000/20270115T213000', 'Kalendertermin zum Konzert');

await twod.locator('[data-merken]').click();
await reiter('merkliste');
check(await page.locator('.karte', { hasText: 'The War On Drugs' }).count() === 1, 'Konzerte lassen sich merken');

await datenTauschen({ konzerte: testKonzerte({ konzerte: [] }) });
await reiter('konzerte');
check((await page.locator('#ansicht').innerText()).includes('Noch keine Konzerte'), 'ohne Konzerte ein erklärender Hinweis');

await ende();
