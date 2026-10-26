/*
 * Ohne Netz – und alles, was dafür im Vorrat liegen muss.
 *
 * Erst ohne Browser: Jede Datei der App steht in SHELL (sw.js), jeden Eintrag
 * dort gibt es, jeder Import zeigt auf eine vorhandene Datei, die Daten stehen
 * nicht darin, das Manifest passt. Dann im Browser, mit den echten Daten aus
 * daten/: einmal laden, Server aus, neu laden – die Woche ist noch da.
 *
 * Server aus statt setOffline(): Playwrights Offline-Schalter schneidet die
 * Anfragen des Service Workers nicht ab. Mit leerem Vorrat und „offline“ käme
 * die App trotzdem frisch vom Server, und die Prüfung wäre grün, egal was im
 * Vorrat liegt. Deshalb startet dieser Test seinen eigenen Server und hält
 * ihn an.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { uhrStellen, ROOT } from './hilfe.mjs';
import { starte } from './server.mjs';

const sw = readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const shell = [...sw.match(/const SHELL = \[(.*?)\];/s)[1].matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]);
const version = sw.match(/const VERSION = '([^']+)'/)[1];
// Der Tag kommt aus den echten Daten, damit der Test jede Woche passt.
const { von: TAG } = JSON.parse(readFileSync(path.join(ROOT, 'daten', 'woche.json'), 'utf8'));

const PORT = 8113;
const BASIS = `http://127.0.0.1:${PORT}`;
const server = await starte(PORT, 0);
const aus = () => new Promise((fertig) => { server.closeAllConnections(); server.close(() => fertig()); });

let fails = 0;
let oks = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (c) oks++; else { fails++; process.exitCode = 1; } };

// --- Ohne Browser
const module = readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js'));
const fehlt = module.filter((f) => !shell.includes(`js/${f}`));
check(!fehlt.length, `jedes Modul unter js/ steht in SHELL${fehlt.length ? ` – es fehlen: ${fehlt.join(', ')}` : ''}`);
const tot = shell.filter((f) => f && !existsSync(path.join(ROOT, f)));
check(!tot.length, `jeden Eintrag in SHELL gibt es als Datei${tot.length ? ` – nicht da: ${tot.join(', ')}` : ''}`);
check(!shell.some((f) => f.startsWith('daten/')), 'die Daten stehen nicht in SHELL – ein Datenlauf muss sw.js nicht anfassen');
const kaputt = [];
module.forEach((f) => {
  const src = readFileSync(path.join(ROOT, 'js', f), 'utf8');
  [...src.matchAll(/^\s*import\s+(?:[^;]+?\s+from\s+)?'\.\/([\w.-]+)';/gm)].forEach((m) => {
    if (!module.includes(m[1])) kaputt.push(`${f} → ${m[1]}`);
  });
});
check(!kaputt.length, `jeder Import zeigt auf eine vorhandene Datei${kaputt.length ? `: ${kaputt.join(', ')}` : ''}`);
const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const verweise = [...html.matchAll(/(?:href|src)="(?!https?:|#|data:)([^"]+)"/g)].map((m) => m[1].replace(/^\.\//, ''));
const ohneVorrat = verweise.filter((v) => !shell.includes(v));
check(verweise.length >= 4 && !ohneVorrat.length, `alles, was index.html lädt, steht in SHELL${ohneVorrat.length ? ` – nicht: ${ohneVorrat.join(', ')}` : ''}`);
const aufraeumen = sw.match(/addEventListener\('activate'[\s\S]*?\n\}\);/)[0];
check(/startsWith\('freizeit-'\)/.test(aufraeumen), 'der Worker löscht beim Aktualisieren nur Vorräte, die mit „freizeit-“ beginnen (im selben Ursprung liegt die Workout-App)');
const manifest = JSON.parse(readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
check(manifest.icons.every((i) => existsSync(path.join(ROOT, i.src))), 'jedes Symbol aus dem Manifest gibt es');
check(manifest.lang === 'de' && manifest.start_url === '.' && manifest.scope === '.', 'Manifest: deutsch, startet und bleibt im eigenen Ordner');
// Die Kennung entscheidet, ob Android sie als eigene App führt – nicht unter
// /Workout/, dort hat sie bis v1 gelegen und galt als Teil der Workout-App.
check(manifest.id === '/Freizeit/', `Manifest: eigene Kennung /Freizeit/ (${manifest.id})`);
check(manifest.icons.some((i) => i.purpose === 'maskable') && manifest.icons.some((i) => i.sizes === '512x512'), 'Manifest: Symbol in 512 px, auch als „maskable“');

// --- Im Browser
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
await ctx.addInitScript(uhrStellen);
const page = await ctx.newPage();
const fehler = [];
page.on('pageerror', (e) => fehler.push(e.message));

await page.goto(`${BASIS}/index.html`, { waitUntil: 'networkidle' });
await page.evaluate((tag) => { localStorage.setItem('__testtag', tag); localStorage.setItem('__testzeit', '10:00'); }, TAG);
const bereich = await page.evaluate(async () => {
  for (let i = 0; i < 100; i++) {
    const r = await navigator.serviceWorker.getRegistration();
    if (r && r.active && r.active.state === 'activated') return r.scope;
    await new Promise((f) => { setTimeout(f, 100); });
  }
  return null;
});
check(bereich === `${BASIS}/`, `der Worker ist aktiv und gilt für den Ordner der App (${bereich})`);
await page.reload({ waitUntil: 'networkidle' });
const steuert = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL || '');
check(steuert === `${BASIS}/sw.js`, `nach dem Neuladen steuert der Worker die Seite (${steuert})`);
await page.waitForFunction(() => document.querySelectorAll('#ansicht .karte').length > 0);
const karten = await page.locator('#ansicht .karte').count();
const tage = await page.locator('#ansicht .tag').count();
check(karten > 0 && tage > 0, `mit Netz: die Woche ist da (${tage} Tage, ${karten} Karten)`);
// Merken, solange das Netz noch da ist.
await page.locator('#ansicht .karte [data-merken]').first().click();

const vorrat = await page.evaluate(async (v) => {
  const namen = async () => (await (await caches.open(`freizeit-${v}`)).keys()).map((r) => new URL(r.url).pathname);
  for (let i = 0; i < 50; i++) {
    const keys = await namen();
    if (keys.includes('/daten/woche.json') && keys.includes('/daten/konzerte.json')) return keys;
    await new Promise((f) => { setTimeout(f, 100); });
  }
  return namen();
}, version);
check(vorrat.filter((k) => !k.startsWith('/daten/')).length >= shell.length - 1, `im Vorrat liegt die App (${vorrat.length} Dateien, SHELL hat ${shell.length})`);
check(vorrat.includes('/daten/woche.json') && vorrat.includes('/daten/konzerte.json'), 'die zuletzt geladenen Daten liegen ebenfalls im Vorrat');

// Server aus – jetzt kommt alles aus dem Vorrat oder gar nicht.
await aus();
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => !document.querySelector('#ansicht').textContent.includes('Lädt'), null, { timeout: 5000 }).catch(() => {});
check(await page.title() === 'Freizeit', 'ohne Server öffnet die App');
check(await page.locator('#ansicht .karte').count() === karten, 'ohne Server: dieselbe Woche wie eben');
check(!(await page.locator('#ansicht').innerText()).includes('Keine Wochendaten') && await page.locator('.datenfehler').count() === 0, 'ohne Server: keine Fehlermeldung zu den Daten');
await page.click('[data-reiter="merkliste"]');
check(await page.locator('#ansicht .karte').count() === 1, 'ohne Server: die Merkliste mit dem gemerkten Eintrag');
await page.click('[data-reiter="konzerte"]');
check(await page.locator('#ansicht h2, #ansicht .leer').count() > 0, 'ohne Server: auch der Reiter Konzerte zeichnet');

check(fehler.length === 0, `keine Fehler in der Seite${fehler.length ? `: ${fehler.slice(0, 2).join(' | ')}` : ''}`);
await browser.close();
process.exit(fails || !oks ? 1 : 0);
