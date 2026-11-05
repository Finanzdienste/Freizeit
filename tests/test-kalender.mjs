/*
 * Reiter „Programm“: der Monat – Blatt mit Zahlen, Bock-Punkten, ♫ für
 * Konzerte der eigenen Künstler; ein Tipp wählt den Tag und zeigt darunter
 * seine Karte, ein zweiter (oder ein Tipp auf die Karte) öffnet ihn –, ein
 * Haken als Marker im Zeitstreifen des Tages, als Punkt im Monat und als
 * Zeile in der Woche, dieselben Filter in allen Ansichten und die Monate nach
 * dem Programm, in denen nur noch Konzerte stehen. Tag und Woche prüft
 * test-programm.mjs, die belegten Zeiten des Gastgebers test-zeiten.mjs.
 */
import {
  oeffne, MO, DI, SA, FERN,
} from './hilfe.mjs';

const {
  page, check, reiter, filter, gespeichert, ansicht, ende,
} = await oeffne({ tag: MO, zeit: '10:00' });

const feld = (d) => page.locator(`.feld[data-waehle="${d}"]`);
const titel = async () => (await page.locator('.kal-titel').innerText()).replace(/\s+/g, ' ').trim();
const gedrueckt = (k) => page.locator(`[data-kal-ansicht="${k}"]`).getAttribute('aria-pressed');
const kartenTitel = (d) => page.$$eval(`#tag-${d} .karte h3`, (hs) => hs.map((h) => h.textContent));

// --- Monat
check(await page.locator('[data-reiter="kalender"]').count() === 0, 'einen eigenen Reiter Kalender gibt es nicht');
await ansicht('monat');
check(await gedrueckt('monat') === 'true' && (await titel()) === 'November 2026', '„Monat“ schaltet um – auf den laufenden Monat');
check(await page.locator('.kalender .feld').count() === 42 && await page.locator('.kalender .wt').first().innerText() === 'Mo', 'sechs Wochen à sieben Tage, ab Montag');
check((await feld(DI).locator('.zahl').innerText()) === '4', 'Di: vier Termine – das späte Konzert zählt nicht, Keane schon');
check(await feld(DI).locator('.f-kuenstler').count() === 1 && await feld(MO).locator('.f-kuenstler').count() === 0, '♫ am Dienstag: ein Konzert deiner Künstler');
check((await feld(MO).getAttribute('class')).includes('heute') && await feld(MO).getAttribute('aria-pressed') === 'true', 'heute ist markiert und gewählt');
check(await page.locator('[data-aktion="kal-zurueck"]').isDisabled() && await page.locator('[data-aktion="kal-heute"]').isDisabled(),
  'vor diesen Monat geht es nicht zurück; „Heute“ ist ausgegraut, man ist ja schon da');
check(await page.locator('.prog-kopf [data-aktion="filter-auf"]').count() === 1, 'auch im Monat steht der Filter-Knopf');
check(await page.locator(`.monat-vorschau .wtag[data-tag="${MO}"]`).count() === 1, 'unter dem Blatt: die Karte des gewählten Tages');
check(await page.locator('#monat-konzerte .konzert-zeile', { hasText: 'Keane' }).count() === 1, 'darunter „Deine Konzerte“ im Monat: Keane');

// Ein Tipp wählt den Tag, ein zweiter öffnet ihn.
await feld(DI).click();
check(await gedrueckt('monat') === 'true' && await feld(DI).getAttribute('aria-pressed') === 'true' && await page.locator(`.monat-vorschau .wtag[data-tag="${DI}"]`).count() === 1,
  'ein Tipp auf den Dienstag wählt ihn – darunter steht seine Karte');
check((await page.locator('.monat-vorschau .wt-zahl').innerText()) === '4 Termine' && (await page.locator('.monat-vorschau .wt-auf').innerText()) === 'Ganzen Tag ansehen',
  '… mit der Zahl der Termine und „Ganzen Tag ansehen“');
await feld(DI).click();
check(await gedrueckt('tag') === 'true' && (await titel()).startsWith('Dienstag, 3.11.'), 'ein zweiter Tipp öffnet den Tag');
const titelDi = await kartenTitel(DI);
check(titelDi.includes('Theater früh') && titelDi.includes('Keane') && !titelDi.includes('Konzert spät'), 'die Termine des Tages stehen da – ohne das späte Konzert');
check(await page.locator(`#tag-${DI} .deine-zeit`).count() === 0, 'ohne Haken und Zeiten kein Zeitstreifen');

// Bock: Marker im Zeitstreifen, Punkt in der Leiste und im Monat, Zeile in der Woche.
await page.locator(`#tag-${DI} .karte`, { hasText: 'Theater früh' }).locator('[data-bock]').click();
check(await page.locator(`#tag-${DI} .karte`, { hasText: 'Theater früh' }).locator('[data-bock]').getAttribute('aria-pressed') === 'true', 'der Knopf steht auf Bock');
const marker = page.locator(`#tag-${DI} .deine-zeit .zs-haken.ich`);
check(await marker.count() === 1 && (await page.locator(`#tag-${DI} .dz-titel`).innerText()) === 'Deine Zeit', 'jetzt gibt es „Deine Zeit“ mit einem Marker in deiner Farbe');
const links = await marker.evaluate((el) => parseFloat(el.style.left));
check(links > 70 && links < 71.2, `der Marker sitzt bei 19 Uhr (${links.toFixed(1)} % von 7–24 Uhr)`);
check(await page.locator(`.tagleiste [data-tag="${DI}"] .pkt.ich`).count() === 1, 'in der Tagesleiste ein Punkt am Dienstag');
await ansicht('monat');
check(await feld(DI).locator('.pkt.ich').count() === 1 && await feld(MO).locator('.pkt').count() === 0, 'im Monat: ein Punkt in deiner Farbe am Dienstag');
check((await gespeichert()).programmAnsicht === 'monat', 'die Ansicht bleibt gespeichert');
await ansicht('woche');
const zeile = page.locator(`.wtag[data-tag="${DI}"] .wt-eintrag.ich`);
check(await zeile.count() === 1 && (await zeile.innerText()).replace(/\s+/g, ' ').trim() === '19:00 Theater früh'
  && (await page.locator(`.wtag[data-tag="${DI}"] .wt-zahl`).innerText()) === '4 Termine · 1 mit Bock', 'in der Woche: der Haken als Zeile mit Uhrzeit, oben „1 mit Bock“');
check(await page.locator(`.wtag[data-tag="${DI}"] .zs-haken.ich`).count() === 1 && await page.locator('.legende').count() === 1,
  '… und im kleinen Zeitstreifen der Karte, dazu eine Legende');
await page.click(`.wtag[data-tag="${SA}"]`);
check(await gedrueckt('tag') === 'true' && (await titel()).startsWith('Samstag, 7.11.'), 'ein Tipp auf die Karte öffnet den Tag');
const titelSa = await kartenTitel(SA);
check(titelSa[0] === 'Messe' && titelSa.includes('Party'), 'Sa: Ganztägiges oben, die Party dabei');
await reiter('karte');
await reiter('programm');
check(await gedrueckt('tag') === 'true' && (await titel()).startsWith('Samstag, 7.11.'), 'nach einem Ausflug auf die Karte: Ansicht und Tag sind noch gewählt');

// --- Filter gelten in allen Ansichten
await filter('kostenlos');
await ansicht('monat');
check(await page.locator('.prog-kopf .filterchip[data-chip="kostenlos"]').count() === 1, 'ein aktiver Filter steht als Chip auch im Monat');
check(await feld(DI).locator('.zahl').count() === 0, 'mit „kostenlos“ hat der Dienstag nichts');
await page.click('.prog-kopf .filterchip[data-chip="kostenlos"]');
check((await feld(DI).locator('.zahl').innerText()) === '4' && await page.locator('.filterchip').count() === 0, '✕ am Chip nimmt den Filter zurück');
await page.click('.prog-kopf [data-aktion="filter-auf"]');
check(/^\d+ Termine zeigen$/.test((await page.locator('#blatt .blatt-fuss .knopf.haupt').innerText()).trim()), 'das Blatt im Monat: unten „… Termine zeigen“');
await page.click('#blatt [data-filter="kostenlos"]');
check(await feld(DI).locator('.zahl').count() === 0 && (await page.locator('#blatt .blatt-fuss .knopf.haupt').innerText()).trim() === '4 Termine zeigen',
  'eine Wahl im Blatt gilt sofort – dahinter und in der Zahl unten (November kostenlos: Lesung, Nachtmarkt, Schach am Freitag, Länderspiel)');
await page.click('#blatt [data-filter="kostenlos"]');
await page.click('#blatt .blatt-x');

// --- Weiter in die Monate nach dem Programm: nur noch Konzerte
await page.click('[data-aktion="kal-vor"]');
check((await titel()) === 'Dezember 2026', 'ein Monat weiter: Dezember');
check(await page.locator('.feld.ohne').count() > 20 && await page.locator('.feld .zahl').count() === 0, 'Dezember: noch kein Programm, keine Termine');
await page.click('[data-aktion="kal-vor"]');
check((await titel()) === 'Januar 2027' && (await feld(FERN).locator('.zahl').innerText()) === '1' && await feld(FERN).locator('.f-kuenstler').count() === 1,
  'Januar: am 15. das Konzert, mit ♫');
check(await page.locator('[data-aktion="kal-vor"]').isDisabled(), 'nach dem letzten Konzert ist Schluss');
await feld(FERN).click();
check(await page.locator('#monat-konzerte .konzert-zeile', { hasText: 'The War On Drugs' }).count() === 1, '„Deine Konzerte“ im Januar');
await page.click(`.monat-vorschau [data-tag="${FERN}"]`);
const twod = page.locator(`#tag-${FERN} .karte`, { hasText: 'The War On Drugs' });
check(await twod.locator('.marke.neu').count() === 1 && (await twod.innerText()).includes('Vorverkauf ab Fr 6.11.'), 'ein Tipp auf die Karte öffnet den Tag: das Konzert mit NEU und Vorverkauf');
await page.click('[data-aktion="kal-vor"]');
check((await titel()).startsWith('Samstag, 16.1.2027'), 'in der Ansicht Tag geht es bis zum Monatsende weiter – mit Jahr, weil es nicht dieses ist');
await page.click('[data-aktion="kal-heute"]');
check((await titel()).includes('heute'), '„Heute“ holt einen aus dem Januar zurück');

await ende();
