/*
 * Die Reiter unten (Einstellungen → „Reiter unten“): Programm, Karte, Ideen
 * und Wir einzeln an oder aus, Einstellungen immer da – der letzte, der an
 * ist, bleibt an. Die Wahl übersteht das Neuladen; ein Stand von vorher
 * zeigt alle. Die App öffnet mit dem ersten Reiter, der an ist.
 * Ausgeblendete Reiter bleiben über Links erreichbar (#programm, eine
 * Einladung, „Zu „Wir““) – unten ist dann keiner markiert. Der Punkt für neue
 * Haken gehört nur zu „Wir“. Mit fünf Reitern stehen alle Beschriftungen bei
 * 360 und 390 px ganz da, ohne Querscrollen.
 */
import {
  oeffne, fakeServer, MO, DI, MI, APP_URL, SCHLUESSEL,
} from './hilfe.mjs';

const server = fakeServer();
const A = await oeffne({ tag: MO, zeit: '10:00', server });
const { page, check, gespeichert } = A;
const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** Die Reiter, die unten zu sehen sind – in ihrer Reihenfolge. */
const sichtbar = (p = page) => p.$$eval('.reiterleiste .reiter', (bs) => bs.filter((b) => b.offsetWidth > 0).map((b) => b.dataset.reiter));
const markiert = (p = page) => p.$$eval('.reiterleiste [aria-current]', (bs) => bs.map((b) => b.dataset.reiter));
const anzahl = (p = page) => p.locator('.reiterleiste').getAttribute('data-anzahl');
const schalter = (r) => page.locator(`#e-reiter [data-aktion="reiter-an"][data-wert="${r}"]`);
const bereit = (p = page) => p.waitForFunction(() => !document.querySelector('#ansicht').textContent.includes('Lädt'));
/** Ist irgendwo in der Leiste ein Punkt zu sehen – oder steht er bloß versteckt im ausgeblendeten „Wir“ auf an? */
const punktZuSehen = () => page.$$eval('.reiterleiste .punkt', (ps) => ps.some((p) => !p.hidden));

// --- Vorgabe: alle fünf
check(gleich(await sichtbar(), ['programm', 'karte', 'ideen', 'wir', 'einstellungen']) && await anzahl() === '5',
  'ohne Wahl: alle fünf Reiter, Einstellungen ganz rechts');
await A.einstellungen();
check(gleich(await page.$$eval('#e-reiter [role="switch"]', (bs) => bs.map((b) => `${b.dataset.wert}:${b.getAttribute('aria-checked')}`)),
  ['programm:true', 'karte:true', 'ideen:true', 'wir:true']) && (await page.locator('#e-reiter').innerText()).includes('immer da')
  && await page.locator('#e-reiter [data-wert="einstellungen"]').count() === 0,
'„Reiter unten“: vier Schalter, alle an – „Einstellungen“ steht dabei, „immer da“, ohne Schalter');
check(await page.locator('#e-reiter [aria-disabled]').count() === 0, 'solange mehrere an sind, lässt sich jeder abschalten');

// --- Aus und wieder an
await schalter('karte').click();
check(await schalter('karte').getAttribute('aria-checked') === 'false' && gleich(await sichtbar(), ['programm', 'ideen', 'wir', 'einstellungen']) && await anzahl() === '4',
  'Karte aus: der Schalter steht auf aus, unten nur noch vier Reiter');
check(gleich((await gespeichert()).reiterAus, ['karte']), '… und so gespeichert');
check(await page.evaluate(() => document.activeElement && document.activeElement.dataset.wert) === 'karte', 'der Fokus bleibt auf dem Schalter');
await page.keyboard.press('Space');
check(await schalter('karte').getAttribute('aria-checked') === 'true' && (await sichtbar()).includes('karte') && gleich((await gespeichert()).reiterAus, []),
  'mit der Leertaste wieder an – die Karte ist zurück');

// --- Der letzte bleibt
for (const r of ['ideen', 'wir', 'karte']) await schalter(r).click();
check(gleich(await sichtbar(), ['programm', 'einstellungen']) && await anzahl() === '2', 'nur noch Programm an: unten Programm und Einstellungen');
const programm = schalter('programm');
check(await programm.getAttribute('aria-disabled') === 'true' && (await programm.innerText()).includes('Einer bleibt immer an'),
  'Programm lässt sich jetzt nicht abschalten – mit kurzem Hinweis');
// aria-disabled statt disabled: Er bleibt fokussierbar (der Hinweis ist hörbar) – antippen geht, bewirkt aber nichts.
// Playwright tippt so etwas nur mit force an.
await programm.click({ force: true });
check(await programm.getAttribute('aria-checked') === 'true' && gleich((await gespeichert()).reiterAus, ['karte', 'ideen', 'wir']), 'ein Tipp darauf ändert nichts');
await programm.focus();
await page.keyboard.press('Space');
check(await programm.getAttribute('aria-checked') === 'true' && await page.evaluate(() => document.activeElement && document.activeElement.dataset.wert) === 'programm',
  'mit der Tastatur erreichbar, die Leertaste ändert auch nichts');
const breiten = await page.$$eval('.reiterleiste .reiter:not([hidden])', (bs) => bs.map((b) => Math.round(b.getBoundingClientRect().width)));
check(gleich(breiten, [195, 195]), `zwei Reiter teilen sich die Leiste gleichmäßig (${breiten.join(', ')} px)`);

// --- Neuladen behält die Wahl
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('#e-reiter');
check(gleich(await sichtbar(), ['programm', 'einstellungen']) && await schalter('wir').getAttribute('aria-checked') === 'false' && gleich(await markiert(), ['einstellungen']),
  'nach dem Neuladen: dieselbe Wahl, noch in den Einstellungen');

// --- Start-Reiter: der erste, der an ist
await schalter('ideen').click();
await schalter('programm').click();
check(await schalter('ideen').getAttribute('aria-disabled') === 'true' && await schalter('programm').getAttribute('aria-disabled') === null,
  'Programm aus, nur Ideen an: jetzt bleibt Ideen');
await schalter('karte').click();
const drei = await page.$$eval('.reiterleiste .reiter:not([hidden])', (bs) => bs.map((b) => Math.round(b.getBoundingClientRect().width)));
check(gleich(await sichtbar(), ['karte', 'ideen', 'einstellungen']) && gleich(drei, [130, 130, 130]), `Karte, Ideen, Einstellungen – gleich breit (${drei.join(', ')} px)`);
await page.goto('about:blank');
await page.goto(APP_URL, { waitUntil: 'networkidle' });
await bereit();
check(gleich(await markiert(), ['karte']) && await page.locator('#karte-kopf').count() === 1, 'ohne Adresse öffnet die App mit dem ersten Reiter, der an ist: der Karte');
await A.reiter('ideen');
await A.reiter('karte');
check(!page.url().includes('#'), 'der Start-Reiter braucht keine #-Adresse');

// --- Ausgeblendetes bleibt über Links erreichbar
await page.goto(`${APP_URL}#programm`);
await page.waitForSelector('#ansicht .ansicht-wahl');
check(gleich(await markiert(), []) && !(await sichtbar()).includes('programm') && page.url().endsWith('#programm'),
  '#programm öffnet das ausgeblendete Programm – unten ist dann keiner markiert');
await page.reload({ waitUntil: 'networkidle' });
await bereit();
check(await page.locator('#ansicht .ansicht-wahl').count() === 1 && gleich(await markiert(), []), '… auch nach dem Neuladen');
await A.einstellungen();
await page.click('#e-plan [data-reiter="wir"]');
check(await page.locator('#wir-name').count() === 1 && gleich(await markiert(), []) && !(await sichtbar()).includes('wir'),
  '„Zu „Wir““ in den Einstellungen führt ins ausgeblendete „Wir“ – keiner markiert');

// --- Gemeinsamer Plan: eine Einladung, der Punkt
await A.einstellungen();
for (const r of ['programm', 'wir']) await schalter(r).click();
check(gleich((await gespeichert()).reiterAus, []), 'wieder alle an');
await A.reiter('wir');
await page.fill('#wir-name', 'Tobi');
await page.click('[data-aktion="starten"]');
await page.waitForFunction(() => document.querySelector('#ansicht').innerText.includes('Tobi (du)'));
const code = (await gespeichert()).gemeinsam.code;

// Kim hat „Wir“ ausgeblendet und tippt auf den Einladungslink.
const B = await oeffne({
  tag: MO, server, browser: A.browser, hash: `einladung=${code}`, stand: { version: 2, reiterAus: ['wir'] },
});
check(await B.page.locator('[data-aktion="beitreten"]').count() === 1 && gleich(await markiert(B.page), []) && B.page.url().endsWith('#wir')
  && !(await sichtbar(B.page)).includes('wir'), 'Einladungslink bei ausgeblendetem „Wir“: Kim landet dort, unten ist keiner markiert');
await B.page.fill('#wir-name', 'Kim');
await B.page.click('[data-aktion="beitreten"]');
await B.page.waitForFunction(() => document.querySelector('#ansicht').innerText.includes('Kim (du)'));
check(gleich(await markiert(B.page), []), 'nach dem Beitreten: immer noch „Wir“, keiner markiert');
await B.reiter('programm');
await B.page.locator(`#tag-${DI} .karte`, { hasText: 'Theater früh' }).locator('[data-mitwem="gastgeber"]').click();
await B.abgeglichen();

// Tobi bekommt den Punkt an „Wir“ …
await A.reiter('programm');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !document.querySelector('#wir-neu').hidden, null, { timeout: 6000 }).catch(() => {});
check(!(await page.locator('#wir-neu').isHidden()), 'Gegenprobe: mit „Wir“ in der Leiste zeigt der Punkt Kims neuen Haken');
// … blendet „Wir“ aus: kein Punkt, auch nicht an den Einstellungen.
await A.einstellungen();
await schalter('wir').click();
check(await page.locator('#wir-neu').isHidden() && !(await punktZuSehen()), '„Wir“ aus: kein Punkt – auch nicht am Reiter Einstellungen');
const vorher = (await gespeichert()).gemeinsam.stand.bock.length;
await B.page.locator(`#tag-${MI} .karte`, { hasText: 'Nachtmarkt' }).locator('[data-mitwem="andere"]').click();
await B.abgeglichen();
await page.click('#e-plan [data-aktion="abgleichen"]');
await page.waitForFunction(({ key, n }) => JSON.parse(localStorage.getItem(key)).gemeinsam.stand.bock.length > n, { key: SCHLUESSEL, n: vorher }, { timeout: 6000 });
check(await page.locator('#wir-neu').isHidden() && !(await punktZuSehen()), 'noch ein neuer Haken: weiter kein Punkt');
await schalter('wir').click();
check(!(await page.locator('#wir-neu').isHidden()), '„Wir“ wieder an: der Punkt ist zurück – gesehen hat Tobi die Haken ja noch nicht');
check(B.fehler.length === 0, `Kim: keine Fehler in der Konsole${B.fehler.length ? `: ${B.fehler.slice(0, 2).join(' | ')}` : ''}`);

// --- Fünf Reiter bei 360 und 390 px: alles lesbar, nichts quer
for (const [breite, groesse] of [[360, '10.5px'], [390, '11px']]) {
  const X = await oeffne({ tag: MO, viewport: { width: breite, height: 780 }, browser: A.browser, hash: 'einstellungen' });
  for (const aktiv of ['einstellungen', 'programm']) {
    if (aktiv === 'programm') await X.reiter('programm');
    const m = await X.page.evaluate(() => ({
      quer: document.documentElement.scrollWidth - window.innerWidth,
      reiter: [...document.querySelectorAll('.reiterleiste .reiter:not([hidden])')].map((b) => {
        const beschriftung = [...b.querySelectorAll('span')].find((s) => !s.classList.contains('punkt'));
        const r = document.createRange();
        r.selectNodeContents(beschriftung);
        const t = r.getBoundingClientRect();
        const k = b.getBoundingClientRect();
        const s = window.getComputedStyle(b);
        return {
          name: b.dataset.reiter, passt: t.left >= k.left - 0.5 && t.right <= k.right + 0.5 && t.height < 20, groesse: s.fontSize, fett: s.fontWeight === '700',
        };
      }),
    }));
    const zuBreit = m.reiter.filter((r) => !r.passt).map((r) => r.name);
    check(m.reiter.length === 5 && !zuBreit.length && m.quer <= 0 && m.reiter.every((r) => r.groesse === groesse) && m.reiter.find((r) => r.fett).name === aktiv,
      `${breite} px, ${aktiv} aktiv (fett): fünf Beschriftungen in ${groesse} ganz im Reiter, kein Querscrollen${zuBreit.length ? ` – zu breit: ${zuBreit.join(', ')}` : ''}`);
  }
  if (breite === 360) {
    // Mit vier Reitern bleibt die Schrift, wie sie war.
    await X.einstellungen();
    await X.page.click('#e-reiter [data-wert="ideen"]');
    check(await X.page.locator('.reiterleiste .reiter:not([hidden])').first().evaluate((b) => window.getComputedStyle(b).fontSize) === '12px', '360 px mit vier Reitern: Schrift 12 px wie bisher');
  }
  check(X.fehler.length === 0, `${breite} px: keine Fehler in der Konsole${X.fehler.length ? `: ${X.fehler.slice(0, 2).join(' | ')}` : ''}`);
  await X.ctx.close();
}

// --- Stände von vorher und Kaputtes
const Y = await oeffne({ tag: MO, browser: A.browser });
for (const [stand, erwartet, was] of [
  [{ version: 2, programmAnsicht: 'liste' }, 5, 'ein Stand von vorher (ohne reiterAus): alle fünf'],
  [{ version: 2, reiterAus: ['karte', 'karte', 'gibtsnicht', 'einstellungen'] }, 4, 'Doppeltes und Unbekanntes fällt weg – Einstellungen lässt sich nicht ausblenden'],
  [{ version: 2, reiterAus: ['programm', 'karte', 'ideen', 'wir'] }, 5, 'alle vier aus geht nicht – dann sind alle an'],
  [{ version: 2, reiterAus: 'karte' }, 5, 'Text statt Liste: alle an'],
]) {
  await Y.page.evaluate(({ key, s }) => localStorage.setItem(key, JSON.stringify(s)), { key: SCHLUESSEL, s: stand });
  await Y.page.goto('about:blank');
  await Y.page.goto(APP_URL, { waitUntil: 'networkidle' });
  await bereit(Y.page);
  const n = (await sichtbar(Y.page)).length;
  check(n === erwartet && (await sichtbar(Y.page)).includes('einstellungen') && (await markiert(Y.page)).length === 1, `${was} (${n} Reiter)`);
}
check(Y.fehler.length === 0, `alte Stände: keine Fehler in der Konsole${Y.fehler.length ? `: ${Y.fehler.slice(0, 2).join(' | ')}` : ''}`);

await A.ende();
