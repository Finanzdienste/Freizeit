/*
 * Freizeit: WhatsApp-Nachricht und Google-Kalender – für Termine und für
 * eingeplante Ideen.
 *
 * Erst die Bausteine direkt (teilen.js hat keine Abhängigkeit zum Browser),
 * dann die Knöpfe auf den Karten: Was darin steht, ist genau das, was der
 * Empfänger liest – mit dem Link in die App statt zur Quelle (wohin er führt,
 * prüft test-link.mjs).
 */
import {
  whatsappText, kalenderLink, wannText, icsText, appLink, teilenAdresse,
} from '../js/teilen.js';
import { oeffne, IPHONE, DI, SA } from './hilfe.mjs';

const A = await oeffne({ tag: '2026-11-02' });
const { page, check, ende } = A;

// --- Bausteine
const termin = {
  titel: 'Theater früh', datum: DI, zeit: '19:00', endeMin: 21 * 60, ort: 'Thalia', beschreibung: 'Schauspiel.',
  preis: 'ab 20 €', anreise: '', link: 'https://example.org/theater', imdb: '',
};
check(wannText(termin) === 'Dienstag, 3.11.2026, 19:00 Uhr', 'Datum und Uhrzeit für Menschen');
const text = whatsappText(termin);
check(text.startsWith('*Theater früh*\n'), 'Nachricht beginnt mit dem Titel in Fettschrift');
check(text.includes('📅 Dienstag, 3.11.2026, 19:00 Uhr') && text.includes('📍 Thalia') && text.includes('💶 ab 20 €') && text.endsWith('🔗 https://example.org/theater'),
  'Nachricht enthält Datum, Ort, Preis und Link');
check(!whatsappText({ ...termin, preis: 'Preis nicht genannt' }).includes('💶'), 'eine Preisangabe ohne Aussage fällt weg');

// Der Link in die App: je Art des Eintrags, Eingeplantes über den Eintrag dahinter.
const APP = 'https://finanzdienste.github.io/Freizeit/';
check(appLink({ schluessel: `t:theater-frueh:${DI}` }, APP) === `${APP}#eintrag=t:theater-frueh:${DI}`, 'App-Link zu einem Termin: #eintrag=t:<id>:<tag>, Doppelpunkte lesbar');
check(appLink({ schluessel: 'l:ausstellung' }, APP) === `${APP}#eintrag=l:ausstellung`, '… zu Laufendem');
check(appLink({ schluessel: `p:${SA}:l:ausstellung`, quelle: 'plan' }, APP) === `${APP}#eintrag=l:ausstellung&tag=${SA}`, '… eingeplantes Laufendes: mit dem geplanten Tag');
check(appLink({ schluessel: `p:${SA}:i:elbstrand`, quelle: 'plan' }, APP) === `${APP}#eintrag=i:elbstrand`, '… eingeplante Idee: die Idee');
check(appLink({ schluessel: `p:${SA}:e:k3x9q`, quelle: 'plan' }, APP) === APP && appLink({ schluessel: 'e:k3x9q' }, APP) === APP,
  '… eigene Idee (kennt nur, wer sie hat): die App selbst');
check(appLink({ schluessel: 'f:tt0068646' }, APP) === `${APP}#eintrag=f:tt0068646`, '… zu einem Film');
check(appLink({ schluessel: 't:a&b c:2026-11-03' }, APP) === `${APP}#eintrag=t:a%26b+c:2026-11-03`, '… Sonderzeichen sicher verpackt');
check(appLink({ schluessel: 'l:x' }, '') === '', 'ohne Adresse der App kein App-Link');
// Einladungen laufen über die kurze Adresse – nur, wenn die App unter ihrer echten Adresse läuft.
// Geteilte Termine zeigen direkt auf die App (test-link.mjs): Nur das öffnet auf Android die installierte App.
check(teilenAdresse('https://finanzdienste.github.io/Freizeit/') === 'https://freizeit-hh.github.io/',
  'Einladungen aus der App unter finanzdienste.github.io/Freizeit/ laufen über freizeit-hh.github.io');
check(appLink({ schluessel: `t:theater-frueh:${DI}` }, 'https://finanzdienste.github.io/Freizeit/') === `https://finanzdienste.github.io/Freizeit/#eintrag=t:theater-frueh:${DI}`,
  'der Link zu einem Termin: https://finanzdienste.github.io/Freizeit/#eintrag=t:…');
check(teilenAdresse('http://127.0.0.1:8099/') === 'http://127.0.0.1:8099/' && teilenAdresse('https://finanzdienste.github.io/Andere/') === 'https://finanzdienste.github.io/Andere/',
  'lokal oder unter einer anderen Adresse bleibt es die eigene');
const mitApp = whatsappText(termin, { app: `${APP}#eintrag=t:theater-frueh:${DI}` });
check(mitApp.endsWith(`🔗 ${APP}#eintrag=t:theater-frueh:${DI}`) && !mitApp.includes('example.org'), 'mit App-Link: der Link in die App, nicht zur Quelle');
const kal = new URL(kalenderLink(termin));
check(kal.searchParams.get('dates') === '20261103T190000/20261103T210000', 'Kalender: Beginn und Ende');
check(kal.searchParams.get('ctz') === 'Europe/Berlin' && kal.searchParams.get('text') === 'Theater früh', 'Kalender: Zeitzone und Titel');
const spaet = new URL(kalenderLink({ ...termin, zeit: '23:00', endeMin: 26 * 60 }));
check(spaet.searchParams.get('dates') === '20261103T230000/20261104T020000', 'Kalender: Ende nach Mitternacht am Folgetag');
const ganztags = new URL(kalenderLink({ ...termin, ganztags: true, zeit: 'Sa 10–18', datum: SA }));
check(ganztags.searchParams.get('dates') === '20261107/20261108', 'Kalender: Ganztägiges als ganzer Tag');
check(kalenderLink({ ...termin, datum: null }) === null, 'ohne Datum kein Kalenderlink');
check(wannText({ von: '2026-11-02', bis: '2026-11-08', zeit: 'täglich 10–18' }) === '2.11.–8.11.2026: täglich 10–18', 'Wochenangebot: Zeitraum und Zeiten');

// --- Knöpfe auf den Karten
await A.zeigeTag(DI);
const karte = page.locator(`#tag-${DI} .karte`, { hasText: 'Theater früh' });
const wa = await karte.locator('a', { hasText: 'WhatsApp' }).getAttribute('href');
check(wa.startsWith('https://wa.me/?text='), 'WhatsApp-Knopf zeigt auf wa.me');
const nachricht = decodeURIComponent(wa.split('text=')[1]);
const basis = new URL('./', page.url()).href;
check(nachricht.includes('*Theater früh*') && nachricht.includes('📅 Dienstag, 3.11.2026, 19:00 Uhr')
  && nachricht.endsWith(`🔗 ${basis}#eintrag=t:theater-frueh:${DI}`) && !nachricht.includes('example.org'),
  'die Nachricht der Karte nennt Titel, Tag, Uhrzeit – und verlinkt den Termin in der App, nicht die Quelle');
const kalKarte = new URL(await karte.locator('a', { hasText: 'Kalender' }).getAttribute('href'));
check(kalKarte.searchParams.get('dates') === '20261103T190000/20261103T210000', 'Kalender-Knopf der Karte mit geschätztem Ende');
check(await karte.locator('a', { hasText: 'WhatsApp' }).getAttribute('target') === '_blank', 'Links öffnen außerhalb der App');

// Ideen („Was immer geht“, unten im Programm) haben kein Datum: statt Kalender und WhatsApp gibt es „Einplanen“.
await page.locator('details[data-kat="natur"] > summary').click();
const strand = page.locator('details[data-kat="natur"] .karte', { hasText: 'Elbstrand' });
check(await strand.locator('a', { hasText: 'Kalender' }).count() === 0 && await strand.locator('[data-aktion="planen"]').count() === 1,
  'Idee ohne Datum: kein Kalender-Knopf, dafür „Einplanen“');
await strand.locator('[data-aktion="planen"]').click();
await page.locator('details[data-kat="natur"] .plan-datum').fill(SA);
await page.locator('details[data-kat="natur"] .plan-zeit').fill('14:00');
await page.locator('details[data-kat="natur"] [data-aktion="plan-speichern"]').click();
const plan = page.locator('#abschnitt-geplant .karte', { hasText: 'Elbstrand' });
const waPlan = decodeURIComponent((await plan.locator('a', { hasText: 'WhatsApp' }).getAttribute('href')).split('text=')[1]);
check(waPlan.includes('*Elbstrand*') && waPlan.includes('📅 Samstag, 7.11.2026, 14:00 Uhr') && waPlan.includes('📍 Övelgönne')
  && /🔗 \S+#eintrag=i:[a-z0-9-]+$/.test(waPlan), 'eingeplant: die Nachricht nennt Tag, Uhrzeit und Ort – der Link führt zur Idee in der App');
const kalPlan = new URL(await plan.locator('a', { hasText: 'Kalender' }).getAttribute('href'));
check(kalPlan.searchParams.get('dates') === '20261107T140000/20261107T160000', 'eingeplant: der Kalender-Knopf mit zwei Stunden ab Beginn');

const film = whatsappText({ ...termin, titel: 'Der Pate', imdb: '2', unsicher: 'Uhrzeit laut Kino vorläufig', preis: '' });
check(film.includes('⭐ IMDb Top 250, Platz 2') && film.includes('⚠️ Noch nicht sicher: Uhrzeit laut Kino vorläufig'), 'Kino: IMDb-Platz und Unsicheres stehen in der Nachricht');

// Kein http(s) – kein Link in der Nachricht.
check(!whatsappText({ ...termin, link: 'javascript:alert(1)' }).includes('javascript'), 'ein javascript:-Link kommt nicht in die Nachricht');

// .ics für das iPhone
const ics = icsText({ ...termin, schluessel: 't:theater-frueh:2026-11-03' });
check(ics.includes('DTSTART;TZID=Europe/Berlin:20261103T190000') && ics.includes('DTEND;TZID=Europe/Berlin:20261103T210000'), '.ics: Beginn und Ende in Ortszeit');
check(ics.includes('SUMMARY:Theater früh') && ics.includes('LOCATION:Thalia') && ics.includes('URL:https://example.org/theater'), '.ics: Titel, Ort, Link');
check(icsText({ ...termin, titel: 'A; B, C' }).includes('SUMMARY:A\\; B\\, C'), '.ics: Semikolon und Komma maskiert');
check(icsText({ ...termin, ganztags: true, datum: SA }).includes('DTSTART;VALUE=DATE:20261107'), '.ics: Ganztägiges als ganzer Tag');

const iphone = await oeffne({ tag: '2026-11-02', ua: IPHONE, browser: page.context().browser() });
await iphone.zeigeTag(DI);
const kalIphone = iphone.page.locator(`#tag-${DI} .karte`, { hasText: 'Theater früh' }).locator('a', { hasText: 'Kalender' });
const href = await kalIphone.getAttribute('href');
check(href.startsWith('data:text/calendar') && await kalIphone.getAttribute('download') === 'termin.ics', 'auf dem iPhone: der Kalender-Knopf liefert eine .ics-Datei');
check(decodeURIComponent(href.split(',')[1]).includes('DTSTART;TZID=Europe/Berlin:20261103T190000'), '… mit dem richtigen Termin');
check(iphone.fehler.length === 0, 'iPhone: keine Fehler in der Konsole');

await ende();
