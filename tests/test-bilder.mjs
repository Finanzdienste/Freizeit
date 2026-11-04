/*
 * Bilder an den Karten (js/bilder.js): ein freies Foto des Orts aus
 * daten/ortsbilder.json – zugeklappt klein vorn, aufgeklappt groß mit
 * Fotograf, Lizenz und Quelle –, sonst ein gezeichnetes Motiv der Kategorie
 * (Symbole in index.html). Fehlt die Datei, gibt es nur Motive; lädt ein
 * Foto nicht, springt das Motiv ein. Fremder Inhalt in der Datei richtet
 * nichts an. Die Nachweise stehen auch in den Einstellungen.
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

// --- Alle Motive gibt es als Symbol
const motive = await page.evaluate(async () => {
  const { MOTIV_NAMEN } = await import('./js/bilder.js');
  return MOTIV_NAMEN.filter((m) => !document.getElementById(`m-${m}`));
});
check(motive.length === 0, `jedes Motiv hat sein Symbol in index.html${motive.length ? ` (fehlt: ${motive.join(', ')})` : ''}`);

// --- Nachweise in den Einstellungen
await A.reiter('einstellungen');
const nachweise = page.locator('.bildnachweise');
check(await nachweise.count() === 1 && (await nachweise.locator('summary').innerText()).startsWith('Fotos der Orte (3)'), 'Einstellungen: „Fotos der Orte (3) – Nachweise“');
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
