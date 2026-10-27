/*
 * Reiter „Wir“: der gemeinsame Plan. Tobi lädt ein und sieht alles; Kim und
 * Jo sagen bei jedem Haken, ob mit Tobi oder allein/mit anderen, und sehen
 * nur Tobi und sich.
 *
 * Mehrere Browser teilen einen nachgebauten Server (hilfe.mjs → fakeServer,
 * verhält sich wie supabase/gemeinsam.sql). Tobi startet den Plan und
 * schickt den Link, Kim öffnet ihn auf dem iPhone, Jo kommt mit dem Code
 * dazu. Dann: Tobis Überblick, wer was sieht, offline, ein zweites Gerät mit
 * dem Link „Weiteres Gerät“, ein falscher Code, Herausnehmen, Verlassen,
 * Auflösen – und ein Plan aus der ersten Fassung, in dem jeder alles sah.
 */
import { oeffne, fakeServer, IPHONE, MO, DI, MI, FR, SA } from './hilfe.mjs';

const server = fakeServer();
const A = await oeffne({ tag: MO, server });
const { check } = A;
const raum = () => [...server.raeume.values()][0];
const haken = () => [...raum().bock.values()];
const text = (x) => x.page.locator('#ansicht').innerText();
const warte = (x, t, ms = 6000) => x.page.waitForFunction((s) => document.querySelector('#ansicht').innerText.includes(s), t, { timeout: ms })
  .then(() => true).catch(() => false);
/** Bis nichts mehr zum Server muss. */
const leer = (x) => x.page.waitForFunction(() => !JSON.parse(localStorage.getItem('freizeit.stand.v1')).warteschlange.length, null, { timeout: 6000 });
/** „Jetzt abgleichen“ – und warten, bis es durch ist. */
async function synchron(x) {
  const vorher = (await x.gespeichert()).gemeinsam?.abgeholt;
  await x.page.click('[data-aktion="abgleichen"]');
  await x.page.waitForFunction((v) => {
    const st = JSON.parse(localStorage.getItem('freizeit.stand.v1'));
    return !st.gemeinsam || st.gemeinsam.abgeholt !== v || st.gemeinsam.raus;
  }, vorher, { timeout: 6000 }).catch(() => {});
  await x.page.waitForTimeout(150);
}
const karteAm = (x, tag, titel) => x.page.locator(`#tag-${tag} .karte`, { hasText: titel });
const personZeile = (x, name) => x.page.locator('.person-zeile').filter({ has: x.page.locator('summary .person', { hasText: new RegExp(`^${name}$`) }) });

// --- Tobi startet den Plan
await A.reiter('wir');
check((await A.page.locator('.einrichten h3').first().innerText()) === 'Gemeinsam planen', 'ohne Plan: zuerst „Gemeinsam planen“ (kein iPhone)');
await A.page.click('[data-aktion="starten"]');
check((await A.page.locator('.fehlerbox').innerText()).includes('Namen'), 'ohne Namen geht es nicht');
await A.page.fill('#wir-name', 'Tobi');
await A.page.click('[data-aktion="starten"]');
await warte(A, 'Tobi (du)');
const tobi = (await A.gespeichert()).gemeinsam;
check(server.raeume.size === 1 && raum().personen.length === 1 && raum().gastgeber?.person === tobi.ich.id, 'der Server hat einen Raum, Tobi ist sein Gastgeber');
check(tobi.rolle === 'gastgeber' && /^[a-z2-9]{24}$/.test(tobi.schluessel) && raum().gastgeber.schluessel === tobi.schluessel,
  'Tobis Gerät hat den Schlüssel des Gastgebers (24 Zeichen)');
check((await A.page.locator('.banner').innerText()).includes('Noch ist niemand dabei'), 'allein im Plan: ein Hinweis zum Einladen');
const link = await A.page.locator('#einladungslink').inputValue();
const code = link.split('#einladung=')[1];
check(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/.test(code) && !/[lo01]/.test(code), `der Einladungslink trägt einen Code ohne Verwechsler (${code})`);
check(server.raeume.has(code), 'derselbe Code wie beim Server');
const wa = decodeURIComponent((await A.page.locator('.einladung a', { hasText: 'WhatsApp' }).getAttribute('href')).split('text=')[1]);
check(wa.includes(link) && wa.includes(code) && wa.includes('Zum Home-Bildschirm'), 'die WhatsApp-Nachricht hat Link, Code und den Weg fürs iPhone');
check(wa.includes('was in Hamburg und Umgebung los ist') && wa.includes('„Mit Tobi“ oder „Allein/mit anderen“') && wa.includes('Deine Haken sehe nur ich'),
  '… und sagt, worum es geht: was los ist, die zwei Knöpfe, wer die Haken sieht');
check((await A.page.locator('#einladungstext').inputValue()) === wa, 'der Text steht auch zum Ansehen und Kopieren da');
check(!link.includes(tobi.schluessel) && !wa.includes(tobi.schluessel), 'der Schlüssel steht weder im Link noch in der Nachricht');

// Tobi hakt im Programm an.
await A.reiter('programm');
await karteAm(A, DI, 'Theater früh').locator('[data-bock]').click();
await karteAm(A, FR, 'Konzert spät').locator('[data-bock]').click();
check(await karteAm(A, DI, 'Theater früh').locator('[data-bock]').count() === 1, 'der Gastgeber hat einen Knopf „Bock“ wie ohne Plan');
await leer(A);
check(haken().length === 2 && haken().every((b) => b.person === tobi.ich.id && b.daten.titel), 'Tobis Haken sind mit Schnappschuss beim Server');

// --- Kim öffnet den Link auf dem iPhone (im Browser, noch nicht als App)
const B = await oeffne({ tag: MO, server, ua: IPHONE, hash: `einladung=${code}`, browser: A.browser });
check(await B.page.locator('[data-reiter="wir"]').getAttribute('aria-current') === 'page', 'der Link öffnet direkt „Wir“');
check(!B.page.url().includes(code), 'der Code verschwindet aus der Adresszeile');
await warte(B, 'Tobi lädt dich ein');
check((await B.page.locator('#einladung-karte h3').innerText()) === 'Tobi lädt dich ein', 'Kim sieht, wer sie einlädt');
check((await B.page.locator('#einladung-karte').innerText()).includes('Deine Haken sieht nur Tobi'), '… und wer ihre Haken sieht');
check((await B.page.locator('#einladung-karte').innerText()).includes('Freizeit zeigt, was in Hamburg und Umgebung los ist'), '… und was die App überhaupt ist');
check((await B.page.locator('.schritte').innerText()).includes('Zum Home-Bildschirm') && (await B.page.locator('.schritte code').innerText()) === code,
  'auf dem iPhone im Browser: der Weg zum Home-Bildschirm und der Code');
await B.page.fill('#wir-name', 'Kim');
await B.page.click('[data-aktion="beitreten"]');
await warte(B, 'Kim (du)');
const kim = (await B.gespeichert()).gemeinsam;
check(raum().personen.map((p) => p.name).join(',') === 'Tobi,Kim', 'jetzt sind beide im Raum');
check(kim.rolle === 'mitglied' && !kim.schluessel, 'Kim ist dabei – ohne Schlüssel');
check((await text(B)).includes('Du planst mit Tobi'), 'Kim weiß, mit wem sie plant');
const hilfe = B.page.locator('#hilfe-karte');
check(await hilfe.count() === 1 && (await hilfe.locator('h3').innerText()) === "So funktioniert's"
  && (await hilfe.innerText()).includes('Mit Tobi an einem Termin heißt') && (await hilfe.innerText()).includes('Deine Haken sieht nur Tobi'),
"nach dem Beitreten erklärt „So funktioniert's“ die Knöpfe und wer was sieht");
check((await hilfe.innerText()).includes('Weiteres Gerät'), '… im Safari-Browser auf dem iPhone auch, wie der Plan in die App vom Home-Bildschirm kommt');
await hilfe.locator('[data-aktion="hilfe-weg"]').click();
check(await B.page.locator('#hilfe-karte').count() === 0 && (await B.gespeichert()).hilfeWeg === true, '„Alles klar“ – die Erklärung ist weg und bleibt weg');
await B.page.click('[data-aktion="hilfe"]');
check(await B.page.locator('#hilfe-karte').count() === 1, '„So geht\'s“ holt sie zurück');
await B.page.click('[data-aktion="hilfe"]');
check(await B.page.locator('#wir-seine .karte', { hasText: 'Theater früh' }).count() === 1
  && (await B.page.locator('#wir-seine .abschnitt-titel').innerText()) === 'Tobi hat Bock auf', 'unter „Tobi hat Bock auf“: Tobis Haken');
check(!JSON.stringify(kim.stand).includes(tobi.ich.id), 'Tobis echte Kennung kommt bei Kim nie an');

// Kim wählt: Theater mit Tobi, das Konzert allein/mit anderen, Nachtmarkt erst mit, dann ohne.
await B.reiter('programm');
check(await B.page.locator('.hinweis-install').count() === 1, 'im Safari-Browser: Hinweis, wie die App auf den Home-Bildschirm kommt');
const theaterB = karteAm(B, DI, 'Theater früh');
check(await theaterB.locator('[data-bock]').count() === 2 && (await theaterB.locator('[data-mitwem="gastgeber"]').innerText()) === 'Mit Tobi'
  && (await theaterB.locator('[data-mitwem="andere"]').innerText()) === 'Allein/mit anderen', 'Kim hat zwei Knöpfe: „Mit Tobi“ und „Allein/mit anderen“');
check((await theaterB.locator('.wer').innerText()).includes('hat Bock'), '… und sieht an der Karte, dass Tobi Bock hat');
await theaterB.locator('[data-mitwem="gastgeber"]').click();
check(await karteAm(B, DI, 'Theater früh').locator('[data-mitwem="gastgeber"]').getAttribute('aria-pressed') === 'true', '„Mit Tobi“ ist gedrückt');
await karteAm(B, FR, 'Konzert spät').locator('[data-mitwem="andere"]').click();
await karteAm(B, MI, 'Nachtmarkt').locator('[data-mitwem="gastgeber"]').click();
await karteAm(B, MI, 'Nachtmarkt').locator('[data-mitwem="andere"]').click();
const nacht = karteAm(B, MI, 'Nachtmarkt');
check(await nacht.locator('[data-mitwem="andere"]').getAttribute('aria-pressed') === 'true'
  && await nacht.locator('[data-mitwem="gastgeber"]').getAttribute('aria-pressed') === 'false', 'umentscheiden: der andere Knopf übernimmt');
await karteAm(B, DI, 'Workshop mittags').locator('[data-mitwem="gastgeber"]').click();
await karteAm(B, DI, 'Workshop mittags').locator('[data-mitwem="gastgeber"]').click();
check(await karteAm(B, DI, 'Workshop mittags').locator('[aria-pressed="true"]').count() === 0, 'dieselbe Wahl noch einmal nimmt den Haken weg');
await leer(B);
const vonKim = haken().filter((b) => b.person === kim.ich.id);
const wieKim = (t) => vonKim.find((b) => b.eintrag.startsWith(`t:${t}:`))?.daten?.mitwem;
check(vonKim.length === 3 && wieKim('theater-frueh') === 'gastgeber' && wieKim('konzert-spaet') === 'andere' && wieKim('nachtmarkt') === 'andere',
  'beim Server steht im Schnappschuss, mit wem');
await B.reiter('wir');
check(await B.page.locator('#wir-zusammen .karte.treffer', { hasText: 'Theater früh' }).count() === 1, 'Kim: unter „Du und Tobi“ das Theater, als Treffer');
check(await B.page.locator('#wir-deine .karte', { hasText: 'Konzert spät' }).count() === 1
  && await B.page.locator('.karte.treffer', { hasText: 'Konzert spät' }).count() === 0, 'das Konzert (allein/mit anderen) steht unter „Deine Haken“ – kein Treffer');

// --- Jo kommt mit dem Code dazu
const C = await oeffne({ tag: MO, server, browser: A.browser });
await C.reiter('wir');
await C.page.fill('#wir-code', code.toUpperCase().replaceAll('-', ' '));
await C.page.fill('#wir-name-code', 'Jo');
await C.page.click('[data-aktion="beitreten-code"]');
await warte(C, 'Jo (du)');
const jo = (await C.gespeichert()).gemeinsam;
check(raum().personen.length === 3 && jo.rolle === 'mitglied', 'Jo tritt mit dem Code ein (groß und mit Leerzeichen getippt)');
await C.reiter('programm');
await karteAm(C, FR, 'Konzert spät').locator('[data-mitwem="gastgeber"]').click();
await karteAm(C, MI, 'Nachtmarkt').locator('[data-mitwem="andere"]').click();
await karteAm(C, SA, 'Party').locator('[data-mitwem="gastgeber"]').click();
await leer(C);
await C.reiter('wir');
await synchron(C);
check(!(await text(C)).includes('Kim') && !JSON.stringify(await C.gespeichert()).includes(kim.ich.id), 'Jo sieht von Kim nichts – weder ihren Namen noch ihre Haken');
await synchron(B);
check(!(await text(B)).includes('Jo') && !JSON.stringify(await B.gespeichert()).includes(jo.ich.id), '… und Kim nichts von Jo');

// --- Tobis Überblick
await A.reiter('wir');
await synchron(A);
const zusammen = A.page.locator('#wir-zusammen');
const theater = zusammen.locator('.karte.treffer', { hasText: 'Theater früh' });
check(await theater.count() === 1 && (await theater.locator('.wer').innerText()).includes('will mit dir – du auch'),
  'Tobi: unter „Zusammen“ das Theater – „Kim will mit dir – du auch“');
const konzertWer = await zusammen.locator('.karte', { hasText: 'Konzert spät' }).locator('.wer').innerText();
check(konzertWer.includes('Jo') && konzertWer.includes('will mit dir') && konzertWer.includes('Kim') && konzertWer.includes("macht's ohne dich"),
  "das Konzert: Jo will mit Tobi, Kim macht's ohne ihn – beides an einer Karte");
const party = A.page.locator('#wir-mit-dir .karte', { hasText: 'Party' });
check(await party.count() === 1 && (await party.locator('.wer').innerText()).includes('Jo') && await party.locator('.karte.treffer').count() === 0,
  'unter „Wollen mit dir“: Jos Party – Tobi hat dort noch nicht Bock');
const markt = A.page.locator('#wir-ohne-dich .karte', { hasText: 'Nachtmarkt' });
check(await markt.count() === 1 && (await markt.locator('.wer').innerText()).includes("machen's ohne dich"), "unter „Ohne dich“: den Nachtmarkt machen Kim und Jo ohne ihn");
await A.page.click('[data-aktion="hilfe"]');
check((await A.page.locator('#hilfe-karte h3').innerText()) === "So funktioniert's für deine Leute", 'Tobi sieht unter „So geht\'s“, wie es für seine Leute läuft');
await A.page.click('[data-aktion="hilfe"]');
const kimZeile = personZeile(A, 'Kim');
check((await kimZeile.locator('summary').innerText()).includes('1 mit dir · 2 ohne dich'), 'pro Person: Kim – 1 mit dir, 2 ohne dich');
await kimZeile.locator('summary').click();
check((await kimZeile.locator('.person-liste').innerText()).includes('Theater früh'), 'aufgeklappt: Kims Haken, je mit Tag');
await party.locator('[data-bock]').click();
check(await A.page.locator('#wir-zusammen .karte.treffer', { hasText: 'Party' }).count() === 1 && await A.page.locator('#wir-mit-dir').count() === 0,
  'Tobi sagt Bock zu Jos Party – sie rückt unter „Zusammen“');
check(await kimZeile.getAttribute('open') !== null, 'was man aufgeklappt hat, bleibt nach dem Neuzeichnen offen');
await A.reiter('programm');
check((await karteAm(A, MI, 'Nachtmarkt').locator('.wer').innerText()).includes('ohne dich'), 'auch im Programm steht an der Karte, wer es ohne Tobi macht');
await A.reiter('kalender');
check(await A.page.locator(`.feld[data-tag="${DI}"].treffer`).count() === 1 && await A.page.locator(`.feld[data-tag="${FR}"].treffer`).count() === 1
  && await A.page.locator(`.feld[data-tag="${MI}"].treffer`).count() === 0, 'im Kalender: die Tage mit Treffern – der Nachtmarkt ohne Tobi ist keiner');

// Fremdes darf nichts anrichten – und Tobi kann es herausnehmen.
const FREMD = 'pzzzzzzzzzzzzzz';
raum().personen.push({ id: FREMD, name: '<img src=x onerror=alert(1)>' });
raum().bock.set(`${FREMD}|t:sonder:2026-11-20`, {
  person: FREMD, eintrag: 't:sonder:2026-11-20', geaendert: new Date().toISOString(),
  daten: { titel: 'Sonderkonzert', datum: '2026-11-20', zeit: '20:00', ort: 'Knust', link: 'javascript:alert(2)', mitwem: 'gastgeber' },
});
await A.reiter('programm');
await A.page.reload({ waitUntil: 'networkidle' });
await A.page.waitForFunction(() => !document.querySelector('#wir-neu').hidden, null, { timeout: 6000 }).catch(() => {});
check(!(await A.page.locator('#wir-neu').isHidden()), 'Tobi: ein Punkt an „Wir“ zeigt neue Haken der anderen');
await A.reiter('wir');
check(await A.page.locator('#wir-neu').isHidden(), 'nach dem Öffnen ist der Punkt weg');
check(await A.page.locator('#ansicht img').count() === 0 && (await A.page.locator('.leute').innerText()).includes('<img src=x'), 'ein Name mit HTML steht als Text da');
const sonder = A.page.locator('#wir-mit-dir .karte', { hasText: 'Sonderkonzert' });
check(await sonder.count() === 1, 'ein Haken auf etwas, das nicht in den Daten steht, kommt aus dem Schnappschuss');
check(await sonder.locator('a.quelle').count() === 0, '… ein javascript:-Link daraus wird kein Link');
await synchron(B);
check(!(await text(B)).includes('<img') && !(await text(B)).includes('Sonderkonzert'), 'Kim sieht davon nichts');
const fremd = A.page.locator('.person-zeile', { hasText: '<img' });
await fremd.locator('summary').click();
await fremd.locator('[data-aktion="entfernen"]').click();
check((await fremd.locator('.einladung').innerText()).includes('aus dem Plan nehmen?'), 'Herausnehmen fragt erst nach');
await fremd.locator('[data-aktion="entfernen-ja"]').click();
await A.page.waitForFunction(() => !document.querySelector('#ansicht').innerText.includes('<img'), null, { timeout: 6000 }).catch(() => {});
check(!raum().personen.some((p) => p.id === FREMD) && !haken().some((b) => b.person === FREMD), 'Tobi nimmt den Fremden heraus – mit seinen Haken');

// --- Kim ist offline
server.offline = true;
await B.reiter('programm');
await karteAm(B, DI, 'Workshop mittags').locator('[data-mitwem="gastgeber"]').click();
await B.page.waitForTimeout(1500);
await B.reiter('wir');
check((await B.page.locator('.syncstatus').innerText()).includes('1 Änderung wartet'), 'offline: der Haken wartet');
check(await B.page.locator('.karte', { hasText: 'Workshop mittags' }).count() === 1, 'offline: er steht trotzdem schon in der Liste');
server.offline = false;
await B.page.click('[data-aktion="abgleichen"]');
await leer(B);
check(haken().some((b) => b.person === kim.ich.id && b.eintrag.startsWith('t:workshop-mittags:')), 'wieder online: der Haken ist beim Server');

// --- Tobi auf einem zweiten Gerät, mit dem Link „Weiteres Gerät“
await A.page.click('[data-aktion="geraet"]');
const geraetLink = await A.page.locator('#geraetlink').inputValue();
check(geraetLink.includes('#geraet=') && geraetLink.endsWith(tobi.schluessel), 'Tobis Link „Weiteres Gerät“ trägt seinen Schlüssel');
const D = await oeffne({ tag: MO, server, browser: A.browser, hash: geraetLink.split('#')[1] });
check(!D.page.url().includes(tobi.schluessel), 'der Schlüssel verschwindet aus der Adresszeile');
check((await D.page.locator('#zugang-karte h3').innerText()) === 'Zugang von deinem anderen Gerät', 'das zweite Gerät fragt erst, ob es den Zugang übernehmen soll');
await D.page.click('[data-aktion="zugang-uebernehmen"]');
await warte(D, 'Tobi (du)');
const tobi2 = (await D.gespeichert()).gemeinsam;
check(tobi2.rolle === 'gastgeber' && tobi2.ich.id === tobi.ich.id && tobi2.schluessel === tobi.schluessel && !(await D.gespeichert()).zugang,
  'das zweite Gerät ist Tobi – samt Schlüssel');
check(raum().personen.length === 3, 'beim Server kommt dafür niemand dazu');
check(await D.page.locator('#wir-zusammen .karte', { hasText: 'Theater früh' }).count() === 1
  && Object.keys((await D.gespeichert()).bock).some((k) => k.startsWith('t:theater-frueh:')), '… und kennt Tobis Überblick und seine Haken');

// Jo nimmt sich in eine zweite App mit – Link ins Feld „Code oder Link“, ohne Namen.
await C.page.click('[data-aktion="geraet"]');
const joLink = await C.page.locator('#geraetlink').inputValue();
check(joLink.split('#geraet=')[1].split('.').length === 2, 'Jos Link hat keinen Schlüssel – Jo ist kein Gastgeber');
const E = await oeffne({ tag: MO, server, browser: A.browser });
await E.reiter('wir');
await E.page.fill('#wir-code', joLink);
await E.page.click('[data-aktion="beitreten-code"]');
await warte(E, 'Jo (du)');
check((await E.gespeichert()).gemeinsam.ich.id === jo.ich.id && raum().personen.length === 3, 'Jos zweite App ist Jo – niemand kommt dazu');

// --- falscher Code
const F = await oeffne({ tag: MO, server, browser: A.browser });
await F.reiter('wir');
await F.page.fill('#wir-code', 'aaaa-bbbb-cccc');
await F.page.fill('#wir-name-code', 'Jemand');
await F.page.click('[data-aktion="beitreten-code"]');
await warte(F, 'keinen gemeinsamen Plan');
check((await F.page.locator('.fehlerbox').innerText()).includes('keinen gemeinsamen Plan'), 'ein falscher Code legt keinen neuen Raum an, sondern sagt Bescheid');
check(server.raeume.size === 1, 'beim Server bleibt es bei einem Raum');

// --- Tobi nimmt Jo heraus; Jos App tritt nicht von selbst wieder ein
await A.reiter('wir');
const joZeile = personZeile(A, 'Jo');
await joZeile.locator('summary').click();
await joZeile.locator('[data-aktion="entfernen"]').click();
await joZeile.locator('[data-aktion="entfernen-ja"]').click();
await A.page.waitForFunction(() => !document.querySelector('.person-zeile .einladung'), null, { timeout: 6000 }).catch(() => {});
check(!raum().personen.some((p) => p.id === jo.ich.id) && !haken().some((b) => b.person === jo.ich.id), 'beim Server sind Jo und seine Haken weg');
await C.reiter('wir');
await synchron(C);
check(await warte(C, 'Du bist nicht mehr dabei'), 'Jos App merkt es: „Du bist nicht mehr dabei“');
check(!raum().personen.some((p) => p.id === jo.ich.id), '… und tritt nicht von selbst wieder ein');
check(await C.page.locator('#wir-deine .karte', { hasText: 'Konzert spät' }).count() === 1, 'Jos Haken bleiben auf seinem Gerät');
await C.page.click('[data-aktion="wieder-beitreten"]');
await warte(C, 'Jo (du)');
await leer(C);
check(raum().personen.some((p) => p.id === jo.ich.id) && haken().some((b) => b.person === jo.ich.id && b.eintrag.startsWith('t:konzert-spaet:')),
  '„Wieder beitreten“: Jo ist zurück, mit seinen Haken');

// --- Kim verlässt den Plan
await B.page.click('[data-aktion="verlassen"]');
await B.page.click('[data-aktion="verlassen-ja"]');
await warte(B, 'Gemeinsam planen');
check(!raum().personen.some((p) => p.id === kim.ich.id) && !haken().some((b) => b.person === kim.ich.id), 'Kim verlässt den Plan – beim Server ist sie mit ihren Haken weg');
check(await B.page.locator('.karte', { hasText: 'Workshop mittags' }).count() === 1, 'auf Kims Gerät bleiben ihre Haken (Deine Bock-Liste)');

// --- Tobi löst den Plan auf (auf dem zweiten Gerät)
await D.reiter('wir');
await D.page.click('[data-aktion="verlassen"]');
check((await D.page.locator('[data-aktion="verlassen"]').first().innerText()) === 'Auflösen' && (await D.page.locator('.einladung').innerText()).includes('Wirklich auflösen?'),
  'der Gastgeber verlässt nicht, er löst auf – mit Nachfrage');
await D.page.click('[data-aktion="verlassen-ja"]');
await warte(D, 'Gemeinsam planen');
check(server.raeume.size === 0, 'aufgelöst: beim Server ist der Raum weg');
await synchron(C);
check(await warte(C, 'Der Plan ist aufgelöst') && (await text(C)).includes('Tobi hat den gemeinsamen Plan aufgelöst'), 'Jo erfährt es: Tobi hat den Plan aufgelöst');
await C.page.click('[data-aktion="vergessen"]');
await warte(C, 'Gemeinsam planen');
check(!(await C.gespeichert()).gemeinsam && Object.keys((await C.gespeichert()).bock).length > 0, '„Plan vergessen“: zurück auf Anfang, Jos Haken bleiben');
await A.reiter('wir');
await synchron(A);
check(await warte(A, 'auf einem anderen Gerät aufgelöst'), 'Tobis erstes Gerät: „Du hast den Plan auf einem anderen Gerät aufgelöst.“');

// --- Ein Plan aus der ersten Fassung (jeder sah alles, keiner hatte einen Schlüssel)
const alt = fakeServer();
const ALT = 'altp-lanr-aum2';
const T = 'ptobialtaaaaaaaa';
const K = 'pkimaltbbbbbbbbb';
alt.raeume.set(ALT, {
  personen: [{ id: T, name: 'Tobi' }, { id: K, name: 'Kim' }],
  bock: new Map([[`${K}|t:theater-frueh:${DI}`, {
    person: K, eintrag: `t:theater-frueh:${DI}`, daten: { titel: 'Theater früh', datum: DI, zeit: '19:00' }, geaendert: new Date().toISOString(),
  }]]),
  gastgeber: null,
});
const vorher = (id, name) => ({
  version: 2, bock: {}, warteschlange: [],
  gemeinsam: { code: ALT, ich: { id, name }, stand: { personen: [{ id: T, name: 'Tobi' }, { id: K, name: 'Kim' }], bock: [] }, abgeholt: '' },
});
const G = await oeffne({ tag: MO, server: alt, browser: A.browser, stand: vorher(T, 'Tobi') });
await G.reiter('wir');
await G.page.waitForFunction(() => JSON.parse(localStorage.getItem('freizeit.stand.v1')).gemeinsam.rolle, null, { timeout: 6000 }).catch(() => {});
const tobiAlt = (await G.gespeichert()).gemeinsam;
check(tobiAlt.rolle === 'gastgeber' && /^[a-z2-9]{24}$/.test(tobiAlt.schluessel) && alt.raeume.get(ALT).gastgeber?.schluessel === tobiAlt.schluessel,
  'erste Fassung: Wer den Plan begonnen hat, wird beim ersten Abgleich Gastgeber und hinterlegt seinen Schlüssel');
await warte(G, 'Wollen mit dir');
check(await G.page.locator('#wir-mit-dir .karte', { hasText: 'Theater früh' }).count() === 1, 'Kims alter Haken (ohne „mit wem“) gilt als „will mit dir“');
const H = await oeffne({ tag: MO, server: alt, browser: A.browser, stand: vorher(K, 'Kim') });
await H.reiter('wir');
await H.page.waitForFunction(() => JSON.parse(localStorage.getItem('freizeit.stand.v1')).gemeinsam.rolle, null, { timeout: 6000 }).catch(() => {});
const kimAlt = (await H.gespeichert()).gemeinsam;
check(kimAlt.rolle === 'mitglied' && !kimAlt.schluessel && alt.raeume.get(ALT).gastgeber.person === T, 'Kim bleibt, was sie war: dabei, ohne Schlüssel');
check(!JSON.stringify(kimAlt.stand).includes(T) && (await text(H)).includes('Du planst mit Tobi'), 'und sieht Tobi von jetzt an nur noch als Gastgeber, ohne seine Kennung');

for (const [wer, x] of [['Kim', B], ['Jo', C], ['zweites Gerät', D], ['Jos zweite App', E], ['falscher Code', F], ['Tobi, erste Fassung', G], ['Kim, erste Fassung', H]]) {
  check(x.fehler.length === 0, `${wer}: keine Fehler in der Konsole${x.fehler.length ? `: ${x.fehler.slice(0, 2).join(' | ')}` : ''}`);
}
await A.ende();
