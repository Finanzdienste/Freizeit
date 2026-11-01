/*
 * Reiter „Programm“, Ansicht Tag (die Vorgabe) und Woche: der Kopf (Ansicht,
 * blättern, Filter, Tagesleiste), die Gliederung nach Tageszeit, beide
 * Zeitregeln, „Läuft heute“, in der Woche die Tageskarten mit „Diese Woche“,
 * Laufendem und Hinweisen, Filter, Wischen, Feiertag, abgelaufenes Programm.
 * Den Monat und den Zeitstreifen prüft test-kalender.mjs.
 *
 * Die Testdaten (hilfe.mjs) haben für jede Regel einen eigenen Termin:
 * „Konzert spät“ endet nach Richtwert um 22:15, „Theater früh“ laut
 * Beschreibung um 21:00, „Kino lang“ mit festem Ende um 22:30, der
 * „Nachtmarkt“ ist zum Kommen und Gehen, die „Party“ beginnt um 23 Uhr,
 * „Keane“ ist ein Konzert der eigenen Künstler – für das gilt 21:30 nicht.
 */
import {
  oeffne, testProgramm, MO, DI, MI, DO, FR, SA, SO, DI2, SCHLUESSEL,
} from './hilfe.mjs';

const A = await oeffne({ tag: MO, zeit: '10:00' });
const {
  page, check, uhr, titelAm, zeigeTag, ansicht, datenTauschen, gespeichert, filter, waehle, reiter, einstellungen, ende,
} = A;
const titel = async () => (await page.locator('.kal-titel').innerText()).replace(/\s+/g, ' ').trim();
const gedrueckt = (k) => page.locator(`[data-kal-ansicht="${k}"]`).getAttribute('aria-pressed');

// --- Aufbau: der Tag ist die Vorgabe
check(JSON.stringify(await page.$$eval('[data-kal-ansicht]', (bs) => bs.map((b) => b.textContent))) === '["Tag","Woche","Monat"]',
  'drei Ansichten: Tag, Woche, Monat – keine Liste mehr');
check(await gedrueckt('tag') === 'true' && await page.locator(`#tag-${MO}`).count() === 1, 'das Programm öffnet als Tag – heute');
check((await titel()) === 'Montag, 2.11. heute' && await page.locator('[data-aktion="kal-heute"]').count() === 0, 'Kopf: „Montag, 2.11.“, als heute markiert – ohne Knopf „Heute“');
check(await page.locator('.tagleiste .tagzelle').count() === 7 && await page.locator('.tagleiste .tagzelle.ist-heute.gewaehlt .tz-nr').innerText() === '2',
  'die Tagesleiste: sieben Tage, heute gewählt');
check(await page.locator(`.tagleiste [data-tag="${DI}"] .tz-zahl`).innerText() === '4', 'Di: vier Termine in der Leiste – dieselbe Auswahl wie am Tag');
const ersteKarte = await page.locator(`#tag-${MO} .karte`).first().boundingBox();
check(ersteKarte && ersteKarte.y < 844 - 64 - 40, `der erste Termin steht ohne Scrollen auf dem Schirm (oben bei ${Math.round(ersteKarte?.y)} px)`);
check(await page.locator('#ansicht .stand, #ansicht .hinweis-install, details.menue').count() === 0, 'kein Stand, kein Installier-Banner, kein Menü im Programm');
check(await page.locator('.reiterleiste [data-reiter="ideen"]').count() === 0 && await page.locator('#ansicht #was-immer-geht').count() === 1,
  'kein Reiter „Ideen“ mehr – „Was immer geht“ steht unten im Programm');
check((await page.locator(`#tag-${MO} .tag-info`).innerText()).includes(`Wetter am ${MO}`), 'beim Tag: das Wetter');
await einstellungen();
check((await page.locator('#stand').innerText()).includes('Mo 2.11.'), 'der Stand der Daten steht in den Einstellungen unter „App“');
await reiter('programm');

// --- Nach Tageszeit gegliedert
await zeigeTag(DI);
check(JSON.stringify(await page.$$eval(`#tag-${DI} .tagesteil`, (hs) => hs.map((h) => h.textContent.replace(/\d+$/, '').trim()))) === '["Nachmittag","Abend"]'
  && await page.locator(`#tag-${DI} .tagesteil .tt-zahl`).last().innerText() === '3', 'Di: Nachmittag (Workshop 12:30) und Abend (3) – nur Teile mit Terminen');

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
check((await page.locator(`#tag-${DI} .tag-info`).innerText()).includes('Ausgeblendet: 1 Termin, der erst nach 21:30 endet'), 'Di: der Tag nennt die ausgeblendete Zahl');
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
check((await page.locator(`#tag-${SA} .tagesteil`).first().innerText()).startsWith('Den ganzen Tag'), 'Sa: die Messe unter „Den ganzen Tag“');
check(await page.locator(`#tag-${SA} .karte.hohwacht`, { hasText: 'Strandwanderung' }).count() === 1, 'Sa: Hohwacht-Termin ist markiert');
check(!(await titelAm(SO)).includes('Sonntagskonzert'), 'So: Konzert 19:30 (Ende ca. 21:45) ist ausgeblendet');

// --- Laufendes: „Läuft heute“ unter dem Tag, oben ein Sprung dorthin
await zeigeTag(MO);
const laufend = page.locator('#abschnitt-laufend');
check(await laufend.count() === 1 && await laufend.getAttribute('open') === null && await laufend.locator('.karte', { hasText: 'Ausstellung X' }).count() === 1
  && (await laufend.locator('summary').innerText()).includes('Läuft heute'), '„Läuft heute“: die Ausstellung, zugeklappt unter dem Tag');
check(!(await titelAm(MO)).includes('Ausstellung X'), '… und nicht zwischen den Terminen');
check((await page.locator('#zaehler').innerText()) === '2 Termine · 1 laufend', 'oben: „2 Termine · 1 laufend“');
await page.click('#zaehler [data-aktion="zu-laufend"]');
check(await page.locator('#abschnitt-laufend').getAttribute('open') !== null, '„1 laufend“ klappt den Kasten auf');

// --- Filter
await filter('kostenlos');
check(JSON.stringify(await titelAm(MO)) === JSON.stringify(['Gratis Lesung']), 'kostenlos: Mo nur noch die Gratis-Lesung');
check(!(await titelAm(DI)).length && (await page.locator(`#tag-${DI} .leer-klein`).innerText()).startsWith('Keine Termine für diese Filter'),
  'kostenlos: Di ohne Treffer – mit Hinweis und „Alle zeigen“');
check(await page.locator('.filterleiste .filterchip[data-chip="kostenlos"]').count() === 1 && await page.locator('[data-aktion="filter-auf"] .zahl-marke').innerText() === '1',
  'kostenlos steht als Chip neben dem Filter-Knopf, der Knopf zählt 1');
await ansicht('woche');
check((await page.locator('#zaehler').innerText()).startsWith('2 Termine'), 'kostenlos: die Woche zählt zwei (Lesung, Nachtmarkt)');
await page.reload({ waitUntil: 'networkidle' });
check(await page.locator('.filterchip[data-chip="kostenlos"]').count() === 1 && await gedrueckt('woche') === 'true', 'Filter und Ansicht überleben das Neuladen');
await filter('kostenlos');
check(await page.locator('.filterchip').count() === 0 && await page.locator('[data-aktion="filter-auf"] .zahl-marke').count() === 0, 'wieder aus: kein Chip, keine Zahl');

await filter('feierabend');
check(!(await titelAm(DI)).includes('Workshop mittags'), 'Mo–Fr ab 15:30: Workshop um 12:30 fällt weg');
check((await page.locator(`#tag-${DI} .tag-info`).innerText()).includes('nur, was nach Feierabend noch geht'), 'Mo–Fr ab 15:30: der Tag sagt, dass gefiltert wird');
check((await titelAm(SA)).includes('Strandwanderung'), 'Mo–Fr ab 15:30: Samstag bleibt ungefiltert');
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

// --- Blättern im Tag
await zeigeTag(MO);
await page.click('[data-aktion="kal-vor"]');
check((await titel()).startsWith('Dienstag, 3.11.') && await page.locator(`#tag-${DI}`).count() === 1 && await page.locator('[data-aktion="kal-heute"]').count() === 1,
  '› blättert einen Tag weiter – jetzt mit „Heute“');
await page.click(`.tagleiste [data-tag="${FR}"]`);
check(await page.locator(`#tag-${FR}`).count() === 1 && await page.locator(`.tagleiste [data-tag="${FR}"]`).getAttribute('aria-pressed') === 'true',
  'ein Tipp in der Tagesleiste wählt den Tag');
await page.click('[data-aktion="kal-heute"]');
check(await page.locator(`#tag-${MO}`).count() === 1, '„Heute“ springt zurück');
await page.click('[data-aktion="kal-zurueck"]');
check((await titel()).startsWith('Sonntag, 1.11.') && await page.locator('[data-aktion="kal-zurueck"]').isDisabled()
  && (await page.locator('#tag-2026-11-01 .leer-klein').innerText()) === 'Keine Termine.', 'zurück bis zum Monatsersten – ein Tag ohne Programm sagt es');
await page.click('[data-aktion="kal-heute"]');

// --- Wischen (auf einem Gerät mit Touch)
const T = await oeffne({ tag: MO, zeit: '10:00', browser: A.browser, touch: true });
const wischen = (dx, dy = 0) => T.page.evaluate(([x, y]) => {
  const el = document.querySelector('.tag');
  const punkt = (px, py) => new window.Touch({
    identifier: 1, target: el, clientX: px, clientY: py,
  });
  el.dispatchEvent(new window.TouchEvent('touchstart', { touches: [punkt(200, 400)], changedTouches: [punkt(200, 400)], bubbles: true }));
  el.dispatchEvent(new window.TouchEvent('touchend', { touches: [], changedTouches: [punkt(200 + x, 400 + y)], bubbles: true }));
}, [dx, dy]);
await wischen(-120);
await T.page.locator(`#tag-${DI}`).waitFor();
check(await T.page.locator(`#tag-${DI}`).count() === 1, 'nach links wischen: der nächste Tag');
await wischen(120);
await T.page.locator(`#tag-${MO}`).waitFor();
check(await T.page.locator(`#tag-${MO}`).count() === 1, 'nach rechts: zurück');
await wischen(-90, 80);
await T.page.waitForTimeout(150);
check(await T.page.locator(`#tag-${MO}`).count() === 1, 'schräg (eher Scrollen) blättert nicht');
check(T.fehler.length === 0, `Wischen: keine Fehler in der Konsole${T.fehler.length ? `: ${T.fehler.join(' | ')}` : ''}`);
await T.ctx.close();

// --- Woche
await ansicht('woche');
check((await titel()) === 'KW 45 · 2.11. – 8.11.', 'Woche: KW und Spanne');
check(await page.locator('.wtag').count() === 7 && await page.locator('.wtag.heute .wt-nr').innerText() === '2', 'sieben Tageskarten, heute hervorgehoben');
check((await page.locator(`.wtag[data-tag="${DI}"] .wt-zahl`).innerText()) === '4 Termine' && (await page.locator(`.wtag[data-tag="${MO}"] .wt-wetter`).innerText()) === `Wetter am ${MO}`,
  'je Tag: wie viele Termine, das Wetter kurz');
check(await page.locator('.wtag .wt-eintrag').count() === 1 && (await page.locator(`.wtag[data-tag="${DI}"] .wt-eintrag`).innerText()).includes('♫ Keane'),
  'in der Karte des Dienstags: das Konzert deiner Künstler – sonst ohne Haken keine Zeilen');
const kasten = page.locator('details[data-offen="diese-woche"]');
check(await kasten.count() === 1 && await kasten.getAttribute('open') === null && await page.locator('.highlights li').count() === 1
  && (await kasten.locator('.ka-vorschau').innerText()).includes('Highlight eins'), '„Diese Woche“: Highlights und Infos zugeklappt – mit einer Zeile Vorschau');
check((await kasten.locator('.infos').textContent()).includes('Ferien: keine'), '… dort auch die Infos der Woche');
check(await page.locator('#abschnitt-laufend .karte', { hasText: 'Ausstellung X' }).count() === 1 && (await page.locator('#abschnitt-laufend summary').innerText()).includes('Läuft diese Woche'),
  '„Läuft diese Woche“: die Ausstellung');
check((await page.locator('#abschnitt-hinweise').textContent()).includes('Abgesagt: nichts'), 'die Hinweise stehen zugeklappt darunter');
await page.click(`.wtag[data-tag="${SA}"]`);
check(await gedrueckt('tag') === 'true' && (await titel()).startsWith('Samstag, 7.11.'), 'ein Tipp auf die Karte öffnet den Tag');
await ansicht('woche');
await page.click('[data-aktion="kal-vor"]');
check((await titel()) === 'KW 46 · 9.11. – 15.11.' && await page.locator('details[data-offen="diese-woche"], #abschnitt-hinweise').count() === 0,
  'eine Woche weiter: KW 46 – ohne „Diese Woche“ und Hinweise');
check((await page.locator(`.wtag[data-tag="${DI2}"] .wt-zahl`).innerText()) === '2 Termine', 'KW 46, Di: die Lesung und die Champions League');
await page.click('[data-aktion="kal-vor"]');
check((await page.locator('.banner').innerText()).includes('noch kein Programm') && await page.locator('.wtag.ohne').count() === 7
  && (await page.locator('.wtag .wt-zahl').first().innerText()) === 'noch kein Programm', 'KW 47: nach dem Programm ein Hinweis, die Tage „noch kein Programm“');
await page.click('[data-aktion="kal-heute"]');
check((await titel()).startsWith('KW 45'), '„Heute“ bringt zurück in KW 45');

// --- Vergangene Tage
await uhr(MI, '18:00');
check(await gedrueckt('woche') === 'true' && await page.locator('.wtag.vorbei').count() === 2 && await page.locator('.wtag.heute').getAttribute('data-tag') === MI,
  'Mi: in der Woche sind Mo und Di vergangen (blass), Mittwoch ist heute');
await page.click(`.wtag[data-tag="${MO}"]`);
check(await page.locator(`#tag-${MO}.vorbei`).count() === 1 && await page.locator('.tagleiste .tagzelle.vorbei').count() === 2,
  'ein vergangener Tag lässt sich ansehen – als vergangen markiert');

// --- Feiertag: Freitag frei, also gilt Donnerstagabend keine 21:30-Grenze
await datenTauschen(testProgramm({ tage: testProgramm().tage.map((t) => (t.datum === FR ? { ...t, feiertag: true } : t)) }));
check((await titelAm(DO)).includes('Party'), 'vor einem Feiertag gilt die 21:30-Grenze nicht');
await zeigeTag(FR);
check((await page.locator(`#tag-${FR} .tag-info`).innerText()).includes('Feiertag'), 'der Feiertag steht beim Tag');
await ansicht('woche');
check(await page.locator(`.wtag[data-tag="${FR}"] .wt-feiertag`).count() === 1, '… und an der Karte in der Woche');

// --- abgelaufenes Programm
await uhr('2026-11-16');
check((await page.locator('.banner').first().innerText()).includes('abgelaufen'), 'nach dem letzten Tag weist ein Banner auf veraltete Daten hin');

// --- ein gespeichertes „liste“ von früher öffnet als Tag
await page.evaluate((key) => {
  const s = JSON.parse(localStorage.getItem(key));
  localStorage.setItem(key, JSON.stringify({ ...s, programmAnsicht: 'liste' }));
}, SCHLUESSEL);
await uhr(MO);
check(await gedrueckt('tag') === 'true' && await page.locator(`#tag-${MO}`).count() === 1, 'ein Stand mit der alten Ansicht „Liste“ öffnet als Tag');

// --- ohne Daten
await datenTauschen(null);
check((await page.locator('#ansicht').innerText()).includes('Keine Daten') && await page.locator('#was-immer-geht').count() === 1,
  'ohne programm.json ein Hinweis statt einer leeren Seite – „Was immer geht“ steht trotzdem da');

await ende();
