/*
 * Reiter „Programm“: Woche für Woche, der Kopf (blättern, Filter, Tagesleiste,
 * „Diese Woche“), beide Zeitregeln, Filter, Laufendes.
 *
 * Die Testdaten (hilfe.mjs) haben für jede Regel einen eigenen Termin:
 * „Konzert spät“ endet nach Richtwert um 22:15, „Theater früh“ laut
 * Beschreibung um 21:00, „Kino lang“ mit festem Ende um 22:30, der
 * „Nachtmarkt“ ist zum Kommen und Gehen, die „Party“ beginnt um 23 Uhr,
 * „Keane“ ist ein Konzert der eigenen Künstler – für das gilt 21:30 nicht.
 */
import { oeffne, testProgramm, MO, DI, MI, DO, FR, SA, SO, DI2 } from './hilfe.mjs';

const {
  page, check, uhr, titelAm, datenTauschen, gespeichert, filter, waehle, reiter, einstellungen, ende,
} = await oeffne({ tag: MO, zeit: '10:00' });

// --- Aufbau
const kasten = page.locator('details[data-offen="diese-woche"]');
check(await kasten.count() === 1 && await kasten.getAttribute('open') === null && await page.locator('.highlights li').count() === 1
  && (await kasten.locator('.dw-vorschau').innerText()).includes('Highlight eins'), 'Highlights und Infos stecken zugeklappt in „Diese Woche“ – mit einer Zeile Vorschau');
check((await kasten.locator('.infos').textContent()).includes('Ferien: keine'), '… dort auch die Infos der Woche');
check((await page.locator('.blaettern .monatstitel').innerText()).includes('KW 45'), 'Kopf nennt die Kalenderwoche');
check(await page.locator('.tag').first().getAttribute('id') === `tag-${MO}`, 'der erste Tag ist heute (Montag)');
check(await page.locator(`#tag-${MO} .heute`).count() === 1, 'heute ist markiert');
check(await page.locator('[data-aktion="vergangene"]').count() === 0, 'am Montag gibt es keine vergangenen Tage');
check(await page.locator('[data-aktion="woche-zurueck"]').isDisabled(), 'vor diese Woche geht es nicht zurück');
check(await page.locator('[data-aktion="kal-heute"]').count() === 0, 'in dieser Woche gibt es keinen Knopf „Heute“ – man ist ja schon da');
const zellen = page.locator('.tagleiste .tagzelle');
check(await zellen.count() === 7 && await page.locator('.tagleiste .tagzelle.ist-heute .tz-nr').innerText() === '2', 'die Tagesleiste: sieben Tage, heute hervorgehoben');
check(await page.locator(`.tagleiste a[href="#tag-${DI}"] .tz-zahl`).innerText() === '4', 'Di: vier Termine in der Leiste – dieselbe Auswahl wie die Liste');
const ersteKarte = await page.locator('.tag .karte').first().boundingBox();
check(ersteKarte && ersteKarte.y < 844 - 64 - 40, `der erste Termin steht ohne Scrollen auf dem Schirm (oben bei ${Math.round(ersteKarte?.y)} px)`);
check(await page.locator('#ansicht .stand, #ansicht .hinweis-install, details.menue').count() === 0, 'kein Stand, kein Installier-Banner, kein Menü mehr im Programm');
await einstellungen();
check((await page.locator('#stand').innerText()).includes('Mo 2.11.'), 'der Stand der Daten steht in den Einstellungen unter „App“');
await reiter('programm');

// --- 21:30-Regel
const di = await titelAm(DI);
check(!di.includes('Konzert spät'), 'Di: Konzert um 20 Uhr (Ende ca. 22:15) ist ausgeblendet');
check(di.includes('Theater früh'), 'Di: Theater 19 Uhr mit „ca. 2 Stunden“ steht drin');
check(di.includes('Theaterstück'), 'Di: Stück 19:30 + 110 Min. (21:20) steht drin');
check(di.includes('Keane'), 'Di: Konzert der eigenen Künstler um 20 Uhr steht drin – die Regel gilt dafür nicht');
const keane = page.locator(`#tag-${DI} .karte`, { hasText: 'Keane' });
check(await keane.locator('.marke.kuenstler').innerText() === '♫ Dein Künstler', 'Di: das Konzert ist als „Dein Künstler“ markiert');
const theater = page.locator(`#tag-${DI} .karte`, { hasText: 'Theater früh' });
check((await theater.locator('.bis').innerText()) === 'bis ca. 21:00', 'Di: geschätztes Ende steht an der Karte');
check((await page.locator(`#tag-${DI} .tag-info`).innerText()).includes('Ausgeblendet: 1 Termin, der erst nach 21:30 endet'), 'Di: Hinweis nennt die ausgeblendete Zahl');
const mi = await titelAm(MI);
check(!mi.includes('Kino lang'), 'Mi: Film mit Ende 22:30 ist ausgeblendet');
check(mi.includes('Nachtmarkt'), 'Mi: Nachtmarkt 18–22 Uhr bleibt (zum Kommen und Gehen)');
check(!(await titelAm(DO)).includes('Party'), 'Do: Party um 23 Uhr ist ausgeblendet');
check((await titelAm(FR)).includes('Konzert spät'), 'Fr: dasselbe Konzert steht drin – kein Arbeitstag danach');
const stueckFr = page.locator(`#tag-${FR} .karte`, { hasText: 'Theaterstück' });
check((await stueckFr.locator('.zeit').innerText()).startsWith('20:00'), 'Fr: abweichende Tageszeit wird benutzt');
check((await stueckFr.locator('.bis').count()) === 0, 'Fr: kein geschätztes Ende, wo die Regel nicht gilt');
const sa = await titelAm(SA);
check(sa.includes('Party') && sa[0] === 'Messe', 'Sa: Party steht drin, Ganztägiges oben');
check(await page.locator(`#tag-${SA} .karte.hohwacht`, { hasText: 'Strandwanderung' }).count() === 1, 'Sa: Hohwacht-Termin ist markiert');
check(!(await titelAm(SO)).includes('Sonntagskonzert'), 'So: Konzert 19:30 (Ende ca. 21:45) ist ausgeblendet');

// --- Laufendes, und was ohne Termin geht
check(await page.locator('#abschnitt-laufend .karte', { hasText: 'Ausstellung X' }).count() === 1, 'Ausstellung steht unter „Läuft gerade“');
check(!(await titelAm(MO)).includes('Ausstellung X'), '… und nicht noch einmal an jedem Tag');
check((await page.locator('#zaehler a[href="#abschnitt-laufend"]').innerText()) === '1 laufend', 'oben neben der Zahl der Termine ein Sprung zum Laufenden – statt einer Zeile an jedem Tag');
check(await page.locator('#abschnitt-immer').count() === 0 && await page.locator('.verweis').count() === 0,
  '„Geht immer“ und der Verweis „Ohne Termin“ sind weg – die Ideen haben ihren Reiter');

// --- Filter
await filter('kostenlos');
check(JSON.stringify(await titelAm(MO)) === JSON.stringify(['Gratis Lesung']), 'kostenlos: Mo nur noch die Gratis-Lesung');
check(!(await titelAm(DI)).length, 'kostenlos: Di ohne Treffer');
check((await page.locator('#zaehler').innerText()).startsWith('2 Termine'), 'kostenlos: Zähler stimmt (Lesung, Nachtmarkt)');
check(await page.locator('.filterleiste .filterchip[data-chip="kostenlos"]').count() === 1 && await page.locator('[data-aktion="filter-auf"] .zahl-marke').innerText() === '1',
  'kostenlos steht als Chip neben dem Filter-Knopf, der Knopf zählt 1');
await page.reload({ waitUntil: 'networkidle' });
check(await page.locator('.filterchip[data-chip="kostenlos"]').count() === 1, 'der Filter überlebt das Neuladen');
await filter('kostenlos');
check(await page.locator('.filterchip').count() === 0 && await page.locator('[data-aktion="filter-auf"] .zahl-marke').count() === 0, 'wieder aus: kein Chip, keine Zahl');

await filter('feierabend');
check(!(await titelAm(DI)).includes('Workshop mittags'), 'Mo–Fr ab 15:30: Workshop um 12:30 fällt weg');
check((await titelAm(SA)).includes('Strandwanderung'), 'Mo–Fr ab 15:30: Samstag bleibt ungefiltert');
check((await page.locator(`#tag-${DI} .tag-info`).innerText()).includes('Filter aktiv'), 'Mo–Fr ab 15:30: der Tag sagt, dass gefiltert wird');
await filter('feierabend');

await filter('kuenstler');
check(JSON.stringify(await titelAm(DI)) === JSON.stringify(['Keane']) && !(await titelAm(MO)).length, 'Meine Künstler: nur das Konzert von Keane');
await filter('kuenstler');

await waehle('#f-region', 'HB');
check(JSON.stringify(await titelAm(SA)) === JSON.stringify(['Strandwanderung']), 'Region Hohwachter Bucht: nur die Strandwanderung');
check((await page.locator('.filterchip[data-chip="region"]').innerText()).includes('Hohwachter Bucht & Kiel'), '… als Chip mit dem Namen der Region');
await waehle('#f-region', '');
const st = await gespeichert();
check(st && st.version === 2 && st.filter.region === '' && st.filter.kostenlos === false, 'Filter stehen im Speicher');

// --- Blättern
await page.click('[data-aktion="woche-vor"]');
check((await page.locator('.blaettern .monatstitel').innerText()).includes('KW 46'), 'eine Woche weiter: KW 46');
check((await titelAm(DI2)).includes('Lesung zweite Woche'), 'KW 46: der Termin der zweiten Woche');
check(await page.locator('.highlights').count() === 0 && await page.locator('details[data-offen="diese-woche"]').count() === 0, 'KW 46: ohne „Diese Woche“');
check(!(await page.locator('[data-aktion="kal-heute"]').isDisabled()), 'KW 46: der Knopf „Heute“ ist aktiv');
await page.click('[data-aktion="woche-vor"]');
check((await page.locator('.banner').innerText()).includes('noch kein Programm'), 'KW 47: nach dem Programm ein Hinweis, dass es noch keins gibt');
check(await page.locator('.tag').count() === 0, 'KW 47: keine Tage ohne Konzert');
await page.click('[data-aktion="kal-heute"]');
check((await page.locator('.blaettern .monatstitel').innerText()).includes('KW 45'), '„Heute“ bringt zurück in KW 45');

// --- vergangene Tage
await uhr(MI, '18:00');
check(await page.locator(`#tag-${MO}`).count() === 0 && await page.locator(`#tag-${DI}`).count() === 0, 'Mi: Mo und Di sind eingeklappt');
check((await page.locator('[data-aktion="vergangene"]').innerText()).includes('(2)'), 'Mi: Knopf nennt zwei vergangene Tage');
check(await page.locator('.tagleiste span.tagzelle.vorbei').count() === 2 && await page.locator('.tagleiste a.tagzelle').count() === 5,
  'Mi: in der Tagesleiste stehen Mo und Di blass und ohne Sprung');
await page.click('[data-aktion="vergangene"]');
check(await page.locator(`#tag-${MO}.vorbei`).count() === 1, 'nach dem Tipp sind sie wieder da, als vergangen markiert');
await page.click('[data-aktion="vergangene"]');

// --- Feiertag: Freitag frei, also gilt Donnerstagabend keine 21:30-Grenze
await datenTauschen(testProgramm({ tage: testProgramm().tage.map((t) => (t.datum === FR ? { ...t, feiertag: true } : t)) }));
check((await titelAm(DO)).includes('Party'), 'vor einem Feiertag gilt die 21:30-Grenze nicht');
check((await page.locator(`#tag-${FR} .tag-info`).innerText()).includes('Feiertag'), 'der Feiertag steht beim Tag');

// --- abgelaufenes Programm
await uhr('2026-11-16');
check((await page.locator('.banner').first().innerText()).includes('abgelaufen'), 'nach dem letzten Tag weist ein Banner auf veraltete Daten hin');

// --- ohne Daten
await datenTauschen(null);
check((await page.locator('#ansicht').innerText()).includes('Keine Daten'), 'ohne programm.json erscheint ein Hinweis statt einer leeren Seite');

await ende();
