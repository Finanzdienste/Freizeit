/*
 * Die Einstellungen (der Reiter ganz rechts, #einstellungen): immer unten in
 * der Leiste, kein ⚙ im Kopf, kein „‹ Zurück“. Ohne Plan: Reiter unten,
 * Standort, der Weg zu „Wir“, App. Als Gastgeber dazu Mitteilungen und alles
 * zum Plan – Abgleich, Name, weiteres Gerät, „So geht's“, Auflösen.
 * Installieren, der Stand der Daten und die Hinweise zu den Daten stehen
 * unter „App“. Das Ein- und Ausblenden der Reiter prüft test-reiter.mjs.
 */
import { oeffne, fakeServer, testProgramm, MO } from './hilfe.mjs';

const server = fakeServer();
// Ein kaputter Termin, damit es einen Hinweis zu den Daten gibt.
const programm = testProgramm({ termine: [...testProgramm().termine, { id: 'kaputt', titel: 'Ohne Tage' }] });
const A = await oeffne({ tag: MO, zeit: '10:00', server, programm });
const { page, check } = A;
const einstellungenReiter = page.locator('.reiterleiste [data-reiter="einstellungen"]');
const titel = () => page.$$eval('#ansicht .einstellung-titel', (hs) => hs.map((h) => h.textContent));
const markiert = () => page.$$eval('.reiterleiste [aria-current]', (bs) => bs.map((b) => b.dataset.reiter));

// --- Wo die Einstellungen sind
check(await page.locator('.kopf button, .kopf [data-aktion]').count() === 0, 'im Kopf steht nur noch die Marke – kein ⚙');
check(JSON.stringify(await page.$$eval('.reiterleiste .reiter', (bs) => bs.map((b) => b.textContent.trim())))
  === JSON.stringify(['Programm', 'Karte', 'Ideen', 'Wir', 'Einstellungen']), 'unten fünf Reiter, „Einstellungen“ ganz rechts');
check(await page.locator('#ansicht .datenfehler').count() === 0, 'Hinweise zu den Daten stehen nicht mehr im Programm');
await A.reiter('karte');
await einstellungenReiter.click();
await page.waitForSelector('#ansicht .seiten-titel');
check(page.url().endsWith('#einstellungen') && (await page.locator('.seiten-titel').innerText()) === 'Einstellungen', 'ein Tipp auf den Reiter: die Seite „Einstellungen“, Adresse #einstellungen');
check(JSON.stringify(await markiert()) === '["einstellungen"]', 'unten ist „Einstellungen“ markiert – und nur er');
check(await page.locator('#ansicht [data-aktion="zurueck"]').count() === 0, 'kein „‹ Zurück“ mehr');
check(JSON.stringify(await titel()) === JSON.stringify(['Reiter unten', 'Mein Standort', 'Gemeinsamer Plan', 'App']),
  'ohne Plan: Reiter unten (zuerst), Mein Standort, Gemeinsamer Plan, App – keine Mitteilungen');
check((await page.locator('#stand').innerText()).includes('Mo 2.11., 07:01 Uhr') && (await page.locator('#stand').innerText()).includes('bis So 15.11.')
  && (await page.locator('#e-app').innerText()).includes('Ideen-Katalog') && (await page.locator('#e-app').innerText()).includes('Di 27.10.'),
'unter „App“: Stand des Programms (und bis wann es reicht) und des Ideen-Katalogs');
check((await page.locator('#e-app .install-weg').innerText()).includes('App installieren'), 'ohne Angebot des Browsers: der Weg übers Browser-Menü');
check((await page.locator('#e-app .datenfehler summary').innerText()) === 'Hinweise zu den Daten (1)', '… und die Hinweise zu den Daten');
await A.reiter('karte');
check(JSON.stringify(await markiert()) === '["karte"]' && !page.url().includes('#einstellungen'), 'zurück geht es über die Reiter – etwa auf die Karte');

// --- Direkt über die Adresse, auch nach dem Neuladen
await A.einstellungen();
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('#ansicht .seiten-titel');
check(JSON.stringify(await markiert()) === '["einstellungen"]', 'nach dem Neuladen sind es noch die Einstellungen');

// --- Installieren, wenn der Browser es anbietet
await A.einstellungen();
await page.evaluate(() => {
  const ev = new window.Event('beforeinstallprompt', { cancelable: true });
  ev.prompt = () => { window.__angeboten = true; };
  window.dispatchEvent(ev);
});
await page.waitForSelector('[data-aktion="installieren"]');
await page.click('[data-aktion="installieren"]');
check(await page.evaluate(() => window.__angeboten === true) && await page.locator('[data-aktion="installieren"]').count() === 0,
  'bietet der Browser es an: „Installieren“ – ein Tipp fragt den Browser, danach ist der Knopf weg');

// --- Ohne Plan: der Weg zu „Wir“
await page.click('#e-plan [data-reiter="wir"]');
check(await page.locator('.reiterleiste [data-reiter="wir"]').getAttribute('aria-current') === 'page', 'ohne Plan führt „Zu „Wir““ dorthin, wo man einen startet');

// --- Als Gastgeber
await page.fill('#wir-name', 'Tobi');
await page.click('[data-aktion="starten"]');
await page.waitForFunction(() => document.querySelector('#ansicht').innerText.includes('Tobi (du)'));
await A.einstellungen();
check(JSON.stringify(await titel()) === JSON.stringify(['Reiter unten', 'Mein Standort', 'Mitteilungen', 'Gemeinsamer Plan', 'App']), 'als Gastgeber: dazu „Mitteilungen“');
check(JSON.stringify(await page.$$eval('#e-plan .zeilen-knopf', (bs) => bs.map((b) => b.textContent))) === JSON.stringify(['Name ändern', 'Weiteres Gerät', "So geht's", 'Plan auflösen'])
  && (await page.locator('#e-plan .abgleich').innerText()).includes('Tobi · Gastgeber'), 'im Plan: Stand mit „Jetzt abgleichen“, Name, Gerät, So geht\'s, Auflösen – je einmal');
await page.click('[data-aktion="umbenennen"]');
check(await page.locator('#wir-neuname').inputValue() === 'Tobi' && await page.locator('[data-aktion="umbenennen"]').getAttribute('aria-expanded') === 'true',
  '„Name ändern“ klappt das Feld auf');
await page.fill('#wir-neuname', 'Toby');
await page.press('#wir-neuname', 'Enter');
await page.waitForFunction(() => !document.querySelector('#wir-neuname'), null, { timeout: 6000 });
check([...server.raeume.values()][0].personen[0].name === 'Toby' && (await page.locator('#e-plan .abgleich').innerText()).includes('Toby'),
  'Enter speichert den neuen Namen – beim Server und hier');
await page.click('[data-aktion="geraet"]');
check((await page.locator('#geraetlink').inputValue()).includes('#geraet=') && await page.evaluate(() => document.activeElement && document.activeElement.dataset.aktion) === 'geraet',
  '„Weiteres Gerät“ zeigt den Link – der Fokus bleibt auf der Zeile');
await page.click('[data-aktion="umbenennen"]');
check(await page.locator('#geraetlink').count() === 0 && await page.locator('#wir-neuname').count() === 1, 'es ist immer nur ein Feld offen');
await A.reiter('wir');
check((await page.locator('.leute').innerText()).includes('Toby (du)'), 'unter „Wir“ der neue Name');
await A.einstellungen();
check(await page.locator('#wir-neuname, #geraetlink, #hilfe-karte, .einstellung-feld').count() === 0, 'wer die Einstellungen verlässt, findet sie danach wieder zugeklappt');

// --- Eingeladen: keine Mitteilungen, „Plan verlassen“
const code = (await A.gespeichert()).gemeinsam.code;
const B = await oeffne({ tag: MO, server, hash: `einladung=${code}`, browser: A.browser });
await B.page.fill('#wir-name', 'Kim');
await B.page.click('[data-aktion="beitreten"]');
await B.page.waitForFunction(() => document.querySelector('#ansicht').innerText.includes('Kim (du)'));
await B.einstellungen();
check(JSON.stringify(await B.page.$$eval('#ansicht .einstellung-titel', (hs) => hs.map((h) => h.textContent))) === JSON.stringify(['Reiter unten', 'Mein Standort', 'Gemeinsamer Plan', 'App'])
  && (await B.page.locator('#e-plan .zeilen-knopf.warn-text').textContent()) === 'Plan verlassen', 'eingeladen: keine Mitteilungen, und „Plan verlassen“ statt „auflösen“');

check(B.fehler.length === 0, `Kim: keine Fehler in der Konsole${B.fehler.length ? `: ${B.fehler.slice(0, 2).join(' | ')}` : ''}`);
await A.ende();
