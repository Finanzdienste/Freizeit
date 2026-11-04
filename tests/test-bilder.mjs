/*
 * Bilder an den Karten (js/bilder.js): ein freies Foto des Orts aus
 * daten/ortsbilder.json – zugeklappt klein vorn, aufgeklappt groß mit
 * Fotograf, Lizenz und Quelle –, sonst ein gezeichnetes Motiv der Kategorie
 * (Symbole in index.html). Fehlt die Datei, gibt es nur Motive; lädt ein
 * Foto nicht, springt das Motiv ein. Fremder Inhalt in der Datei richtet
 * nichts an. Die Nachweise stehen auch in den Einstellungen.
 *
 * Ideen nehmen das Foto ihres ersten Orts mit Foto, sonst das Motiv ihrer
 * Kategorie; Filme bekommen nie ein Foto, sondern das Motiv ihres Genres und
 * einen Trailer-Link (YouTube-Suche). Termine zeigen aufgeklappt auch ihre
 * Einordnung.
 */
import { oeffne, DI, MI } from './hilfe.mjs';

const ORTSBILDER = {
  version: 1,
  stand: '2026-11-04',
  orte: {
    Thalia: 'thalia-theater-q1',
    Rindermarkthalle: 'kaputt-markthalle-q2',
    Docks: '../../böse',
    Kochschule: 'fremd-q3',
    'Hammer Park': 'hammer-park-q4',
  },
  bilder: {
    'thalia-theater-q1': {
      datei: 'File:Thalia Theater.jpg', objekt: 'Thalia Theater', wikidata: 'Q1', urheber: 'Testfotograf',
      lizenz: 'CC BY-SA 4.0', lizenzLink: 'https://creativecommons.org/licenses/by-sa/4.0', seite: 'https://commons.wikimedia.org/wiki/File:Thalia_Theater.jpg',
    },
    'kaputt-markthalle-q2': {
      datei: 'File:Markthalle.jpg', objekt: 'Rindermarkthalle', wikidata: 'Q2', urheber: 'Jemand',
      lizenz: 'CC BY 4.0', lizenzLink: 'https://creativecommons.org/licenses/by/4.0', seite: 'https://commons.wikimedia.org/wiki/File:Markthalle.jpg',
    },
    'fremd-q3': {
      datei: 'File:X.jpg', objekt: '<img src=x onerror=alert(1)>', urheber: '<b>fett</b>', lizenz: 'CC0', lizenzLink: 'javascript:alert(2)', seite: 'https://commons.wikimedia.org/wiki/File:X.jpg',
    },
    '../../böse': { objekt: 'Böse', urheber: 'x', lizenz: 'CC0', seite: 'https://example.org' },
    'hammer-park-q4': {
      datei: 'File:Hammer Park.jpg', objekt: 'Hammer Park', wikidata: 'Q4', urheber: 'Parkfreund', lizenz: 'CC BY 4.0',
      lizenzLink: 'https://creativecommons.org/licenses/by/4.0', seite: 'https://commons.wikimedia.org/wiki/File:Hammer_Park.jpg',
    },
  },
  ohne: {},
};

const A = await oeffne({ tag: DI, zeit: '10:00', ortsbilder: ORTSBILDER });
const { page, check } = A;
const karte = (titel, tag = DI) => page.locator(`#tag-${tag} .karte`, { hasText: titel });

// --- Ein Foto: klein vorn, groß beim Aufklappen, mit Nachweis
await A.zeigeTag(DI);
const theater = karte('Theater früh');
const klein = theater.locator('img.bildchen');
check(await klein.count() === 1 && (await klein.getAttribute('src')) === 'bilder/orte/thalia-theater-q1-klein.webp'
  && await klein.getAttribute('loading') === 'lazy' && await klein.getAttribute('alt') === '', 'Theater (Thalia): vorn das kleine Foto des Orts, faul geladen, ohne doppelte Ansage');
check(await theater.locator('.ortsfoto img').isHidden(), 'zugeklappt: das große Foto noch nicht');
await theater.locator('.kopfzeile').click();
const gross = theater.locator('.ortsfoto img');
check(await gross.isVisible() && (await gross.getAttribute('src')) === 'bilder/orte/thalia-theater-q1.webp' && await gross.getAttribute('alt') === 'Thalia Theater'
  && await klein.isHidden(), 'aufgeklappt: das Foto groß (das kleine verschwindet)');
const unter = theater.locator('.ortsfoto figcaption');
check((await unter.innerText()).includes('Thalia Theater · Foto: Testfotograf, CC BY-SA 4.0, Wikimedia Commons')
  && (await unter.locator('a', { hasText: 'CC BY-SA 4.0' }).getAttribute('href')) === 'https://creativecommons.org/licenses/by-sa/4.0'
  && (await unter.locator('a', { hasText: 'Wikimedia Commons' }).getAttribute('href')) === 'https://commons.wikimedia.org/wiki/File:Thalia_Theater.jpg',
'darunter: Ort, Fotograf, Lizenz (verlinkt) und die Dateiseite bei Commons');
check(await theater.locator('.mehr p').first().innerText() === 'Schauspiel, ca. 2 Stunden.', 'die Beschreibung folgt unter dem Foto');
check((await theater.locator('.mehr p.einordnung').innerText()).startsWith('Einordnung: Ein Klassiker in moderner Fassung'), '… und darunter die Einordnung');
check(await karte('Keane').locator('.einordnung').count() === 0, 'ohne Einordnung in den Daten keine leere Zeile');

// --- Ohne Foto: das Motiv der Kategorie
const konzert = karte('Keane');
check(await konzert.locator('.bildchen.motiv use').getAttribute('href') === '#m-konzert' && await konzert.locator('img.bildchen').count() === 0,
  'ein Ort ohne Foto (Sporthalle): das Motiv „Konzert“');

// --- Fremdes in der Datei richtet nichts an
check(await page.locator('#ansicht img[src*="böse"], #ansicht img[src*=".."]').count() === 0, 'ein Bildname mit ../ wird nicht genommen');
const workshop = karte('Workshop mittags');
await workshop.locator('.kopfzeile').click();
const fremd = workshop.locator('.ortsfoto figcaption');
check((await fremd.innerText()).startsWith('<img src=x onerror=alert(1)> · Foto: <b>fett</b>, CC0,') && await workshop.locator('.ortsfoto img').count() === 1
  && await workshop.locator('img[src="x"], b').count() === 0 && await fremd.locator('a[href^="javascript"]').count() === 0 && await fremd.locator('a').count() === 1,
'HTML in Objekt und Urheber bleibt Text, ein javascript:-Link zur Lizenz wird keiner');

// --- Ein Foto, das nicht lädt: das Motiv springt ein
await A.zeigeTag(MI);
const markt = karte('Nachtmarkt', MI);
await markt.scrollIntoViewIfNeeded();
await page.waitForFunction((tag) => !document.querySelector(`#tag-${tag} img.bildchen[src*="kaputt-"]`), MI, { timeout: 4000 }).catch(() => {});
check(await markt.locator('img.bildchen').count() === 0 && await markt.locator('.bildchen.motiv use').getAttribute('href') === '#m-markt',
  'lädt das Foto nicht (Nachtmarkt): statt eines kaputten Bilds das Motiv „Markt“');

// --- Ideen: das Foto ihres Orts oder das Motiv ihrer Kategorie
await page.locator('details[data-kat="sport"] > summary').click();
const tt = page.locator('#idee-i-tischtennis');
check((await tt.locator('img.bildchen').getAttribute('src')) === 'bilder/orte/hammer-park-q4-klein.webp', 'Idee mit Ort (Tischtennis im Park): das Foto ihres ersten Orts mit Foto');
await tt.locator('.kopfzeile').click();
check((await tt.locator('.ortsfoto figcaption').innerText()).startsWith('Hammer Park · Foto: Parkfreund, CC BY 4.0'), '… aufgeklappt groß, mit Nachweis');
await page.locator('details[data-kat="spiele"] > summary').click();
check(await page.locator('#idee-i-story-game .bildchen.motiv use').getAttribute('href') === '#m-spiele', 'Idee ohne Ort (Story-Game): das Motiv „Spiele“');
await page.locator('details[data-kat="kreativ"] > summary').click();
check(await page.locator('#idee-i-buegelperlen .bildchen.motiv use').getAttribute('href') === '#m-kreativ', '… Bügelperlen: „Kreativ“');

// --- Filme: das Motiv des Genres (das Besondere vor „Drama“) und ein Trailer-Link
await page.evaluate(() => { location.hash = '#filme'; });
await page.locator('.filme-seite').waitFor();
const pate = page.locator('#film-f-tt0068646');
check(await pate.locator('.bildchen.motiv use').getAttribute('href') === '#m-krimi' && await pate.locator('img').count() === 0, 'Film „Der Pate“ (Krimi, Drama): das Motiv „Krimi“, kein Foto');
check(await page.locator('#film-f-tt0111161 .bildchen.motiv use').getAttribute('href') === '#m-drama', '„Die Verurteilten“ (nur Drama): „Drama“');
await pate.locator('.kopfzeile').click();
const trailer = pate.locator('a', { hasText: 'Trailer' });
const tUrl = new URL(await trailer.getAttribute('href'));
check(await trailer.isVisible() && tUrl.origin === 'https://www.youtube.com' && tUrl.pathname === '/results' && tUrl.searchParams.get('search_query') === 'Der Pate 1972 Trailer'
  && await trailer.getAttribute('target') === '_blank', 'aufgeklappt: „▶ Trailer“ – die YouTube-Suche nach „Der Pate 1972 Trailer“, nichts eingebettet');
check(await page.locator('.filme-seite iframe').count() === 0, 'kein eingebettetes Video');
await page.click('[data-aktion="filme-zu"]');

// --- Alle Motive gibt es als Symbol
const motive = await page.evaluate(async () => {
  const { MOTIV_NAMEN } = await import('./js/bilder.js');
  return MOTIV_NAMEN.filter((m) => !document.getElementById(`m-${m}`));
});
check(motive.length === 0, `jedes Motiv hat sein Symbol in index.html${motive.length ? ` (fehlt: ${motive.join(', ')})` : ''}`);

// --- Nachweise in den Einstellungen
await A.reiter('einstellungen');
const nachweise = page.locator('.bildnachweise');
check(await nachweise.count() === 1 && (await nachweise.locator('summary').innerText()).startsWith('Fotos der Orte (4)'), 'Einstellungen: „Fotos der Orte (4) – Nachweise“');
await nachweise.locator('summary').click();
const liste = await nachweise.innerText();
check(liste.includes('Thalia Theater – Foto: Testfotograf, CC BY-SA 4.0, Wikimedia Commons') && liste.includes('<img src=x onerror=alert(1)>')
  && await nachweise.locator('img').count() === 0 && await nachweise.locator('a[href^="javascript"]').count() === 0,
'dort jedes Foto mit Nachweis – fremder Text bleibt Text, ein javascript:-Link wird keiner');
await A.ende({ schliessen: false });

// --- Ohne daten/ortsbilder.json: nur Motive, keine Fehler
const B = await oeffne({ tag: DI, browser: A.browser });
await B.zeigeTag(DI);
check(await B.page.locator('#ansicht img.bildchen').count() === 0 && await B.page.locator(`#tag-${DI} .karte .bildchen.motiv`).count() === await B.page.locator(`#tag-${DI} .karte`).count(),
  'ohne Datei: jede Karte mit Motiv, keine mit Foto');
check(await B.page.locator('.bildnachweise').count() === 0 || !(await B.page.locator('.bildnachweise').isVisible()), '… und keine Nachweise');
await B.ende();
