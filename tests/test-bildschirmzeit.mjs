/*
 * Bildschirmzeit für Tobis Widget (js/bildschirmzeit.js – die Quelle liegt im
 * Repo Finanzdienste/Bildschirmzeit, hier eine wortgleiche Kopie): Android
 * zählt die App als „Chrome“; die Widget-App holt sich die Minuten von
 * Supabase. Verbunden wird nur über ihren Link
 * …/Freizeit/#bildschirmzeit=<Kennung>.
 *
 * Geprüft: Ohne Link passiert nichts (keine Anfrage, kein Speicher, kein
 * Wort). Der Link öffnet die App wie sonst, verschwindet aus der Adresse,
 * meldet heute = 0 mit dem öffentlichen Schlüssel (nur „apikey“); gezählt
 * wird nur sichtbar, beim Wegschalten geht der Stand mit keepalive hinaus.
 * Die Einstellungen zeigen den Stand, einen Fehler und „Trennen“; antwortet
 * der Server false, trennt sich die App selbst. Schon verbunden und ganz
 * normal geöffnet (ohne #), meldet sie beim Start, beim Wegschalten und beim
 * Zurückkommen. Die Wege über die Adresse (#wir, #karte, #filme,
 * #eintrag=…) bleiben, wie sie waren – auch in der offenen App und mit
 * ausgeblendetem Programm; ein Link in der offenen App lässt Reiter und
 * Adresse stehen. Kein anderer Weg (Plan,
 * Teilen, Weiteres Gerät) nimmt die Kennung mit.
 *
 * Supabase ist nachgebaut (page.route), die Kennungen sind erfunden.
 */
import {
  oeffne, APP_URL, SCHLUESSEL, MO, DI,
} from './hilfe.mjs';

const KENNUNG = 'Kim-und-Jo_erfundene-Kennung-nur-zum-Testen'; // 43 Zeichen wie aus der Widget-App – erfunden
const ZWEITE = 'ErfundeneTestKennung_KimJo-0123456789abcdef';
const SPEICHER = 'bildschirmzeit.freizeit';
const OEFFENTLICH = 'sb_publishable_wTUNShIKMFjCOmZzQuuN-A_vFHPkKUI';

/** Supabase für die Bildschirmzeit: zeichnet jede Anfrage auf, antwortet `antwort` (true, false oder eine Zahl als HTTP-Fehler). */
async function bzServer(x) {
  const s = { anfragen: [], antwort: true };
  await x.page.route('**/rest/v1/rpc/bildschirmzeit_*', (route) => {
    const r = route.request();
    s.anfragen.push({
      name: r.url().split('/rpc/')[1], methode: r.method(), kopf: r.headers(), p: r.postDataJSON(), roh: r.postData() || '',
    });
    if (typeof s.antwort === 'number') return route.fulfill({ status: s.antwort, contentType: 'application/json', body: '{"message":"kaputt"}' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(s.antwort) });
  });
  return s;
}

/** Vor jeder Seite: fetch belauschen – ob die Bildschirmzeit mit keepalive schickt, sieht man der Anfrage im Netz nicht an. */
function fetchSpion() {
  const echt = window.fetch;
  window.__bz = [];
  window.fetch = function spion(adresse, optionen = {}) {
    if (String(adresse).includes('/rpc/bildschirmzeit_')) window.__bz.push({ keepalive: optionen.keepalive === true, laenge: String(optionen.body || '').length });
    return echt.call(this, adresse, optionen);
  };
}

/** Jede Anfrage des Browsers mitschreiben (Adresse und Inhalt). */
function mitschreiben(x) {
  const liste = [];
  x.ctx.on('request', (r) => liste.push({ url: r.url(), daten: r.postData() || '' }));
  return liste;
}

const bereit = (x) => x.page.waitForFunction(() => !document.querySelector('#ansicht').textContent.includes('Lädt'));
const warte = async (bedingung, ms = 5000) => {
  for (const ende = Date.now() + ms; Date.now() < ende;) {
    if (await bedingung()) return true;
    await new Promise((r) => { setTimeout(r, 50); });
  }
  return false;
};
/** Die App neu öffnen, mit dem Link aus der Widget-App (über about:blank, damit sie wirklich neu lädt). */
async function mitLink(x, k = KENNUNG) {
  await x.page.goto('about:blank');
  await x.page.goto(`${APP_URL}#bildschirmzeit=${k}`, { waitUntil: 'networkidle' });
  await bereit(x);
}
/** Wegschalten bzw. zurückkommen – so, wie der Browser es der Seite sagt. */
const sichtbar = (x, ja) => x.page.evaluate((v) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (v ? 'visible' : 'hidden') });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => !v });
  document.dispatchEvent(new window.Event('visibilitychange'));
}, ja);
const uhrVor = (x, minuten) => x.page.evaluate((m) => window.__uhrVor(m), minuten);
const gespeichert = (x) => x.page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), SPEICHER);
const bzSchluessel = (x) => x.page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('bildschirmzeit')));
const aktiverReiter = (x) => x.page.locator('.reiterleiste [aria-current="page"]').getAttribute('data-reiter').catch(() => '');
const abschnitt = (x) => x.page.locator('#e-bildschirmzeit');
const abschnittText = (x) => x.page.locator('#e-bildschirmzeit .e-zeile').first().innerText().catch(() => '');
const hinweis = (x) => x.page.locator('#bz-hinweis').innerText().catch(() => '');
/** Wie die App aufgeht: welcher Reiter, welche Ansicht, welcher Tag. */
const startBild = async (x) => ({
  reiter: await aktiverReiter(x),
  titel: await x.page.locator('.kal-titel').innerText().catch(() => ''),
  heute: await x.page.locator(`#tag-${MO}`).count(),
  ansicht: await x.page.locator('[data-kal-ansicht][aria-pressed="true"]').getAttribute('data-kal-ansicht').catch(() => ''),
});

// --- Ohne Link: nichts – keine Anfrage, kein Speicher, kein Wort davon
const A = await oeffne({ tag: MO, zeit: '10:00' });
const { check, browser } = A;
const anfragenA = mitschreiben(A);
await A.ctx.addInitScript(fetchSpion);
await A.page.reload({ waitUntil: 'networkidle' });
await bereit(A);
const ohneProgramm = await A.page.locator('#ansicht').innerText();
await A.reiter('karte');
await A.reiter('wir');
await A.einstellungen();
await sichtbar(A, false);
await uhrVor(A, 6);
await sichtbar(A, true);
await A.page.waitForTimeout(400);
const ohneEinstellungen = await A.page.locator('#ansicht').innerText();
check(!anfragenA.some((r) => r.url.includes('/rpc/bildschirmzeit_') || r.url.includes('#bildschirmzeit')) && (await A.page.evaluate(() => window.__bz.length)) === 0,
  'ohne Link: keine einzige Anfrage an bildschirmzeit_* – auch nicht beim Weg- und Zurückschalten');
check((await bzSchluessel(A)).length === 0, 'ohne Link: nichts im Speicher unter „bildschirmzeit.“');
check(await abschnitt(A).count() === 0 && await A.page.locator('#bz-hinweis').count() === 0
  && !/Bildschirmzeit|Widget/.test(ohneEinstellungen) && !/Bildschirmzeit|Widget/.test(ohneProgramm),
'ohne Link: kein Abschnitt, kein Hinweis, kein Wort von Bildschirmzeit oder Widget – weder in den Einstellungen noch im Programm');
await A.ende({ schliessen: false });

// --- Der Link aus der Widget-App: die App geht auf wie sonst, verbunden
const B = await oeffne({ tag: MO, zeit: '10:00', browser });
const vorher = await startBild(B);
const bz = await bzServer(B);
await B.ctx.addInitScript(fetchSpion);
await mitLink(B);
check(await warte(() => bz.anfragen.length >= 1), 'der Link schickt gleich eine Meldung');
const erste = bz.anfragen[0] || { p: {}, kopf: {} };
const nachher = await startBild(B);
check(nachher.reiter === 'programm' && JSON.stringify(nachher) === JSON.stringify(vorher),
  `die App geht auf wie ohne Link: ${nachher.reiter}, ${nachher.ansicht}, „${nachher.titel}“`);
check(await B.page.evaluate(() => location.hash) === '' && !B.page.url().includes('bildschirmzeit'), 'danach steht die Adresse ohne #bildschirmzeit da');
check(await B.page.locator('#bz-hinweis').waitFor({ timeout: 3000 }).then(() => true).catch(() => false)
  && (await hinweis(B)).includes('Bildschirmzeit verbunden'), 'oben ein Hinweis: „Bildschirmzeit verbunden …“');
check(erste.name === 'bildschirmzeit_melden' && erste.methode === 'POST' && erste.p.p_app === 'freizeit' && erste.p.p_kennung === KENNUNG,
  'POST an bildschirmzeit_melden mit p_app „freizeit“ und der Kennung aus dem Link');
check(JSON.stringify(erste.p.p_tage) === JSON.stringify({ [MO]: 0 }), `… und heute = 0, damit die Widget-App „verbunden“ sieht (${JSON.stringify(erste.p.p_tage)})`);
check(erste.kopf.apikey === OEFFENTLICH && erste.kopf.authorization === undefined && /application\/json/.test(erste.kopf['content-type'] || ''),
  'Kopf: der öffentliche Schlüssel nur als „apikey“, kein Authorization');
check((await gespeichert(B))?.kennung === KENNUNG, `die Kennung steht unter „${SPEICHER}“`);
check(!JSON.stringify(await B.page.evaluate((k) => localStorage.getItem(k), SCHLUESSEL)).includes(KENNUNG), '… und nicht im Stand der App (freizeit.stand.v1)');

// Die Einstellungen: ein kleiner Abschnitt zwischen „Gemeinsamer Plan“ und „App“
await B.einstellungen();
const reihe = await B.page.$$eval('#ansicht section.einstellung', (s) => s.map((x) => x.id));
check(reihe.indexOf('e-bildschirmzeit') === reihe.indexOf('e-plan') + 1 && reihe.indexOf('e-app') === reihe.indexOf('e-bildschirmzeit') + 1,
  `Einstellungen: der Abschnitt „Bildschirmzeit“ nach „Gemeinsamer Plan“, vor „App“ (${reihe.join(', ')})`);
check(/^Verbunden mit deinem Widget\. Heute unter 1 Min\. offen, zuletzt gemeldet um \d{2}:\d{2}\.$/.test((await abschnittText(B)).split('\n')[0]),
  `… „${(await abschnittText(B)).split('\n')[0]}“`);
check(await B.page.locator('#e-bildschirmzeit [data-aktion="bildschirmzeit-trennen"]').innerText() === 'Trennen' && await B.page.locator('#bz-hinweis').count() === 0,
  '… mit „Trennen“; der Hinweis von oben ist beim Reiterwechsel weg');

// --- Die Zeit läuft, solange die App zu sehen ist; beim Wegschalten geht der Stand mit keepalive hinaus
for (let i = 0; i < 3; i++) {
  await uhrVor(B, 1);
  await B.reiter('einstellungen');
}
check((await abschnittText(B)).includes('Heute 3 Min. offen'), `drei Minuten offen: „Heute 3 Min. offen“ (${(await abschnittText(B)).split('\n')[0]})`);
const vorWeg = bz.anfragen.length;
await sichtbar(B, false);
check(await warte(() => bz.anfragen.length > vorWeg), 'Wegschalten schickt den Stand');
const weg = bz.anfragen[bz.anfragen.length - 1] || { p: {}, roh: '' };
const spion = await B.page.evaluate(() => window.__bz);
check(weg.p.p_tage && weg.p.p_tage[MO] >= 180 && weg.p.p_app === 'freizeit', `… mit heute ${weg.p.p_tage && weg.p.p_tage[MO]} s`);
check(spion.length && spion[spion.length - 1].keepalive === true && weg.roh.length < 300, `… mit keepalive, ${weg.roh.length} Byte`);
await uhrVor(B, 10);
await sichtbar(B, true);
await B.page.waitForTimeout(200);
check((await abschnittText(B)).includes('Heute 3 Min. offen'), 'zehn Minuten weggeschaltet zählen nicht – zurück steht da noch „3 Min.“');
check(/zuletzt gemeldet um \d{2}:\d{2}\./.test(await abschnittText(B)), 'zurück zeigt der Abschnitt die letzte Meldung');

// Kommt es nicht durch, steht das da – bis es wieder klappt
bz.antwort = 503;
await uhrVor(B, 1);
await sichtbar(B, false);
await warte(async () => (await gespeichert(B))?.fehler === 'Fehler 503');
await sichtbar(B, true);
await B.page.waitForTimeout(200);
check((await B.page.locator('#e-bildschirmzeit').innerText()).includes('Zuletzt nicht durchgekommen: Fehler 503.'), 'nicht durchgekommen: „Zuletzt nicht durchgekommen: Fehler 503.“');
bz.antwort = true;
await uhrVor(B, 1);
await sichtbar(B, false);
await warte(async () => (await gespeichert(B))?.fehler === '');
await sichtbar(B, true);
await B.page.waitForTimeout(200);
check(!(await B.page.locator('#e-bildschirmzeit').innerText()).includes('nicht durchgekommen') && await abschnitt(B).count() === 1, '… und weg, sobald es wieder klappt');

// --- Antwortet der Server false (die Widget-App hat ihre Daten gelöscht): getrennt
bz.antwort = false;
await uhrVor(B, 1);
await sichtbar(B, false);
await warte(async () => (await gespeichert(B)) === null);
await sichtbar(B, true);
await B.page.waitForTimeout(200);
check(await abschnitt(B).count() === 0 && (await bzSchluessel(B)).length === 0, 'Antwort false: Abschnitt und Speicher weg');
check((await hinweis(B)).includes('Bildschirmzeit getrennt'), 'oben der Hinweis „Bildschirmzeit getrennt …“');
const nachFalse = bz.anfragen.length;
await uhrVor(B, 6);
await sichtbar(B, false);
await sichtbar(B, true);
await B.page.waitForTimeout(400);
check(bz.anfragen.length === nachFalse, 'danach geht nichts mehr hinaus');
await B.page.click('#bz-hinweis [data-aktion="meldung-weg"]');
check(await B.page.locator('#bz-hinweis').count() === 0 && await B.page.locator('#ansicht .seiten-titel').count() === 1
  && !/Bildschirmzeit/.test(await B.page.locator('#ansicht').innerText()), '✕ nimmt den Hinweis weg – die Einstellungen sind wieder wie ohne Widget');

// --- Ein Link in der offenen App (hashchange) verbindet auch – dann „Trennen“
bz.antwort = true;
const vorZweite = bz.anfragen.length;
await B.page.evaluate((k) => { location.hash = `#bildschirmzeit=${k}`; }, ZWEITE);
check(await B.page.locator('#e-bildschirmzeit').waitFor({ timeout: 3000 }).then(() => true).catch(() => false)
  && await aktiverReiter(B) === 'einstellungen' && await B.page.evaluate(() => location.hash) === '#einstellungen',
'ein Link in der offenen App: verbunden, man bleibt in den Einstellungen, die Adresse wieder #einstellungen');
check(await warte(() => bz.anfragen.slice(vorZweite).some((a) => a.p.p_kennung === ZWEITE)) && (await gespeichert(B))?.kennung === ZWEITE
  && (await hinweis(B)).includes('Bildschirmzeit verbunden'), '… mit der neuen Kennung gemeldet und gemerkt, oben der Hinweis');
await B.page.click('#e-bildschirmzeit [data-aktion="bildschirmzeit-trennen"]');
check(await abschnitt(B).count() === 0 && (await bzSchluessel(B)).length === 0 && await B.page.locator('#bz-hinweis').count() === 0
  && !/Bildschirmzeit/.test(await B.page.locator('#ansicht').innerText()), '„Trennen“: Abschnitt, Hinweis und Speicher weg');
const nachTrennen = bz.anfragen.length;
await uhrVor(B, 6);
await sichtbar(B, false);
await sichtbar(B, true);
await B.page.reload({ waitUntil: 'networkidle' });
await bereit(B);
await B.page.waitForTimeout(300);
check(bz.anfragen.length === nachTrennen && (await bzSchluessel(B)).length === 0, '… und danach keine Anfrage mehr, auch nicht nach dem Neuladen');
await B.ende({ schliessen: false });

// --- Der häufigste Fall: schon verbunden, die App ganz normal geöffnet (vom Startbildschirm, ohne Link, ohne #)
const N = await oeffne({ tag: MO, zeit: '10:00', browser });
const bzN = await bzServer(N);
await N.ctx.addInitScript(fetchSpion);
await mitLink(N);
await warte(() => bzN.anfragen.length >= 1);
/** n Minuten offen – je Minute einmal hinsehen (eine Lücke zählt höchstens eine Minute). */
const offen = async (x, n) => {
  for (let i = 0; i < n; i++) {
    await uhrVor(x, 1);
    await x.reiter('einstellungen');
  }
};
await offen(N, 2);
// Die Meldung beim Weggehen kommt nicht durch (Chrome hat die App vorher beendet o. Ä.).
bzN.antwort = 503;
await sichtbar(N, false);
await warte(async () => (await gespeichert(N))?.fehler === 'Fehler 503');
await N.page.goto('about:blank');
await N.page.waitForTimeout(300);
bzN.antwort = true;
const vorStart = bzN.anfragen.length;
await N.page.goto(APP_URL, { waitUntil: 'networkidle' });
await bereit(N);
// Dass die Anfrage von der neu geöffneten Seite kommt, zeigt der Spion dieser Seite.
check(await warte(async () => (await N.page.evaluate(() => window.__bz.filter((a) => !a.keepalive).length)) >= 1) && bzN.anfragen.length > vorStart,
  'verbunden und ganz normal geöffnet (ohne #): gleich nach dem Start geht eine Meldung hinaus');
const start = bzN.anfragen[bzN.anfragen.length - 1] || { p: {} };
check(start.name === 'bildschirmzeit_melden' && start.p.p_kennung === KENNUNG && start.p.p_app === 'freizeit' && start.p.p_tage && start.p.p_tage[MO] >= 120
  && await N.page.evaluate(() => location.hash) === '' && await N.page.locator('#bz-hinweis').count() === 0,
`… mit dem Stand von vorher (heute ${start.p.p_tage && start.p.p_tage[MO]} s), ohne Hinweis, die Adresse schlicht`);
await warte(async () => (await gespeichert(N))?.fehler === '');
// Weiter offen, dann weg – auch diese Meldung kommt nicht durch; beim Zurückkommen holt die App sie nach.
await offen(N, 2);
bzN.antwort = 503;
const vorWegN = bzN.anfragen.length;
await sichtbar(N, false);
check(await warte(() => bzN.anfragen.length > vorWegN), '… zählt weiter und meldet beim Wegschalten');
const wegN = bzN.anfragen[bzN.anfragen.length - 1] || { p: {} };
const spionN = await N.page.evaluate(() => window.__bz);
check(wegN.p.p_tage && wegN.p.p_tage[MO] >= 240 && spionN.length && spionN[spionN.length - 1].keepalive === true,
  `… mit keepalive und heute ${wegN.p.p_tage && wegN.p.p_tage[MO]} s (zwei Minuten vorher, zwei jetzt)`);
await warte(async () => (await gespeichert(N))?.fehler === 'Fehler 503');
bzN.antwort = true;
await uhrVor(N, 5);
const vorZurueck = bzN.anfragen.length;
await sichtbar(N, true);
check(await warte(() => bzN.anfragen.length > vorZurueck) && await warte(async () => (await gespeichert(N))?.fehler === ''),
  '… und beim Zurückkommen geht ebenfalls eine Meldung hinaus');
const zurueck = bzN.anfragen[vorZurueck] || { p: {} };
check(zurueck.name === 'bildschirmzeit_melden' && zurueck.p.p_tage && zurueck.p.p_tage[MO] >= 240 && zurueck.p.p_tage[MO] < 360,
  `… mit dem Stand von eben (heute ${zurueck.p.p_tage && zurueck.p.p_tage[MO]} s – weggeschaltet zählt nicht)`);
await N.ende({ schliessen: false });

// --- Die Wege über die Adresse bleiben, wie sie waren – auch neben der Bildschirmzeit
const C = await oeffne({ tag: MO, zeit: '10:00', browser, hash: 'wir' });
const bzC = await bzServer(C);
check(await aktiverReiter(C) === 'wir' && await C.page.evaluate(() => location.hash) === '#wir', '#wir öffnet „Wir“ und bleibt in der Adresse');
const springe = async (h) => {
  await C.page.evaluate((x) => { location.hash = x; }, h);
  await C.page.waitForTimeout(150);
  await bereit(C);
};
await springe('#karte');
check(await aktiverReiter(C) === 'karte' && await C.page.locator('#landkarte').count() === 1, 'in der offenen App: #karte öffnet die Karte');
await springe(`#bildschirmzeit=${KENNUNG}`);
check(await aktiverReiter(C) === 'karte' && await C.page.locator('#landkarte').count() === 1 && await C.page.evaluate(() => location.hash) === '#karte'
  && !C.page.url().includes('bildschirmzeit') && await warte(() => bzC.anfragen.length === 1) && (await hinweis(C)).includes('Bildschirmzeit verbunden'),
'der Link aus der Widget-App auf der Karte: verbunden, die Karte bleibt, in der Adresse wieder #karte');
await C.page.reload({ waitUntil: 'networkidle' });
await bereit(C);
check(await aktiverReiter(C) === 'karte' && await C.page.locator('#landkarte').count() === 1, '… und nach dem Neuladen ist es noch die Karte');
await springe('#einstellungen');
check(await C.page.locator('#ansicht .seiten-titel').count() === 1 && await abschnitt(C).count() === 1, 'danach #einstellungen – mit dem Abschnitt');
await springe('#filme');
check(await C.page.locator('.filme-seite').count() === 1 && await C.page.evaluate(() => location.hash) === '#filme', '#filme öffnet die IMDb Top 250');
const vorFilmLink = bzC.anfragen.length;
await springe(`#bildschirmzeit=${KENNUNG}`);
check(await C.page.locator('.filme-seite').count() === 1 && await C.page.evaluate(() => location.hash) === '#filme'
  && await warte(() => bzC.anfragen.length > vorFilmLink) && (await hinweis(C)).includes('Bildschirmzeit verbunden'),
'der Link auf der IMDb-Seite: sie bleibt offen, in der Adresse #filme, wieder gemeldet');
await springe(`#eintrag=t:theater-frueh:${DI}`);
check(await C.page.locator(`#tag-${DI} .karte.auf`, { hasText: 'Theater früh' }).count() === 1 && await C.page.evaluate(() => location.hash) === '',
  'ein geteilter Link (#eintrag=…) führt wie sonst zum Termin, aufgeklappt');
await springe('#ideen');
check(await aktiverReiter(C) === 'programm' && await C.page.locator('#was-immer-geht').count() === 1, '#ideen führt wie sonst zu „Was immer geht“');
await C.page.goto('about:blank');
await C.page.goto(`${APP_URL}#eintrag=t:theater-frueh:${DI}`, { waitUntil: 'networkidle' });
await bereit(C);
await C.page.locator(`#tag-${DI} .karte.auf`).first().waitFor({ timeout: 3000 }).catch(() => {});
check(await C.page.locator(`#tag-${DI} .karte.auf`, { hasText: 'Theater früh' }).count() === 1 && await C.page.locator('#bz-hinweis').count() === 0
  && (await gespeichert(C))?.kennung === KENNUNG, 'verbunden und frisch geöffnet über #eintrag=…: der Termin, kein Hinweis, die Verbindung bleibt');
await C.ende({ schliessen: false });

// --- Programm ausgeblendet: Der Link landet auf dem ersten Reiter, der an ist
const D = await oeffne({ tag: MO, zeit: '10:00', browser, stand: { version: 2, reiterAus: ['programm'] } });
const bzD = await bzServer(D);
await mitLink(D);
check(await aktiverReiter(D) === 'karte' && await D.page.locator('#landkarte').count() === 1 && await D.page.evaluate(() => location.hash) === ''
  && await warte(() => bzD.anfragen.length === 1) && (await hinweis(D)).includes('Bildschirmzeit verbunden'),
'Programm aus: der Link öffnet die Karte (den Start-Reiter), verbunden, mit Hinweis');
await D.ende({ schliessen: false });

// --- Kein anderer Weg nimmt die Kennung mit: Plan, Abgleich, Einladung, Weiteres Gerät, WhatsApp
const E = await oeffne({ tag: MO, zeit: '10:00', browser });
await E.reiter('wir');
await E.page.fill('#wir-name', 'Tobi');
await E.page.click('[data-aktion="starten"]');
await E.page.waitForFunction(() => document.querySelector('#ansicht').innerText.includes('Tobi (du)'));
const bzE = await bzServer(E);
const anfragenE = mitschreiben(E);
await mitLink(E);
await warte(() => bzE.anfragen.length >= 1);
await E.zeigeTag(DI);
await E.page.locator(`#tag-${DI} .karte`, { hasText: 'Theater früh' }).locator('[data-bock]').first().click();
await E.aktion('abgleichen');
await E.abgeglichen().catch(() => {});
await E.aktion('geraet');
const geraetLink = await E.page.locator('#geraetlink').inputValue();
await E.reiter('wir');
if (!(await E.page.locator('#einladungslink').count())) await E.page.click('[data-aktion="einladen"]').catch(() => {});
const einladung = await E.page.locator('#einladungslink').inputValue().catch(() => '');
await E.zeigeTag(DI);
const theater = E.page.locator(`#tag-${DI} .karte`, { hasText: 'Theater früh' });
const whatsapp = await theater.locator('a', { hasText: 'WhatsApp' }).getAttribute('href').catch(() => '');
const fremd = anfragenE.filter((r) => !r.url.includes('/rpc/bildschirmzeit_'));
check(fremd.some((r) => r.url.includes('/rpc/freizeit_')) && !fremd.some((r) => r.url.includes(KENNUNG) || r.daten.includes(KENNUNG))
  && !JSON.stringify(E.server.aufrufe).includes(KENNUNG), `der gemeinsame Plan gleicht ab – ohne die Kennung (${fremd.filter((r) => r.url.includes('/rpc/freizeit_')).length} Anfragen)`);
check(geraetLink.includes('#geraet=') && !geraetLink.includes(KENNUNG) && !geraetLink.includes('bildschirmzeit'), '„Weiteres Gerät“ nimmt sie nicht mit');
check(einladung.includes('#einladung=') && !einladung.includes(KENNUNG), 'die Einladung nicht');
check(Boolean(whatsapp) && !decodeURIComponent(whatsapp).includes(KENNUNG) && !decodeURIComponent(whatsapp).includes('bildschirmzeit'), 'die WhatsApp-Nachricht einer Karte nicht');
check(!(await E.page.evaluate((k) => localStorage.getItem(k), SCHLUESSEL)).includes(KENNUNG), 'und der Stand der App (freizeit.stand.v1) auch nicht');
await E.ende();
