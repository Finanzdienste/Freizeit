/*
 * Online & TV (Region ONL, `online: true`): Live-Events zum Zuschauen, ohne
 * Ort. An der Karte steht „📺“ und der Sender statt Ort und Entfernung; für
 * die 21:30-Regel zählt der Beginn (Anstoß 21:00 geht, Partie um 22:00 vor
 * einem Arbeitstag nicht); der Filter „Art“ zeigt alles, nur vor Ort oder
 * nur online; der Umkreis lässt Online & TV stehen, nach Entfernung steht es
 * hinten; auf der Landkarte fehlt es, die Zeile darunter zählt es; WhatsApp
 * und Kalender nennen den Sender.
 *
 * Die Testdaten (hilfe.mjs) haben Online & TV in der zweiten Woche: Champions
 * League Di 21:00 (DAZN), Schach-WM Mi und Fr 22:00 (YouTube · FIDE,
 * kostenlos), Länderspiel Sa 20:45 (ZDF, kostenlos). Dazu hier eine Analyse
 * am Di um 12:00 – früher als die Lesung, damit die Reihenfolge nach
 * Entfernung etwas zu sortieren hat.
 */
import { oeffne, testProgramm, MO2, DI2, MI2, FR2, SA2 } from './hilfe.mjs';

const analyse = {
  id: 'analyse', daten: [DI2], zeit: '12:00', dauer: 60, titel: 'Schach-Analyse live', ort: 'Twitch', online: true, region: 'ONL', kategorie: 'Schach', kostenlos: true, link: 'https://example.org/analyse',
};
const programm = testProgramm({ termine: [...testProgramm().termine, analyse] });
// Bezugspunkt: die Mitte der Testdaten (Hamburg).
const stand = {
  version: 2, bock: {}, filter: { art: 'quatsch' }, standort: { art: 'adresse', name: 'Rathausmarkt, Altstadt', geo: [53.5503, 9.993], zeit: '' },
};
const A = await oeffne({ tag: MO2, zeit: '10:00', programm, stand });
const { page, check, titelAm } = A;
const karteAm = (tag, titel) => page.locator(`#tag-${tag} .karte`, { hasText: titel });
const CL = 'Champions League: Bayern – Paris';

// --- Die Karte: Sender statt Ort, keine Entfernung
check(await page.locator('.filterchip').count() === 0 && (await titelAm(DI2)).length === 3, 'ein Stand mit einer „Art“, die es nicht gibt, öffnet wie „Alles“ – kein Chip, alles da');
check((await karteAm(DI2, CL).locator('.unter').innerText()) === '📺 DAZN · Sport', 'Online: „📺 DAZN · Sport“ – der Sender statt des Orts, keine Entfernung');
check((await karteAm(DI2, 'Lesung zweite Woche').locator('.unter').innerText()).startsWith('Literaturhaus · 1,'), '… vor Ort mit Entfernung wie immer');
await karteAm(DI2, CL).locator('.kopfzeile').click();
check((await karteAm(DI2, CL).locator('.marke.rand').first().innerText()) === 'Online & TV', 'aufgeklappt: „Online & TV“ als Region');

// --- 21:30: bei Online zählt der Beginn
check((await titelAm(DI2)).includes(CL) && (await karteAm(DI2, CL).locator('.bis').innerText()) === 'bis ca. 22:55',
  'Di: Anstoß 21:00 – steht da, obwohl es erst gegen 22:55 endet (online zählt der Beginn)');
check(!(await titelAm(MI2)).includes('Schach-WM, Partie 5')
  && (await page.locator(`#tag-${MI2} .tag-info`).innerText()).includes('Ausgeblendet: 1 Online-Termin, der erst nach 21:30 beginnt'),
'Mi: die Partie um 22:00 vor einem Arbeitstag ist ausgeblendet – und der Tag sagt es so');
check((await titelAm(FR2)).includes('Schach-WM, Partie 5'), 'Fr: dieselbe Partie um 22:00 steht da – kein Arbeitstag danach');
check((await titelAm(SA2)).includes('Länderspiel: Deutschland – Frankreich'), 'Sa: das Länderspiel um 20:45');

// --- Filter „Art“
await A.imFilter(() => page.click('#blatt [data-aktion="art"][data-wert="online"]'));
check(JSON.stringify(await titelAm(DI2)) === JSON.stringify(['Schach-Analyse live', CL]) && JSON.stringify(await titelAm(SA2)) === JSON.stringify(['Länderspiel: Deutschland – Frankreich']),
  'Online & TV: Di nur die Analyse und das Spiel, Sa nur das Länderspiel');
check((await page.locator(`#tag-${MI2} .leer-klein`).innerText()).startsWith('Keine Termine für diese Filter') && !(await titelAm(DI2)).includes('Lesung zweite Woche'),
  '… was vor Ort ist, fällt weg');
check((await page.locator('.filterchip[data-chip="art"]').innerText()).startsWith('Online & TV') && (await A.gespeichert()).filter.art === 'online', 'als Chip „Online & TV“, gespeichert als art: online');
await page.click('#ansicht [data-aktion="filter-auf"]');
check((await page.locator('#blatt .blatt-fuss .knopf.haupt').innerText()).trim() === '4 Termine zeigen'
  && (await page.locator('#blatt').innerText()).includes('Live im Stream oder im Fernsehen'), 'im Blatt: „4 Termine zeigen“ und ein Satz, was Online & TV ist');
await page.click('#blatt [data-aktion="art"][data-wert="vorort"]');
await page.click('#blatt .blatt-x');
check(JSON.stringify(await titelAm(DI2)) === JSON.stringify(['Lesung zweite Woche']) && !(await titelAm(SA2)).length, 'Vor Ort: nichts Online mehr');
await page.click('.filterchip[data-chip="art"]');

// --- Umkreis und Entfernung
await A.imFilter(() => page.click('#blatt [data-aktion="umkreis"][data-km="2"]'));
check((await titelAm(DI2)).includes(CL) && (await titelAm(SA2)).includes('Länderspiel: Deutschland – Frankreich'), 'Umkreis 2 km: Online & TV bleibt – das schaut man, wo man ist');
await A.imFilter(() => page.click('#blatt [data-aktion="reihenfolge"][data-wert="entfernung"]'));
check(JSON.stringify(await titelAm(DI2)) === JSON.stringify(['Lesung zweite Woche', 'Schach-Analyse live', CL]), 'nach Entfernung: vor Ort zuerst, Online & TV hinten (untereinander nach Uhrzeit)');
await page.click('.filterchip[data-chip="umkreis"]');

// --- Monat und Tag
await A.ansicht('monat');
check((await page.locator(`.feld[data-tag="${DI2}"] .zahl`).innerText()) === '3' && (await page.locator(`.feld[data-tag="${MI2}"] .zahl`).count()) === 0,
  'Monat: Di 3 (mit den beiden Online-Terminen), Mi keiner – die Partie um 22:00 zählt nicht');
await page.click(`.feld[data-tag="${DI2}"]`);
check((await page.locator('#kal-tag .karte', { hasText: CL }).locator('.unter').innerText()).startsWith('📺 DAZN'), 'Tag: dieselbe Karte mit Sender');
await page.click('[data-aktion="kal-vor"]');
check((await page.locator('#kal-tag .tag-info').innerText()).includes('1 Online-Termin, der erst nach 21:30 beginnt'), 'Tag Mi: der Hinweis, was online ausgeblendet ist');
await A.ansicht('liste');

// --- WhatsApp und Kalender
const wa = decodeURIComponent((await karteAm(DI2, CL).locator('a', { hasText: 'WhatsApp' }).getAttribute('href')).split('text=')[1]);
check(wa.includes('📺 DAZN') && !wa.includes('📍'), 'WhatsApp: „📺 DAZN“ statt einer Adresse');
const kal = new URL(await karteAm(DI2, CL).locator('a', { hasText: 'Kalender' }).getAttribute('href'));
check(kal.searchParams.get('location') === 'DAZN' && kal.searchParams.get('dates') === '20261110T210000/20261110T225500', 'Kalender: Ort ist der Sender, 21:00 bis 22:55');

// --- Bock: im Schnappschuss steht, dass es online ist
await karteAm(DI2, CL).locator('[data-bock]').click();
check((await A.gespeichert()).bock[`t:cl-dazn:${DI2}`].online === true, 'der Haken merkt sich „online“ im Schnappschuss');
await A.reiter('wir');
check((await page.locator('#wir-deine .karte', { hasText: CL }).locator('.unter').innerText()).startsWith('📺 DAZN'), 'unter „Wir“ steht es genauso da');

// --- Landkarte: online nicht darauf, aber gezählt
await A.reiter('karte');
await page.waitForSelector('.leaflet-container');
await page.waitForTimeout(300);
const fuss = await page.locator('#karte-fuss').innerText();
check(fuss.includes('4 online, nur im Programm'), `unter der Karte: „4 online, nur im Programm“ (${fuss})`);
check(await page.evaluate(() => [...document.querySelectorAll('.leaflet-marker-icon')].length) >= 1
  && !(await page.locator('.leaflet-container').innerText()).includes('DAZN'), 'auf der Karte selbst nichts von DAZN');

await A.ende();
