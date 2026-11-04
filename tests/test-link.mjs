/*
 * Geteilte Links (js/teilen.js appLink, js/app.js linkFolgen): Was man per
 * WhatsApp weitergibt, verlinkt die App statt der Quelle. Wer den Link öffnet –
 * auch zum ersten Mal –, landet beim Eintrag: der Termin an seinem Tag,
 * Laufendes (eingeplant: am geplanten Tag) in seinem Kasten, die Idee unter
 * „Was immer geht“, der Film in der Top 250 – die Karte aufgeklappt und im
 * Blick. Fehlt die Karte, sagt oben am Tag ein Hinweis warum: vorbei, nicht
 * mehr im Programm, Filter, 21:30. Auch in der offenen App (hashchange).
 */
import { oeffne, MO, DI, MI, SA } from './hilfe.mjs';

const A = await oeffne({ tag: MO, zeit: '10:00' });
const { page, check, browser } = A;

/** Die Karte aufgeklappt, unter der klebenden Tagesleiste und in der oberen Hälfte des Bildschirms? */
const imBlick = (karte) => karte.evaluate((el) => {
  const r = el.getBoundingClientRect();
  const leiste = document.querySelector('.tagleiste');
  const unter = leiste ? leiste.getBoundingClientRect().bottom : 0;
  return el.classList.contains('auf') && r.top >= unter - 1 && r.top < window.innerHeight * 0.6;
}).catch(() => false);
const hinweis = (x, tag) => x.page.locator(`#tag-${tag} .meldung`).innerText().catch(() => '');

// --- Der Link steht in der WhatsApp-Nachricht der Karte
await A.zeigeTag(DI);
const wa = await page.locator(`#tag-${DI} .karte`, { hasText: 'Theater früh' }).locator('a', { hasText: 'WhatsApp' }).getAttribute('href');
const link = decodeURIComponent(wa.split('text=')[1]).split('🔗 ').pop();
check(link === `${new URL('./', page.url()).href}#eintrag=t:theater-frueh:${DI}`, `die Nachricht verlinkt den Termin in der App (${link})`);
check(await page.locator('meta[property="og:image"]').getAttribute('content') === 'https://finanzdienste.github.io/Freizeit/icon-512.png'
  && (await page.locator('meta[property="og:title"]').getAttribute('content')).startsWith('Freizeit'), 'für die Vorschau in WhatsApp: Titel und Bild der App');

// --- Jemand öffnet ihn, zum ersten Mal in der App
const K = await oeffne({ tag: MO, hash: link.split('#')[1], browser });
const theater = K.page.locator(`#tag-${DI} .karte`, { hasText: 'Theater früh' });
check(await theater.count() === 1 && await imBlick(theater), 'der Link öffnet den Dienstag – „Theater früh“ aufgeklappt und im Blick');
check(await K.page.evaluate(() => location.hash) === '' && await K.page.locator('.reiterleiste [data-reiter="programm"][aria-current="page"]').count() === 1,
  'danach ist die Adresse wieder schlicht, unten ist „Programm“ markiert');
await K.ende({ schliessen: false });

// --- Eingeplantes Laufendes: der geplante Tag, der Kasten offen
const L = await oeffne({ tag: MO, hash: `eintrag=l:ausstellung&tag=${SA}`, browser });
const ausstellung = L.page.locator('#abschnitt-laufend .karte', { hasText: 'Ausstellung X' });
check(await L.page.locator(`#tag-${SA}`).count() === 1 && await L.page.locator('#abschnitt-laufend[open]').count() === 1 && await imBlick(ausstellung),
  'Laufendes, für Samstag eingeplant: der Samstag, „Läuft“ offen, die Ausstellung aufgeklappt und im Blick');
await L.ende({ schliessen: false });

// --- Eine Idee: „Was immer geht“, ihre Kategorie offen
const I = await oeffne({ tag: MO, hash: 'eintrag=i:story-game', browser });
const story = I.page.locator('#idee-i-story-game');
check(await I.page.locator('details[data-kat="spiele"][open]').count() === 1 && await imBlick(story), 'eine Idee: unter „Was immer geht“ ihre Kategorie offen, die Idee aufgeklappt und im Blick');
await I.ende({ schliessen: false });

// --- Ein Film: die Top 250
const F = await oeffne({ tag: MO, hash: 'eintrag=f:tt0068646', browser });
check(await F.page.locator('.filme-seite').count() === 1 && await imBlick(F.page.locator('#film-f-tt0068646')) && await F.page.evaluate(() => location.hash) === '#filme',
  'ein Film: die IMDb Top 250, „Der Pate“ aufgeklappt und im Blick');
await F.ende({ schliessen: false });

// --- Wenn die Karte fehlt: ein Hinweis statt nichts
const N = await oeffne({ tag: MO, hash: `eintrag=t:gibts-nicht:${MI}`, browser });
check((await hinweis(N, MI)).includes('Der Eintrag aus dem Link steht nicht mehr im Programm'), 'nicht (mehr) in den Daten: sein Tag, oben „steht nicht mehr im Programm“');
await N.ende({ schliessen: false });
const V = await oeffne({ tag: MI, hash: `eintrag=t:theater-frueh:${DI}`, browser });
check((await hinweis(V, MI)).includes('„Theater früh“ war am Dienstag, 3.11.2026 – das ist vorbei.'), 'ein Link auf Vergangenes: heute, oben „war am Dienstag, 3.11.2026 – das ist vorbei“');
await V.ende({ schliessen: false });
const S = await oeffne({ tag: MO, hash: `eintrag=t:konzert-spaet:${DI}`, browser });
check((await hinweis(S, DI)).includes('„Konzert spät“ ist ausgeblendet – es endet erst nach 21:30.'), 'endet nach 21:30 vor einem Arbeitstag: der Hinweis sagt es');
await S.ende({ schliessen: false });

// --- In der offenen App, mit Filter: der Hinweis nennt die Filter
await A.filter('drinnen');
await page.evaluate((mi) => { location.hash = `#eintrag=t:nachtmarkt:${mi}`; }, MI);
await page.locator(`#tag-${MI} .meldung`).waitFor({ timeout: 4000 }).catch(() => {});
check((await hinweis(A, MI)).includes('„Nachtmarkt“ ist gerade ausgeblendet – durch deine Filter') && await page.evaluate(() => location.hash) === '',
  'Link in der offenen App, Filter „drinnen“: der Mittwoch, oben der Hinweis auf die Filter');
await A.filter('drinnen');
check(await page.locator(`#tag-${MI} .karte`, { hasText: 'Nachtmarkt' }).count() === 1, 'Filter wieder aus: der Nachtmarkt steht da');

await A.ende();
