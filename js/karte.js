/*
 * Eine Karte für alles, was man unternehmen kann – Termin, Wochenangebot,
 * Ausflugsziel, Konzert oder Merklisten-Eintrag.
 *
 * Erst wird aus den Daten ein „Eintrag“ gebaut: ein flaches Objekt mit allem,
 * was Karte, WhatsApp-Nachricht, Kalender und Merkliste brauchen. Gemerkt
 * wird genau dieser Eintrag – so bleibt er auch dann vollständig, wenn die
 * nächste Woche die Daten ersetzt hat.
 */
import { esc, kostenlos, REGIONEN, DRAUSSEN } from './text.js';
import { zeitAm, ende, uhrzeit, offen, abendVorArbeitstag } from './zeit.js';
import { whatsappLink, kalenderLink } from './teilen.js';
import { gemerkt } from './speicher.js';

/** Die zuletzt gezeichneten Einträge, für Knöpfe wie „Merken“. */
const angezeigt = new Map();
export const eintragZu = (schluessel) => angezeigt.get(schluessel);
export const vergessen = () => angezeigt.clear();

const kennung = (e) => e.id || `${e.titel}|${e.ort || ''}`.toLowerCase().replace(/\s+/g, '-');

/** Gemeinsame Felder aller Einträge aus der Wochenübersicht. */
const basis = (e) => ({
  titel: e.titel,
  ort: e.ort || '',
  beschreibung: e.beschreibung || '',
  preis: e.preis || '',
  kostenlos: kostenlos(e),
  anreise: e.anreise || '',
  link: e.link || '',
  unsicher: e.unsicher || '',
  imdb: e.imdb || '',
  kategorie: e.kategorie || '',
  region: e.region || '',
  draussen: e.draussen || '',
  hohwacht: Boolean(e.hohwacht) || e.region === 'HB',
});

/** Ein Termin an einem bestimmten Tag. */
export function eintragTermin(e, tag, tage) {
  const i = e.ganztags ? null : ende(e, tag.datum);
  const zeigeEnde = i && i.art !== 'zeitraum' && !offen(e, tag.datum) && e.kategorie !== 'Party'
    && (i.art === 'bekannt' || abendVorArbeitstag(tag, tage));
  return {
    ...basis(e),
    quelle: 'termin',
    schluessel: `termin:${kennung(e)}:${tag.datum}`,
    datum: tag.datum,
    zeit: zeitAm(e, tag.datum),
    ganztags: Boolean(e.ganztags),
    endeMin: i ? i.ende : null,
    endeText: zeigeEnde ? `bis ${i.art === 'bekannt' ? '' : 'ca. '}${uhrzeit(i.ende)}` : '',
  };
}

/** Ein Angebot, das die ganze Woche läuft. */
export const eintragWoche = (e, woche) => ({
  ...basis(e),
  quelle: 'woche',
  schluessel: `woche:${kennung(e)}:${woche.von}`,
  datum: null,
  von: woche.von,
  bis: woche.bis,
  zeit: e.zeit || '',
});

/** Ein Ausflugsziel aus „Geht immer“. */
export const eintragImmer = (e) => ({
  ...basis(e),
  quelle: 'immer',
  schluessel: `immer:${kennung(e)}`,
  datum: null,
  zeit: e.zeiten || '',
  wetterabhaengig: Boolean(e.wetterabhaengig),
});

/** Ein Konzert aus dem Musikcheck. */
export const eintragKonzert = (k) => ({
  titel: k.kuenstler,
  untertitel: k.titel || '',
  ort: [k.ort, k.stadt].filter(Boolean).join(', '),
  beschreibung: [k.titel, k.hinweis].filter(Boolean).join('. '),
  preis: k.preis || '',
  kostenlos: false,
  anreise: k.anreise || '',
  link: k.link || '',
  unsicher: '',
  imdb: '',
  kategorie: 'Konzert',
  region: '',
  draussen: '',
  hohwacht: false,
  quelle: 'konzert',
  schluessel: `konzert:${k.id || `${k.kuenstler}|${k.datum}|${k.ort || ''}`.toLowerCase()}`,
  datum: k.datum,
  zeit: k.zeit || '',
  ganztags: false,
  endeMin: null,
  endeText: '',
  neu: Boolean(k.neu),
  ausverkauft: Boolean(k.ausverkauft),
  vorverkauf: k.vorverkauf || '',
  tipp: Boolean(k.tipp),
});

const marke = (text, art = '') => `<span class="marke${art ? ` ${art}` : ''}">${esc(text)}</span>`;

/**
 * Die Karte als HTML.
 * @param {object} eintrag
 * @param {object} [o]
 * @param {boolean} [o.zeitSpalte]  Uhrzeit links (Tagesliste, Konzerte)
 * @param {string}  [o.zeitText]    statt der Uhrzeit, z. B. „Mi 28.10.“
 * @param {boolean} [o.entfernen]   „Entfernen“ statt „Merken“ (Merkliste)
 */
export function karte(eintrag, o = {}) {
  angezeigt.set(eintrag.schluessel, eintrag);
  const zeit = o.zeitSpalte
    ? `<div class="zeit${eintrag.ganztags ? ' ganztags' : ''}">${o.zeitText ? esc(o.zeitText) : esc(eintrag.ganztags ? 'ganztägig' : (eintrag.zeit || '–'))}${eintrag.endeText && !o.zeitText ? `<span class="bis">${esc(eintrag.endeText)}</span>` : ''}</div>`
    : '';
  // Die Uhrzeit steht unten, wenn die linke Spalte etwas anderes zeigt
  // (Datum bei Konzerten und in der Merkliste) oder es keine Spalte gibt –
  // und dann auch das Ende gleich dahinter: „17:30 Uhr, bis ca. 19:00“.
  const zeitUnten = !o.zeitSpalte || eintrag.ganztags || Boolean(o.zeitText);
  const uhr = zeitUnten
    ? [eintrag.zeit + (o.zeitText && /\d$/.test(eintrag.zeit || '') ? ' Uhr' : ''), o.zeitText ? eintrag.endeText : ''].filter(Boolean).join(', ')
    : '';
  const unterzeile = [eintrag.ort, uhr].filter(Boolean).join(' · ');
  const marken = [
    eintrag.kostenlos ? marke('kostenlos', 'frei') : (eintrag.preis ? `<span class="preis">${esc(eintrag.preis)}</span>` : ''),
    eintrag.neu ? marke('NEU', 'neu') : '',
    eintrag.ausverkauft ? marke('ausverkauft', 'warn') : '',
    eintrag.vorverkauf ? marke(`Vorverkauf ${eintrag.vorverkauf}`) : '',
    eintrag.tipp ? marke('passt zu dir') : '',
    eintrag.kategorie && eintrag.quelle !== 'konzert' ? marke(eintrag.kategorie) : '',
    eintrag.imdb ? marke(`IMDb Top 250 · Platz ${eintrag.imdb}`) : '',
    eintrag.region ? marke(REGIONEN[eintrag.region] || eintrag.region, 'rand') : '',
    eintrag.draussen ? marke(`${DRAUSSEN[eintrag.draussen] || eintrag.draussen}${eintrag.quelle === 'immer' ? (eintrag.wetterabhaengig ? ' · wetterabhängig' : ' · bei jedem Wetter') : ''}`, 'rand') : '',
    eintrag.hohwacht ? marke('Hohwacht-Kombi', 'hohwacht') : '',
    eintrag.unsicher ? marke('unsicher', 'warn') : '',
  ].filter(Boolean).join('');
  const kal = kalenderLink(eintrag);
  const istGemerkt = gemerkt(eintrag.schluessel);
  const merkKnopf = o.entfernen
    ? `<button type="button" class="knopf" data-entfernen="${esc(eintrag.schluessel)}">Entfernen</button>`
    : `<button type="button" class="knopf merken" data-merken="${esc(eintrag.schluessel)}" aria-pressed="${istGemerkt}">${istGemerkt ? 'Gemerkt' : 'Merken'}</button>`;
  return `<article class="karte${eintrag.hohwacht ? ' hohwacht' : ''}${o.zeitSpalte ? '' : ' ohne-zeit'}">${zeit}<div class="inhalt">
    <h3>${esc(eintrag.titel)}</h3>
    ${unterzeile ? `<div class="unter">${esc(unterzeile)}</div>` : ''}
    ${eintrag.beschreibung ? `<p>${esc(eintrag.beschreibung)}</p>` : ''}
    ${marken ? `<div class="marken">${marken}</div>` : ''}
    ${eintrag.unsicher ? `<div class="unsicher">${esc(eintrag.unsicher)}</div>` : ''}
    ${eintrag.anreise ? `<div class="anreise">Anreise: ${esc(eintrag.anreise)}</div>` : ''}
    <div class="aktionen">
      ${merkKnopf}
      <a class="knopf" href="${esc(whatsappLink(eintrag))}" target="_blank" rel="noopener">WhatsApp</a>
      ${kal ? `<a class="knopf" href="${esc(kal)}" target="_blank" rel="noopener">Kalender</a>` : ''}
      ${eintrag.link ? `<a class="quelle" href="${esc(eintrag.link)}" target="_blank" rel="noopener">Quelle</a>` : ''}
    </div>
  </div></article>`;
}
