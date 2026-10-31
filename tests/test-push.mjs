/*
 * Push-Mitteilungen für den Gastgeber (js/push.js, in den Einstellungen unter „Mitteilungen“):
 * anschalten, was dann beim Server liegt und was der sammelt, ausschalten –
 * und was ohne Erlaubnis, auf dem iPhone im Browser oder in einem Browser
 * ohne Push passiert. Der Browser im Test hat keinen Push-Dienst; hilfe.mjs
 * baut ihn nach (oeffne({ push: 'granted' })). Was die Edge Function daraus
 * macht, prüft test-push-senden.mjs; das SQL test-sql.mjs.
 */
import { oeffne, fakeServer, IPHONE, DI, SA } from './hilfe.mjs';

const server = fakeServer();
const A = await oeffne({ tag: DI, push: 'granted', server });
const { check } = A;
const raum = () => [...server.raeume.values()][0];
const warte = (x, t) => x.page.waitForFunction((s) => document.querySelector('#ansicht').innerText.includes(s), t, { timeout: 6000 });
const leer = (x) => x.page.waitForFunction(() => !JSON.parse(localStorage.getItem('freizeit.stand.v1')).warteschlange.length, null, { timeout: 6000 });
const zeile = (x) => x.page.locator('.push-zeile');
const stand = (x) => zeile(x).getAttribute('data-push');
const protokoll = (x) => x.page.evaluate(() => window.__push);
const kurz = () => (raum().nachrichten || []).map((n) => `${n.art}:${n.name}${n.daten ? `:${n.daten.eintrag.split(':')[1]}:${n.daten.mitwem || '-'}` : ''}`);
const karteAm = (x, tag, titel) => x.page.locator(`#tag-${tag} .karte`, { hasText: titel });
const bytes = (b64url) => [...Buffer.from(b64url.replace(/-/g, '+').replace(/_/g, '/'), 'base64')];

// --- Tobi startet den Plan: die Zeile mit dem Knopf
await A.einstellungen();
check(await zeile(A).count() === 0 && await A.page.locator('#e-mitteilungen').count() === 0, 'ohne Plan keine Mitteilungen in den Einstellungen');
await A.reiter('wir');
await A.page.fill('#wir-name', 'Tobi');
await A.page.click('[data-aktion="starten"]');
await warte(A, 'Tobi (du)');
check(await zeile(A).count() === 0, 'unter „Wir“ steht keine Push-Zeile mehr');
await A.einstellungen();
check(await stand(A) === 'aus' && (await zeile(A).innerText()).includes('Bescheid sagen') && (await zeile(A).innerText()).includes('wenn jemand dazukommt oder anhakt'),
  'als Gastgeber: „🔔 Bescheid sagen“ – wenn jemand dazukommt oder anhakt');
const tobi = (await A.gespeichert()).gemeinsam;

// --- Kim tritt bei – noch ohne Abo sammelt der Server nichts
const B = await oeffne({ tag: DI, server, hash: `einladung=${tobi.code}`, browser: A.browser });
await B.page.fill('#wir-name', 'Kim');
await B.page.click('[data-aktion="beitreten"]');
await warte(B, 'Kim (du)');
await B.einstellungen();
check(await zeile(B).count() === 0 && await B.page.locator('#e-mitteilungen').count() === 0, 'Kim als Mitglied hat keine Mitteilungen in den Einstellungen');
check(!raum().nachrichten.length, 'ohne Abo im Raum sammelt der Server nichts');

// --- Anschalten
await A.page.click('[data-aktion="push-an"]');
await A.page.waitForFunction(() => document.querySelector('.push-zeile[data-push="an"]'));
check((await zeile(A).innerText()).includes('Du bekommst Bescheid, wenn jemand dazukommt oder anhakt') && await A.page.locator('[data-aktion="push-aus"]').count() === 1,
  'nach dem Tipp: „Du bekommst Bescheid …“ mit „Ausschalten“');
let p = await protokoll(A);
check(p.gefragt === 1 && p.abonniert === 1 && JSON.stringify(p.schluessel) === JSON.stringify(bytes(server.vapid)) && p.schluessel.length === 65,
  'der Browser wurde einmal um Erlaubnis gefragt und hat einmal abonniert – mit dem öffentlichen Schlüssel, den die Edge Function herausgibt');
check(server.aufrufe.some((a) => a.name === 'freizeit-push' && a.methode === 'GET'), 'den Schlüssel holt die App per GET von der Edge Function');
const abo = [...raum().push.values()][0];
check(raum().push.size === 1 && abo.endpoint === 'https://push.example.org/send/testgeraet' && abo.keys.p256dh.length === 87 && abo.keys.auth.length === 22,
  'beim Server liegt das Abo des Geräts: Endpunkt und die beiden Schlüssel');
const anmeldung = server.aufrufe.find((a) => a.name === 'freizeit_push');
check(anmeldung && anmeldung.p.p_an === true && anmeldung.p.p_schluessel === tobi.schluessel && anmeldung.p.p_person === tobi.ich.id && !('keys' in anmeldung.p),
  'angemeldet über freizeit_push, mit Tobis Schlüssel');
let st = await A.gespeichert();
check(st.push && st.push.code === tobi.code && st.push.endpunkt === abo.endpoint, 'das Gerät merkt sich: für diesen Plan angemeldet');
await A.page.reload({ waitUntil: 'networkidle' });
await A.page.waitForSelector('#ansicht .seiten-titel');
check(await stand(A) === 'an', 'nach dem Neuladen (die Adresse ist #einstellungen) steht es noch auf an');

// --- Was der Server jetzt sammelt (wie supabase/gemeinsam.sql)
await B.reiter('programm');
await karteAm(B, DI, 'Theater früh').locator('[data-mitwem="gastgeber"]').click();
await leer(B);
await karteAm(B, DI, 'Theater früh').locator('[data-mitwem="gastgeber"]').click();
await leer(B);
check(JSON.stringify(kurz()) === JSON.stringify(['bock:Kim:theater-frueh:gastgeber', 'aus:Kim:theater-frueh:gastgeber']),
  `Kim hakt „Mit Tobi“ an: bock mit mitwem – der zweite Tipp auf denselben Knopf nimmt es zurück: aus (${kurz().join(' | ')})`);
await karteAm(B, DI, 'Theater früh').locator('[data-mitwem="gastgeber"]').click();
await leer(B);
await karteAm(B, DI, 'Theater früh').locator('[data-mitwem="andere"]').click();
await leer(B);
await karteAm(B, SA, 'Party').locator('[data-mitwem="andere"]').click();
await leer(B);
await karteAm(B, SA, 'Party').locator('[data-mitwem="andere"]').click();
await leer(B);
check(JSON.stringify(kurz().slice(2)) === JSON.stringify(['bock:Kim:theater-frueh:gastgeber', 'bock:Kim:theater-frueh:andere', 'bock:Kim:party:andere']),
  `wieder anhaken, zu „Allein/mit anderen“ wechseln, Party ohne Tobi – ein zurückgenommenes „ohne dich“ meldet nichts (${kurz().join(' | ')})`);
await karteAm(B, DI, 'Theater früh').locator('[data-mitwem="gastgeber"]').click();
await leer(B);
await karteAm(B, DI, 'Theater früh').locator('[data-mitwem="gastgeber"]').click();
await leer(B);
check(kurz().slice(-2).join(' | ') === 'bock:Kim:theater-frueh:gastgeber | aus:Kim:theater-frueh:gastgeber', 'ein zurückgenommenes „mit dir“ meldet aus');
await A.reiter('programm');
await karteAm(A, DI, 'Theater früh').locator('[data-bock]').click();
await leer(A);
check(kurz().length === 7, 'Tobis eigener Haken meldet nichts');
await B.reiter('wir');
await B.aktion('verlassen');
await B.page.click('[data-aktion="verlassen-ja"]');
await warte(B, 'Gemeinsam planen');
check(kurz()[7] === 'weg:Kim' && kurz().length === 8, 'Kim verlässt den Plan: weg');

// --- Ausschalten
await A.einstellungen();
await A.page.click('[data-aktion="push-aus"]');
await A.page.waitForFunction(() => document.querySelector('.push-zeile[data-push="aus"]'));
p = await protokoll(A);
const abmeldung = server.aufrufe.filter((a) => a.name === 'freizeit_push').pop();
check(p.gekuendigt === 1 && raum().push.size === 0 && abmeldung.p.p_an === false && abmeldung.p.p_abo.endpoint === abo.endpoint && !(await A.gespeichert()).push,
  `ausgeschaltet: beim Server abgemeldet, das Abo gekündigt, nichts mehr gemerkt (${JSON.stringify(p)} ${raum().push.size} ${JSON.stringify(abmeldung.p)} ${JSON.stringify((await A.gespeichert()).push)})`);
await A.page.click('[data-aktion="push-an"]');
await A.page.waitForFunction(() => document.querySelector('.push-zeile[data-push="an"]'));
p = await protokoll(A);
check(p.abonniert === 2 && p.gefragt === 2 && raum().push.size === 1, 'wieder an: ein frisches Abo, wieder beim Server');

// --- Der Plan wird aufgelöst, ein neuer gestartet: dort gilt die Anmeldung nicht
await A.aktion('verlassen');
await A.page.click('[data-aktion="verlassen-ja"]');
await warte(A, 'Gemeinsam planen');
await A.page.fill('#wir-name', 'Tobi');
await A.page.click('[data-aktion="starten"]');
await warte(A, 'Tobi (du)');
await A.einstellungen();
check(await stand(A) === 'aus' && (await A.gespeichert()).push.code !== (await A.gespeichert()).gemeinsam.code,
  'im neuen Plan steht Push auf aus – die Anmeldung galt dem alten');
await A.page.click('[data-aktion="push-an"]');
await A.page.waitForFunction(() => document.querySelector('.push-zeile[data-push="an"]'));
p = await protokoll(A);
check(p.abonniert === 2 && [...server.raeume.values()].pop().push.size === 1, 'anschalten nutzt das Abo, das der Browser noch hat, und meldet es für den neuen Plan an');

// --- Keine Erlaubnis
const C = await oeffne({ tag: DI, push: 'default', server, browser: A.browser });
await C.reiter('wir');
await C.page.fill('#wir-name', 'Tobi');
await C.page.click('[data-aktion="starten"]');
await warte(C, 'Tobi (du)');
await C.einstellungen();
const pushAufrufe = () => server.aufrufe.filter((a) => a.name === 'freizeit_push').length;
const vorher = pushAufrufe();
await C.page.click('[data-aktion="push-an"]');
await warte(C, 'Ohne Erlaubnis keine Mitteilungen.');
check(await stand(C) === 'aus' && (await protokoll(C)).abonniert === 0 && pushAufrufe() === vorher,
  'Frage weggetippt: „Ohne Erlaubnis keine Mitteilungen.“, nichts abonniert, nichts beim Server');
check((await C.page.locator('#e-mitteilungen .fehlerbox').innerText()).includes('Ohne Erlaubnis'), '… die Meldung steht bei den Mitteilungen, nicht irgendwo');
const D = await oeffne({ tag: DI, push: 'denied', server, browser: A.browser });
await D.reiter('wir');
await D.page.fill('#wir-name', 'Tobi');
await D.page.click('[data-aktion="starten"]');
await warte(D, 'Tobi (du)');
await D.einstellungen();
check(await stand(D) === 'blockiert' && (await zeile(D).innerText()).includes('im Browser blockiert') && await D.page.locator('[data-aktion="push-an"]').count() === 0,
  'Mitteilungen blockiert: der Hinweis statt des Knopfs');

// --- iPhone im Browser, und ein Browser ohne Push
const E = await oeffne({ tag: DI, ua: IPHONE, push: 'keins', server, browser: A.browser });
await E.reiter('wir');
await E.page.fill('#wir-name', 'Tobi');
await E.page.click('[data-aktion="starten"]');
await warte(E, 'Tobi (du)');
await E.einstellungen();
check(await stand(E) === 'iphone' && (await zeile(E).innerText()).includes('Zum Home-Bildschirm'), 'iPhone im Browser: erst als App vom Home-Bildschirm');
const F = await oeffne({ tag: DI, push: 'keins', server, browser: A.browser });
await F.reiter('wir');
await F.page.fill('#wir-name', 'Tobi');
await F.page.click('[data-aktion="starten"]');
await warte(F, 'Tobi (du)');
await F.einstellungen();
check(await zeile(F).count() === 0 && (await F.page.locator('#e-mitteilungen').innerText()).includes('Dieser Browser kann keine Mitteilungen'),
  'ein Browser ohne Push bekommt keinen Knopf, nur den Satz, dass es hier nicht geht');

check([A, B, C, D, E, F].every((x) => x.fehler.length === 0), `keine Fehler in der Konsole${[A, B, C, D, E, F].flatMap((x) => x.fehler).slice(0, 2).join(' | ')}`);
await A.ende();
