/*
 * Reiter „Wir“: der gemeinsame Plan zu zweit (und mit einem zweiten Gerät).
 *
 * Zwei Browser teilen einen nachgebauten Server (hilfe.mjs → fakeServer,
 * verhält sich wie supabase/gemeinsam.sql). Tobi startet den Plan und
 * schickt den Link, Kim öffnet ihn auf dem iPhone, beide haken an, einer ist
 * kurz offline, Tobi kommt mit einem zweiten Gerät dazu, Kim verlässt den Plan.
 */
import { oeffne, fakeServer, IPHONE, MO, DI } from './hilfe.mjs';

const server = fakeServer();
const A = await oeffne({ tag: MO, server });
const { check } = A;
const raumVon = () => [...server.raeume.values()][0];
const warte = (page, text, ms = 6000) => page.waitForFunction((t) => document.querySelector('#ansicht').innerText.includes(t), text, { timeout: ms })
  .then(() => true).catch(() => false);

// --- Tobi startet den Plan
await A.reiter('wir');
check((await A.page.locator('.einrichten h3').first().innerText()) === 'Gemeinsam planen', 'ohne Plan: zuerst „Gemeinsam planen“ (kein iPhone)');
await A.page.click('[data-aktion="starten"]');
check((await A.page.locator('.fehlerbox').innerText()).includes('Namen'), 'ohne Namen geht es nicht');
await A.page.fill('#wir-name', 'Tobi');
await A.page.click('[data-aktion="starten"]');
await warte(A.page, 'Tobi (du)');
check(server.raeume.size === 1 && raumVon().personen.length === 1, 'der Server hat einen Raum mit einer Person');
check((await A.page.locator('.banner').innerText()).includes('allein'), 'allein im Plan: ein Hinweis zum Einladen');
const link = await A.page.locator('#einladungslink').inputValue();
const code = link.split('#einladung=')[1];
check(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/.test(code) && !/[lo01]/.test(code), `der Einladungslink trägt einen Code ohne Verwechsler (${code})`);
check(server.raeume.has(code), 'derselbe Code wie beim Server');
const wa = decodeURIComponent((await A.page.locator('.einladung a', { hasText: 'WhatsApp' }).getAttribute('href')).split('text=')[1]);
check(wa.includes(link) && wa.includes(code) && wa.includes('Zum Home-Bildschirm'), 'die WhatsApp-Nachricht hat Link, Code und den Weg fürs iPhone');

// Tobi hakt im Programm an.
await A.reiter('programm');
await A.page.locator(`#tag-${DI} .karte`, { hasText: 'Theater früh' }).locator('[data-bock]').click();
await A.abgeglichen();
await A.page.waitForFunction(() => !JSON.parse(localStorage.getItem('freizeit.stand.v1')).warteschlange.length);
check([...raumVon().bock.values()].some((b) => b.eintrag.startsWith('t:theater-frueh:') && b.daten.titel === 'Theater früh'), 'der Haken ist mit Schnappschuss beim Server');

// --- Kim öffnet den Link auf dem iPhone (im Browser, noch nicht als App)
const B = await oeffne({ tag: MO, server, ua: IPHONE, hash: `einladung=${code}`, browser: A.browser });
check(await B.page.locator('[data-reiter="wir"]').getAttribute('aria-current') === 'page', 'der Link öffnet direkt „Wir“');
check(!B.page.url().includes(code), 'der Code verschwindet aus der Adresszeile');
check((await B.page.locator('.einrichten h3').innerText()) === 'Du bist eingeladen', 'Kim sieht die Einladung');
check((await B.page.locator('.schritte').innerText()).includes('Zum Home-Bildschirm') && (await B.page.locator('.schritte code').innerText()) === code,
  'auf dem iPhone im Browser: der Weg zum Home-Bildschirm und der Code');
await B.page.fill('#wir-name', 'Kim');
await B.page.click('[data-aktion="beitreten"]');
await warte(B.page, 'Kim (du)');
check(raumVon().personen.map((p) => p.name).join(',') === 'Tobi,Kim', 'jetzt sind beide im Raum');
check((await B.page.locator('.leute').innerText()).includes('Tobi'), 'Kim sieht Tobi');
const tobiKarte = B.page.locator('.karte', { hasText: 'Theater früh' });
check((await tobiKarte.locator('.wer').innerText()).includes('Tobi') && (await tobiKarte.locator('.wer').innerText()).includes('hat Bock'), 'Kim sieht Tobis Haken in „Wir“');
await B.reiter('programm');
check((await B.page.locator(`#tag-${DI} .karte`, { hasText: 'Theater früh' }).locator('.wer').innerText()).includes('Tobi'), '… und im Programm an der Karte');
check(await B.page.locator('.hinweis-install').count() === 1, 'im Safari-Browser: Hinweis, wie die App auf den Home-Bildschirm kommt');

// Kim hakt dasselbe an → Treffer.
await B.page.locator(`#tag-${DI} .karte`, { hasText: 'Theater früh' }).locator('[data-bock]').click();
await B.page.waitForFunction(() => !JSON.parse(localStorage.getItem('freizeit.stand.v1')).warteschlange.length);
await B.reiter('wir');
check((await B.page.locator('.abschnitt-titel', { hasText: 'Ihr habt beide Bock' }).count()) === 1, 'Kim: „Ihr habt beide Bock“');
check(await B.page.locator('.karte.treffer', { hasText: 'Theater früh' }).count() >= 1, 'die Karte ist als Treffer markiert');

// Tobi gleicht ab – auch ein Name mit HTML darf nichts anrichten.
raumVon().personen.push({ id: 'pzzzzzzzzzzzzzz', name: '<img src=x onerror=alert(1)>' });
raumVon().bock.set('pzzzzzzzzzzzzzz|t:sonder:2026-11-20', {
  person: 'pzzzzzzzzzzzzzz', eintrag: 't:sonder:2026-11-20', geaendert: new Date().toISOString(),
  daten: { titel: 'Sonderkonzert', datum: '2026-11-20', zeit: '20:00', ort: 'Knust', link: 'javascript:alert(2)' },
});
await A.reiter('programm');
await A.page.reload({ waitUntil: 'networkidle' });
await A.page.waitForFunction(() => !document.querySelector('#wir-neu').hidden, null, { timeout: 6000 }).catch(() => {});
check(!(await A.page.locator('#wir-neu').isHidden()), 'Tobi: ein Punkt an „Wir“ zeigt neue Haken der anderen');
await A.reiter('wir');
check(await A.page.locator('#wir-neu').isHidden(), 'nach dem Öffnen ist der Punkt weg');
check((await A.page.locator('.abschnitt-titel', { hasText: 'Ihr habt beide Bock' }).count()) === 1, 'Tobi sieht den Treffer auch');
check(await A.page.locator('.leute img').count() === 0 && (await A.page.locator('.leute').innerText()).includes('<img src=x'), 'ein Name mit HTML steht als Text da');
const sonder = A.page.locator('.karte', { hasText: 'Sonderkonzert' });
check(await sonder.count() === 1, 'ein Haken auf etwas, das nicht in den Daten steht, kommt aus dem Schnappschuss');
check(await sonder.locator('a.quelle').count() === 0, '… ein javascript:-Link daraus wird kein Link');

// --- Kim ist offline
server.offline = true;
await B.reiter('programm');
await B.page.locator(`#tag-${DI} .karte`, { hasText: 'Workshop mittags' }).locator('[data-bock]').click();
await B.page.waitForTimeout(1500);
await B.reiter('wir');
check((await B.page.locator('.syncstatus').innerText()).includes('1 Änderung wartet'), 'offline: der Haken wartet');
check(await B.page.locator('.karte', { hasText: 'Workshop mittags' }).count() === 1, 'offline: er steht trotzdem schon in der Liste');
server.offline = false;
await B.page.click('[data-aktion="abgleichen"]');
await B.page.waitForFunction(() => !JSON.parse(localStorage.getItem('freizeit.stand.v1')).warteschlange.length, null, { timeout: 6000 });
check([...raumVon().bock.values()].some((b) => b.eintrag.startsWith('t:workshop-mittags:')), 'wieder online: der Haken ist beim Server');

// --- Tobi mit einem zweiten Gerät: derselbe Name ist dieselbe Person
const C = await oeffne({ tag: MO, server, browser: A.browser });
await C.reiter('wir');
await C.page.fill('#wir-code', code.toUpperCase().replaceAll('-', ' '));
await C.page.fill('#wir-name-code', 'tobi');
await C.page.click('[data-aktion="beitreten-code"]');
await warte(C.page, '(du)');
check(raumVon().personen.length === 3, 'kein dritter Tobi im Raum – der Name gehört schon jemandem');
check((await C.gespeichert()).bock && Object.keys((await C.gespeichert()).bock).some((k) => k.startsWith('t:theater-frueh:')),
  'das zweite Gerät kennt Tobis Haken vom Server');

// --- falscher Code
const D = await oeffne({ tag: MO, server, browser: A.browser });
await D.reiter('wir');
await D.page.fill('#wir-code', 'aaaa-bbbb-cccc');
await D.page.fill('#wir-name-code', 'Jemand');
await D.page.click('[data-aktion="beitreten-code"]');
await warte(D.page, 'keinen gemeinsamen Plan');
check((await D.page.locator('.fehlerbox').innerText()).includes('keinen gemeinsamen Plan'), 'ein falscher Code legt keinen neuen Raum an, sondern sagt Bescheid');
check(server.raeume.size === 1, 'beim Server bleibt es bei einem Raum');

// --- Kim verlässt den Plan
await B.page.click('[data-aktion="verlassen"]');
await B.page.click('[data-aktion="verlassen-ja"]');
await warte(B.page, 'Gemeinsam planen');
check(!raumVon().personen.some((p) => p.name === 'Kim') && ![...raumVon().bock.values()].some((b) => b.eintrag.startsWith('t:workshop-mittags:')),
  'beim Server sind Kim und ihre Haken weg');
check(await B.page.locator('.karte', { hasText: 'Workshop mittags' }).count() === 1, 'auf Kims Gerät bleiben ihre Haken (Deine Bock-Liste)');

for (const [wer, x] of [['Kim', B], ['zweites Gerät', C], ['falscher Code', D]]) {
  check(x.fehler.length === 0, `${wer}: keine Fehler in der Konsole${x.fehler.length ? `: ${x.fehler.slice(0, 2).join(' | ')}` : ''}`);
}
await A.ende();
