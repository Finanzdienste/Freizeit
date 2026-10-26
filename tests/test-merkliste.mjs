/*
 * Freizeit: Merken, Merkliste, Vergangenes wegräumen.
 *
 * Gemerkt wird eine Kopie des Eintrags. Darum muss er auch dann vollständig
 * in der Liste stehen, wenn die nächste Woche die Daten ersetzt hat.
 */
import { oeffne, testWoche, DI } from './hilfe.mjs';

const { page, check, uhr, reiter, datenTauschen, gespeichert, ende } = await oeffne({ tag: '2026-11-02' });

const theater = page.locator(`#tag-${DI} .karte`, { hasText: 'Theater früh' });
await theater.locator('[data-merken]').click();
check(await theater.locator('[data-merken]').getAttribute('aria-pressed') === 'true', 'Merken: Knopf zeigt „gemerkt“');
check((await theater.locator('[data-merken]').innerText()) === 'Gemerkt', 'Merken: Text wechselt');
check((await page.locator('#merkzahl').innerText()) === '1', 'die Leiste zählt einen Eintrag');

await page.locator('#abschnitt-woche .karte', { hasText: 'Ausstellung X' }).locator('[data-merken]').click();
check((await page.locator('#merkzahl').innerText()) === '2', 'auch Wochenangebote lassen sich merken');

await reiter('merkliste');
const liste = await page.$$eval('.karte h3', (hs) => hs.map((h) => h.textContent));
check(JSON.stringify(liste) === JSON.stringify(['Theater früh', 'Ausstellung X']), 'Merkliste nach Datum: Termin, dann Wochenangebot');
check((await page.locator('.karte', { hasText: 'Theater früh' }).locator('.zeit').innerText()) === 'Di 3.11.', 'Termin mit Wochentag und Datum');
check((await page.locator('.karte', { hasText: 'Theater früh' }).locator('.unter').innerText()) === 'Thalia · 19:00 Uhr, bis ca. 21:00', 'Uhrzeit und Ende stehen zusammen unter dem Titel');
check((await page.locator('.karte', { hasText: 'Ausstellung X' }).locator('.zeit').innerText()) === '2.11.–8.11.', 'Wochenangebot mit Zeitraum');
check(await page.locator('.karte', { hasText: 'Theater früh' }).locator('a', { hasText: 'WhatsApp' }).count() === 1, 'auch aus der Merkliste lässt sich teilen');

// Die nächste Woche ersetzt die Daten – die Merkliste bleibt.
const naechste = testWoche({ von: '2026-11-09', bis: '2026-11-15', termine: [], tage: [] });
await datenTauschen({ woche: naechste });
check(await page.locator('[data-reiter="merkliste"]').getAttribute('aria-current') === 'page', 'Neuladen bleibt auf dem Reiter');
check(await page.locator('.karte', { hasText: 'Theater früh' }).count() === 1, 'nach dem Datenwechsel steht der Eintrag noch da');
const st = await gespeichert();
check(st.merkliste.length === 2 && st.merkliste[0].link === 'https://example.org/theater', 'im Speicher liegt die vollständige Kopie');

// Zwei Tage später ist der Termin vorbei.
await uhr('2026-11-05');
await reiter('merkliste');
check(await page.locator('.vorbei-liste .karte', { hasText: 'Theater früh' }).count() === 1, 'Vergangenes rutscht nach „Vorbei“');
check((await page.locator('#merkzahl').innerText()) === '1', 'die Leiste zählt nur, was noch kommt');
await page.click('[data-aktion="vorbei-weg"]');
check(await page.locator('.karte', { hasText: 'Theater früh' }).count() === 0, '„Vorbei entfernen“ räumt auf');

await page.locator('.karte', { hasText: 'Ausstellung X' }).locator('[data-entfernen]').click();
check((await page.locator('#ansicht').innerText()).includes('Noch nichts gemerkt'), 'leere Merkliste erklärt sich');
check((await page.locator('#merkzahl').innerText()) === '', 'die Leiste zeigt keine Zahl mehr');

await ende();
