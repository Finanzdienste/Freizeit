/*
 * Reiter „Kalender“: Monatsblatt mit Zahlen und Bock-Punkten, darunter der
 * gewählte Tag – dieselbe Auswahl wie im Programm (Filter, 21:30-Regel).
 * Monate nach dem Programm zeigen nur noch Konzerte der eigenen Künstler.
 */
import { oeffne, MO, DI, FERN } from './hilfe.mjs';

const { page, check, reiter, ende } = await oeffne({ tag: MO, zeit: '10:00' });
await reiter('kalender');

const feld = (d) => page.locator(`.feld[data-tag="${d}"]`);
check((await page.locator('.monatstitel').innerText()) === 'November 2026', 'der Kalender beginnt im laufenden Monat');
check(await page.locator('.kalender .feld').count() === 42, 'sechs Wochen à sieben Tage');
check(await page.locator('.kalender .wt').first().innerText() === 'MO', 'die Woche beginnt am Montag');
check((await feld(DI).locator('.zahl').innerText()) === '4', 'Di: vier Termine – das späte Konzert zählt nicht, Keane schon');
check(await feld(MO).getAttribute('aria-pressed') === 'true' && (await feld(MO).getAttribute('class')).includes('heute'), 'heute ist gewählt und markiert');
check((await page.locator('#kal-tag h2').innerText()) === 'Montag, 2.11.2026', 'unter dem Blatt steht der gewählte Tag');
const titelMo = await page.$$eval('#kal-tag .karte h3', (hs) => hs.map((h) => h.textContent));
check(titelMo.includes('Gratis Lesung') && titelMo.includes('Stadtrallye ohne Ort'), 'die Termine des Tages stehen darunter');
check(await page.locator('[data-aktion="monat-zurueck"]').isDisabled(), 'vor diesen Monat geht es nicht zurück');

await feld(DI).click();
check((await page.locator('#kal-tag h2').innerText()).startsWith('Dienstag'), 'ein Tipp auf den Dienstag wählt ihn');
check(await page.locator('#kal-tag .karte', { hasText: 'Keane' }).locator('.marke.kuenstler').count() === 1, 'Di: das Konzert von Keane, markiert');
check((await page.locator('#kal-tag .tag-info').innerText()).includes('Ausgeblendet: 1 Termin'), 'Di: die 21:30-Regel nennt, was fehlt');

// Bock färbt das Feld.
check(await feld(DI).locator('.pkt').count() === 0, 'vor dem Haken kein Punkt');
await page.locator('#kal-tag .karte', { hasText: 'Theater früh' }).locator('[data-bock]').click();
check(await feld(DI).locator('.pkt.ich').count() === 1, 'nach dem Haken ein Punkt in deiner Farbe');
check(await page.locator('#kal-tag .karte', { hasText: 'Theater früh' }).locator('[data-bock]').getAttribute('aria-pressed') === 'true', 'der Knopf steht auf Bock');

// Laufendes führt ins Programm.
await page.click('[data-zu-woche]');
check(await page.locator('[data-reiter="programm"]').getAttribute('aria-current') === 'page' && (await page.locator('.blaettern .kicker').innerText()).includes('KW 45'),
  '„im Programm ansehen“ springt in die Woche');
await reiter('kalender');

// Filter aus dem Programm gelten hier auch.
await reiter('programm');
await page.click('[data-filter="kostenlos"]');
await reiter('kalender');
check((await page.locator('.woche-kopf').innerText()).includes('Filter aus dem Programm sind aktiv'), 'ein aktiver Filter wird genannt');
check(await feld(DI).locator('.zahl').count() === 0, 'mit „kostenlos“ hat der Dienstag nichts');
await page.click('[data-aktion="filter-weg"]');
check((await feld(DI).locator('.zahl').innerText()) === '4', '„Alle zeigen“ nimmt die Filter zurück');

// Weiter in die Monate nach dem Programm: nur noch Konzerte.
await page.click('[data-aktion="monat-vor"]');
check((await page.locator('.monatstitel').innerText()) === 'Dezember 2026', 'ein Monat weiter: Dezember');
check(await page.locator('.feld.ohne').count() > 20 && await page.locator('.feld .zahl').count() === 0, 'Dezember: noch kein Programm, keine Termine');
await page.click('[data-aktion="monat-vor"]');
check((await page.locator('.monatstitel').innerText()) === 'Januar 2027', 'und Januar');
check((await feld(FERN).locator('.zahl').innerText()) === '1', 'am 15.1. steht das Konzert');
await feld(FERN).click();
const twod = page.locator('#kal-tag .karte', { hasText: 'The War On Drugs' });
check(await twod.locator('.marke.neu').count() === 1 && (await twod.innerText()).includes('Vorverkauf ab Fr 6.11.'), 'das Konzert mit NEU und Vorverkauf');
check(await page.locator('[data-aktion="monat-vor"]').isDisabled(), 'nach dem letzten Konzert ist Schluss');

await ende();
