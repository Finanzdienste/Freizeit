/*
 * Standort und Entfernung (js/standort.js): der Bezugspunkt – das Gerät oder
 * eine eingetippte Adresse –, die Entfernung an den Karten, der Umkreis als
 * Filter in allen Ansichten des Programms und auf der Karte, die Reihenfolge
 * nach Nähe, die Ideen. Der Standort des Browsers ist nachgestellt
 * (setGeolocation), die Adresssuche bei OpenStreetMap nachgebaut.
 *
 * Bezugspunkt im Test ist die Mitte der Testdaten (hilfe.mjs, Hamburg):
 * Theater früh liegt 300 m weg, das Theaterstück 500 m, der Workshop 1,7 km,
 * Keane 4,9 km, die Strandwanderung in Hohwacht gut 90 km.
 */
import { oeffne, fakeServer, MO, DI, SA } from './hilfe.mjs';

const SUCHE = 'https://nominatim.openstreetmap.org/search**';
const TREFFER = {
  wandsbek: [
    { lat: '53.57271', lon: '10.08800', name: 'Wandsbek Markt', address: { road: 'Wandsbeker Marktstraße', suburb: 'Wandsbek', city: 'Hamburg' }, display_name: 'Wandsbek Markt, Wandsbek, Hamburg, Deutschland' },
    { lat: '53.60100', lon: '10.15300', name: '', address: { road: 'Rahlstedter Straße', house_number: '1', suburb: 'Rahlstedt', city: 'Hamburg' }, display_name: '1, Rahlstedter Straße, Rahlstedt, Hamburg, Deutschland' },
  ],
  eindeutig: [
    { lat: '53.55100', lon: '9.99400', name: 'Rathausmarkt', address: { square: 'Rathausmarkt', suburb: 'Altstadt', city: 'Hamburg' }, display_name: 'Rathausmarkt, Altstadt, Hamburg' },
  ],
};

const server = fakeServer();
const A = await oeffne({ tag: MO, zeit: '10:00', server });
const { page, check, ctx } = A;
const anfragen = [];
let sucheKaputt = false;
await ctx.route(SUCHE, (route) => {
  const url = new URL(route.request().url());
  anfragen.push(url);
  if (sucheKaputt) return route.fulfill({ status: 503, body: 'besetzt' });
  const q = (url.searchParams.get('q') || '').toLowerCase();
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TREFFER[q] || []) });
});

const feld = () => page.locator('details[data-offen="standort"]');
const knopf = () => feld().locator('> summary');
const auf = async () => { if (!(await feld().getAttribute('open') !== null)) await knopf().click(); };
const unter = (tag, titel) => page.locator(`#tag-${tag} .karte`, { hasText: titel }).locator('.unter').innerText();
const gespeichert = () => A.gespeichert();
const warte = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 8000 });

// --- ohne Bezugspunkt
check((await knopf().innerText()).trim() === '📍 Standort' && await feld().getAttribute('open') === null, 'ohne Bezugspunkt: zugeklappt „📍 Standort“');
check((await unter(DI, 'Theater früh')) === 'Thalia · Bühne', 'ohne Bezugspunkt keine Entfernung an den Karten');
await auf();
check(await page.locator('[data-aktion="umkreis"]').count() === 0 && (await feld().innerText()).includes('Luftlinie'),
  'aufgeklappt: Mein Standort und die Adresssuche – Umkreis und Reihenfolge erst mit Bezugspunkt, dazu der Hinweis');

// --- Gerät ohne Erlaubnis
await page.click('[data-aktion="standort-geraet"]');
await warte(() => document.querySelector('.standort-fehler'));
check((await page.locator('.standort-fehler').innerText()).includes('nicht freigegeben') && !((await gespeichert()) || {}).standort,
  'ohne Erlaubnis: „nicht freigegeben“ mit dem Weg dorthin – nichts gespeichert');

// --- Gerät mit Erlaubnis
await ctx.grantPermissions(['geolocation']);
await ctx.setGeolocation({ latitude: 53.55031, longitude: 9.99301 });
await page.click('[data-aktion="standort-geraet"]');
await warte(() => JSON.parse(localStorage.getItem('freizeit.stand.v1')).standort);
let st = await gespeichert();
check(st.standort.art === 'geraet' && st.standort.name === 'Dein Standort' && JSON.stringify(st.standort.geo) === '[53.55031,9.99301]',
  'Mein Standort: gespeichert als Gerät, „Dein Standort“, auf fünf Stellen');
check((await knopf().innerText()).trim() === '📍 Dein Standort' && /bestimmt \d{2}:\d{2} Uhr/.test(await feld().innerText()) && !(await page.locator('.standort-fehler').count()),
  'der Knopf zeigt den Bezugspunkt, das Feld, wann er bestimmt wurde – die alte Meldung ist weg');
check((await unter(DI, 'Theater früh')) === 'Thalia · 300 m · Bühne' && (await unter(DI, 'Keane')) === 'Sporthalle · 4,9 km · Konzert'
  && (await unter(DI, 'Workshop mittags')) === 'Kochschule · 1,7 km · Food', 'die Entfernung steht hinter dem Ort: 300 m, 1,7 km, 4,9 km');
check((await unter(MO, 'Stadtrallye ohne Ort')) === 'irgendwo · Erlebnis', 'ohne Koordinaten keine Entfernung');
check((await page.locator('#abschnitt-laufend .karte', { hasText: 'Ausstellung X' }).locator('.unter').innerText()).includes('Kunsthalle · 500 m'), 'auch an Laufendem');

// --- Reihenfolge
check(JSON.stringify(await A.titelAm(DI)) === JSON.stringify(['Workshop mittags', 'Theater früh', 'Theaterstück', 'Keane']), 'zuerst nach Uhrzeit');
await page.click('[data-aktion="reihenfolge"][data-wert="entfernung"]');
check(JSON.stringify(await A.titelAm(DI)) === JSON.stringify(['Theater früh', 'Theaterstück', 'Workshop mittags', 'Keane']), '„Entfernung“: das Nächste zuerst');
check(JSON.stringify((await A.titelAm(MO)).slice(-1)) === JSON.stringify(['Stadtrallye ohne Ort']), 'was keinen Ort hat, steht hinten');

// --- Umkreis
await page.click('[data-aktion="umkreis"][data-km="2"]');
check(JSON.stringify(await A.titelAm(DI)) === JSON.stringify(['Theater früh', 'Theaterstück', 'Workshop mittags']), '2 km: Keane (4,9 km) fällt weg');
check(JSON.stringify(await A.titelAm(SA)) === JSON.stringify(['Messe']), '2 km am Samstag: die Messe bleibt, Party (2,7 km) und Strandwanderung fallen weg');
check(!(await A.titelAm(MO)).includes('Stadtrallye ohne Ort'), 'im Umkreis fällt weg, was keinen Ort hat');
check((await knopf().innerText()).trim() === '📍 Dein Standort · 2 km' && (await page.locator('#zaehler').innerText()).endsWith('bis 2 km')
  && await page.locator('.filter-klapp .zahl-marke').count() === 0, 'der Knopf und die Zahl der Treffer nennen den Umkreis – die Marke am Filter-Knopf zählt nur dessen Inhalt');
await page.click('[data-aktion="umkreis"][data-km="50"]');
check((await A.titelAm(DI)).includes('Keane') && !(await A.titelAm(SA)).includes('Strandwanderung'), '50 km: Keane wieder da, Hohwacht (gut 90 km) nicht');
await page.click('[data-aktion="umkreis"][data-km="2"]');

// „Alle Filter zurücksetzen“ im Filter-Feld lässt den Umkreis stehen.
await A.filter('kostenlos');
check(await page.locator('.filter-klapp .zahl-marke').innerText() === '1', 'kostenlos dazu: die Marke am Filter-Knopf zählt 1');
await page.click('[data-aktion="filter-weg"]');
st = await gespeichert();
check(!st.filter.kostenlos && st.filter.umkreis === 2 && st.filter.nachEntfernung === true, '„Alle Filter zurücksetzen“: kostenlos weg, Umkreis und Reihenfolge bleiben');

// --- Monat, Tag
await A.ansicht('monat');
check((await page.locator('.kal-kopf').innerText()).includes('nur bis 2 km um deinen Standort')
  && (await page.locator(`.feld[data-tag="${DI}"] .zahl`).innerText()) === '3', 'Monat: der Umkreis gilt (Di 3 statt 4) und wird genannt');
await page.click(`.feld[data-tag="${DI}"]`);
const imTag = await page.$$eval('#kal-tag .karte h3', (hs) => hs.map((h) => h.textContent));
check(JSON.stringify(imTag) === JSON.stringify(['Theater früh', 'Theaterstück', 'Workshop mittags']), 'Tag: dieselbe Auswahl, nach Nähe');
await page.click('[data-aktion="filter-weg"]');
st = await gespeichert();
check(st.filter.umkreis === 0 && st.standort && st.filter.nachEntfernung, '„Alle zeigen“ nimmt den Umkreis weg – Bezugspunkt und Reihenfolge bleiben');
check((await page.$$eval('#kal-tag .karte h3', (hs) => hs.map((h) => h.textContent))).includes('Keane'), '… Keane ist wieder da');

// --- Adresse
await A.ansicht('liste');
await auf();
await page.click('[data-aktion="standort-suchen"]');
check((await page.locator('.standort-fehler').innerText()).includes('Tipp eine Adresse'), 'leeres Feld: ein Satz, was einzutippen ist – keine Anfrage');
check(anfragen.length === 0, '… und keine Anfrage an OpenStreetMap');
await page.fill('#standort-adresse', 'Ohnetreffer');
await page.press('#standort-adresse', 'Enter');
await warte(() => (document.querySelector('.standort-fehler') || {}).textContent?.includes('Nichts gefunden'));
const url = anfragen[0];
check(anfragen.length === 1 && url.searchParams.get('q') === 'Ohnetreffer' && url.searchParams.get('countrycodes') === 'de' && url.searchParams.get('format') === 'jsonv2'
  && url.searchParams.get('limit') === '5' && url.searchParams.get('accept-language') === 'de',
  'Enter sucht: eine Anfrage bei Nominatim mit q, nur Deutschland, höchstens fünf Treffer, deutsch');
check((await page.locator('.standort-fehler').innerText()).includes('Nichts gefunden für „Ohnetreffer“') && await page.locator('#standort-adresse').inputValue() === 'Ohnetreffer',
  'kein Treffer: „Nichts gefunden“ – der Text bleibt im Feld');
sucheKaputt = true;
await page.click('[data-aktion="standort-suchen"]');
await warte(() => !document.querySelector('[data-aktion="standort-suchen"]').disabled);
check((await page.locator('.standort-fehler').innerText()).includes('antwortet gerade nicht'), 'antwortet die Suche nicht: „antwortet gerade nicht“');
sucheKaputt = false;
await page.fill('#standort-adresse', 'Wandsbek');
await page.click('[data-aktion="standort-suchen"]');
await warte(() => document.querySelectorAll('.treffer-knopf').length === 2);
check(JSON.stringify(await page.$$eval('.treffer-knopf', (bs) => bs.map((b) => b.textContent))) === JSON.stringify(['Wandsbek Markt, Wandsbek', 'Rahlstedter Straße 1, Rahlstedt'])
  && (await gespeichert()).standort.art === 'geraet', 'zwei Treffer: zur Auswahl, kurz benannt – der alte Bezugspunkt gilt noch');
await page.locator('.treffer-knopf').first().click();
st = await gespeichert();
check(st.standort.art === 'adresse' && st.standort.name === 'Wandsbek Markt, Wandsbek' && JSON.stringify(st.standort.geo) === '[53.57271,10.088]'
  && await page.locator('.treffer-knopf').count() === 0 && await page.locator('#standort-adresse').inputValue() === '',
  'angetippt: die Adresse ist der Bezugspunkt, Auswahl und Feld sind leer');
check((await knopf().innerText()).trim() === '📍 Wandsbek Markt' && (await feld().innerText()).includes('Wandsbek Markt, Wandsbek'), 'auf dem Knopf nur der erste Teil des Namens');
check((await unter(DI, 'Theater früh')).startsWith('Thalia · 6,') && (await A.titelAm(DI))[0] === 'Keane', 'die Entfernungen gelten jetzt ab Wandsbek – Keane liegt dort am nächsten');
await page.fill('#standort-adresse', 'Eindeutig');
await page.click('[data-aktion="standort-suchen"]');
await warte(() => JSON.parse(localStorage.getItem('freizeit.stand.v1')).standort.name.startsWith('Rathausmarkt'));
check((await gespeichert()).standort.name === 'Rathausmarkt, Altstadt' && await page.locator('.treffer-knopf').count() === 0, 'ein Treffer: gleich übernommen');
await page.fill('#standort-adresse', 'Wandsbek');
await page.click('[data-aktion="standort-suchen"]');
await warte(() => document.querySelectorAll('.treffer-knopf').length === 2);
await page.locator('.treffer-knopf').first().click();
await page.click('[data-aktion="umkreis"][data-km="10"]');

// --- Neuladen behält alles
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !document.querySelector('#ansicht').textContent.includes('Lädt'));
st = await gespeichert();
check(st.standort.name === 'Wandsbek Markt, Wandsbek' && st.filter.umkreis === 10 && st.filter.nachEntfernung === true
  && (await knopf().innerText()).trim() === '📍 Wandsbek Markt · 10 km' && (await unter(DI, 'Theater früh')).startsWith('Thalia · 6,'),
  'nach dem Neuladen: Bezugspunkt, Umkreis, Reihenfolge und Entfernungen sind noch da');

// --- Karte
await A.reiter('karte');
await warte(() => document.querySelector('.bezug-punkt'));
check((await page.locator('.bezug-schild').innerText()) === 'Wandsbek Markt' && await page.locator('path.umkreis').count() === 1,
  'Karte: der Bezugspunkt als eigener Punkt mit Namen, der Umkreis als Kreis');
check((await page.locator('#karte-fuss').innerText()).includes('Termine bis 10 km') && (await page.locator('.woche-kopf').innerText()).includes('nur bis 10 km um Wandsbek Markt'),
  '… und darüber und darunter steht, dass nur der Umkreis zählt');
await A.reiter('programm');
await auf();
await page.click('[data-aktion="umkreis"][data-km="0"]');
await A.reiter('karte');
await warte(() => document.querySelector('.bezug-punkt'));
check(await page.locator('path.umkreis').count() === 0 && !(await page.locator('.woche-kopf').innerText()).includes('Filter'), 'Umkreis „alle“: Punkt ohne Kreis, kein Filter-Hinweis');

// --- Ideen: Entfernung zum nächsten Ort
await A.reiter('ideen');
await page.locator('details.kategorie[data-kat="sport"] summary').click();
await page.locator('details.kategorie[data-kat="entspannen"] summary').click();
await page.locator('details.kategorie[data-kat="kreativ"] summary').click();
const ideeUnter = (titel) => page.locator('details.kategorie .karte', { hasText: titel }).locator('.unter').innerText();
check(/^Hamburg · ab \d+,\d km · /.test(await ideeUnter('Tischtennis')) && /^Hamburg · \d+,\d km · /.test(await ideeUnter('Sauna')) && !(await ideeUnter('Bügelperlen')).includes('km'),
  'Ideen: „ab …“ bei mehreren Orten, sonst die Entfernung; Zuhause ohne');
await page.locator('details.kategorie .karte', { hasText: 'Tischtennis' }).locator('.kopfzeile').click();
check((await page.locator('details.kategorie .karte', { hasText: 'Tischtennis' }).locator('.orte').innerText()).match(/km/g)?.length === 2, 'aufgeklappt: jeder Ort mit seiner Entfernung');

// --- Löschen
await A.reiter('programm');
await auf();
await page.click('[data-aktion="standort-weg"]');
st = await gespeichert();
check(st.standort === null && st.filter.umkreis === 0 && st.filter.nachEntfernung === false && (await knopf().innerText()).trim() === '📍 Standort'
  && (await unter(DI, 'Theater früh')) === 'Thalia · Bühne', 'Löschen: kein Bezugspunkt, kein Umkreis, Reihenfolge nach Uhrzeit, keine Entfernungen');
await A.reiter('karte');
await page.waitForTimeout(400);
check(await page.locator('.bezug-punkt').count() === 0, 'Karte ohne Bezugspunkt');

// --- Der Standort geht nicht an den Server des Plans
await A.reiter('wir');
await page.fill('#wir-name', 'Tobi');
await page.click('[data-aktion="starten"]');
await page.waitForFunction(() => document.querySelector('#ansicht').innerText.includes('Tobi (du)'));
await A.reiter('programm');
await auf();
await page.click('[data-aktion="standort-geraet"]');
await warte(() => JSON.parse(localStorage.getItem('freizeit.stand.v1')).standort);
await page.locator(`#tag-${DI} .karte`, { hasText: 'Theater früh' }).locator('[data-bock]').click();
await A.abgeglichen();
const gesendet = JSON.stringify(server.aufrufe);
check(server.aufrufe.some((a) => a.name === 'freizeit_bock') && !gesendet.includes('standort') && !gesendet.includes('53.55031'),
  'im gemeinsamen Plan: Haken gehen zum Server, der Standort nicht');

// --- Ein alter Stand ohne die neuen Felder lädt
const B = await oeffne({ tag: MO, zeit: '10:00', browser: A.browser, stand: { version: 2, filter: { region: 'HH', kostenlos: false, umkreis: 7 }, bock: {}, standort: { art: 'quatsch', geo: [1] } } });
const stB = await B.page.evaluate(() => { document.querySelector('[data-filter="kostenlos"]')?.click(); return true; }).then(() => B.gespeichert());
check(B.fehler.length === 0 && (await B.page.locator('details[data-offen="standort"] > summary').innerText()).trim() === '📍 Standort',
  'alter Stand mit kaputtem Bezugspunkt: die App läuft, ohne Bezugspunkt');
check(stB.filter.region === 'HH' && stB.filter.umkreis === 0 && stB.filter.nachEntfernung === false && stB.standort === null,
  '… der Filter behält die Region, ein unerlaubter Umkreis wird 0');

check(A.fehler.length === 0, `keine Fehler in der Konsole${A.fehler.length ? `: ${A.fehler.slice(0, 2).join(' | ')}` : ''}`);
await A.ende();
