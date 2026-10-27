/*
 * Reiter „Kalender“: Monat, Woche und Tag – wie bei Google. Monatsblatt mit
 * Zahlen und Bock-Punkten, Wochenansicht mit Chips für Haken und Eingeplantes,
 * Tagesansicht mit allen Terminen – dieselbe Auswahl wie im Programm (Filter,
 * 21:30-Regel). Monate nach dem Programm zeigen nur noch Konzerte der eigenen
 * Künstler. Die belegten Zeiten des Gastgebers prüft test-zeiten.mjs.
 */
import { oeffne, MO, DI, SA, FERN } from './hilfe.mjs';

const { page, check, reiter, gespeichert, ende } = await oeffne({ tag: MO, zeit: '10:00' });
await reiter('kalender');

const feld = (d) => page.locator(`.feld[data-tag="${d}"]`);
const titel = () => page.locator('.monatstitel').innerText();
const ansicht = (k) => page.click(`[data-kal-ansicht="${k}"]`);

// --- Monat
check(await page.locator('[data-kal-ansicht="monat"]').getAttribute('aria-pressed') === 'true', 'der Kalender öffnet als Monat');
check((await titel()) === 'November 2026', 'der Kalender beginnt im laufenden Monat');
check(await page.locator('.kalender .feld').count() === 42, 'sechs Wochen à sieben Tage');
check(await page.locator('.kalender .wt').first().innerText() === 'MO', 'die Woche beginnt am Montag');
check((await feld(DI).locator('.zahl').innerText()) === '4', 'Di: vier Termine – das späte Konzert zählt nicht, Keane schon');
check((await feld(MO).getAttribute('class')).includes('heute'), 'heute ist markiert');
check(await page.locator('[data-aktion="kal-zurueck"]').isDisabled() && await page.locator('[data-aktion="kal-heute"]').isDisabled(), 'vor diesen Monat geht es nicht zurück; „Heute“ ist man schon');

// Ein Tipp auf einen Tag öffnet den Tag.
await feld(DI).click();
check(await page.locator('[data-kal-ansicht="tag"]').getAttribute('aria-pressed') === 'true' && (await titel()).startsWith('Dienstag, 3.11.2026'), 'ein Tipp auf den Dienstag öffnet die Tagesansicht');
const titelDi = await page.$$eval('#kal-tag .karte h3', (hs) => hs.map((h) => h.textContent));
check(titelDi.includes('Theater früh') && titelDi.includes('Keane') && !titelDi.includes('Konzert spät'), 'die Termine des Tages stehen da – ohne das späte Konzert');
check(await page.locator('#kal-tag .karte', { hasText: 'Keane' }).locator('.marke.kuenstler').count() === 1, 'Di: das Konzert von Keane, markiert');
check((await page.locator('#kal-tag .tag-info').innerText()).includes('Ausgeblendet: 1 Termin'), 'Di: die 21:30-Regel nennt, was fehlt');
check(await page.locator('.tag-streifen').count() === 0, 'ohne Haken und Zeiten kein Zeitstreifen');
await page.click('[data-aktion="kal-vor"]');
check((await titel()).startsWith('Mittwoch, 4.11.2026'), '› blättert einen Tag weiter');
await page.click('[data-aktion="kal-heute"]');
check((await titel()) === 'Montag, 2.11.2026 · heute', '„Heute“ springt zurück auf heute');
const titelMo = await page.$$eval('#kal-tag .karte h3', (hs) => hs.map((h) => h.textContent));
check(titelMo.includes('Gratis Lesung') && titelMo.includes('Stadtrallye ohne Ort'), 'Mo: die Termine des Tages');

// Bock färbt das Feld im Monat und wird ein Chip in der Woche.
await page.click('[data-aktion="kal-vor"]');
await page.locator('#kal-tag .karte', { hasText: 'Theater früh' }).locator('[data-bock]').click();
check(await page.locator('#kal-tag .karte', { hasText: 'Theater früh' }).locator('[data-bock]').getAttribute('aria-pressed') === 'true', 'der Knopf steht auf Bock');
check(await page.locator('.tag-streifen .marker.ich').count() === 1, 'im Zeitstreifen des Tages ein Marker in deiner Farbe');
await ansicht('monat');
check(await feld(DI).locator('.pkt.ich').count() === 1 && await feld(MO).locator('.pkt').count() === 0, 'im Monat: ein Punkt in deiner Farbe am Dienstag');
check((await gespeichert()).kalenderAnsicht === 'monat', 'die Ansicht bleibt gespeichert');

// --- Woche
await ansicht('woche');
check((await titel()) === 'KW 45 · 2.11. – 8.11.', 'die Woche: KW und Spanne');
check(await page.locator('.wo-spalte').count() === 7 && await page.locator('.wo-spalte.wo-heute .wo-nr').innerText() === '2', 'sieben Spalten, heute hervorgehoben');
check((await page.locator(`.wo-spalte[data-wo-tag="${DI}"] .wo-zahl`).innerText()) === '4', 'oben die Zahl der Termine je Tag');
const chip = page.locator(`.wo-spalte[data-wo-tag="${DI}"] .chip.ich`);
check(await chip.count() === 1 && (await chip.innerText()) === 'Theater früh', 'der Haken ist ein Chip am Dienstag');
const oben = await chip.evaluate((el) => parseFloat(el.style.top));
check(oben > 65 && oben < 75, `der Chip sitzt bei 19 Uhr (${oben.toFixed(1)} % von 7–24 Uhr)`);
check(await page.locator('.wo-spalte .chip').count() === 1, 'sonst keine Chips – nur, was Bock hat, zählt');
await chip.click();
check(await page.locator('[data-kal-ansicht="tag"]').getAttribute('aria-pressed') === 'true' && (await titel()).startsWith('Dienstag'), 'ein Tipp auf den Chip öffnet den Tag');
await ansicht('woche');
await page.click('[data-aktion="kal-vor"]');
check((await titel()) === 'KW 46 · 9.11. – 15.11.', '› blättert eine Woche weiter');
await page.click('[data-aktion="kal-zurueck"]');
await page.click(`.wo-spalte[data-wo-tag="${SA}"] .wo-kopf`);
check((await titel()).startsWith('Samstag, 7.11.2026'), 'ein Tipp auf den Tageskopf öffnet den Tag');
const titelSa = await page.$$eval('#kal-tag .karte h3', (hs) => hs.map((h) => h.textContent));
check(titelSa[0] === 'Messe' && titelSa.includes('Party'), 'Sa: Ganztägiges oben, die Party dabei');

// Laufendes führt ins Programm.
await page.click('[data-zu-woche]');
check(await page.locator('[data-reiter="programm"]').getAttribute('aria-current') === 'page' && (await page.locator('.blaettern .kicker').innerText()).includes('KW 45'),
  '„im Programm ansehen“ springt in die Woche');
await reiter('kalender');
check(await page.locator('[data-kal-ansicht="tag"]').getAttribute('aria-pressed') === 'true', 'zurück im Kalender: die Tagesansicht ist noch gewählt');

// Filter aus dem Programm gelten hier auch.
await ansicht('monat');
await reiter('programm');
await page.click('[data-filter="kostenlos"]');
await reiter('kalender');
check((await page.locator('.kal-kopf').innerText()).includes('Filter aus dem Programm sind aktiv'), 'ein aktiver Filter wird genannt');
check(await feld(DI).locator('.zahl').count() === 0, 'mit „kostenlos“ hat der Dienstag nichts');
await page.click('[data-aktion="filter-weg"]');
check((await feld(DI).locator('.zahl').innerText()) === '4', '„Alle zeigen“ nimmt die Filter zurück');

// Weiter in die Monate nach dem Programm: nur noch Konzerte.
await page.click('[data-aktion="kal-vor"]');
check((await titel()) === 'Dezember 2026', 'ein Monat weiter: Dezember');
check(await page.locator('.feld.ohne').count() > 20 && await page.locator('.feld .zahl').count() === 0, 'Dezember: noch kein Programm, keine Termine');
await page.click('[data-aktion="kal-vor"]');
check((await titel()) === 'Januar 2027', 'und Januar');
check((await feld(FERN).locator('.zahl').innerText()) === '1', 'am 15.1. steht das Konzert');
check(await page.locator('[data-aktion="kal-vor"]').isDisabled(), 'nach dem letzten Konzert ist Schluss');
await feld(FERN).click();
const twod = page.locator('#kal-tag .karte', { hasText: 'The War On Drugs' });
check(await twod.locator('.marke.neu').count() === 1 && (await twod.innerText()).includes('Vorverkauf ab Fr 6.11.'), 'das Konzert mit NEU und Vorverkauf');
await page.click('[data-aktion="kal-vor"]');
check((await titel()).startsWith('Samstag, 16.1.2027'), 'in der Tagesansicht geht es bis zum Monatsende weiter');
await page.click('[data-aktion="kal-heute"]');
check((await titel()).includes('heute'), '„Heute“ holt einen aus dem Januar zurück');

await ende();
