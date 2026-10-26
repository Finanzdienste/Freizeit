/*
 * Eine Karte für alles, was man unternehmen kann – Termin, Konzert, laufendes
 * Angebot, Ausflugsziel – und die kleine Fassung für die Landkarte.
 *
 * Erst wird aus den Daten ein „Eintrag“ gebaut: ein flaches Objekt mit allem,
 * was Karte, WhatsApp-Nachricht, Kalender und Bock-Haken brauchen. Sein
 * Schlüssel bleibt über die Montagsläufe hinweg gleich, solange der Lauf die
 * Kennung behält: t:<id>:<tag>, l:<id>, i:<id>.
 */
import { esc, kostenlos, REGIONEN, DRAUSSEN, sichererLink } from './text.js';
import { zeitAm, ende, uhrzeit, offen, abendVorArbeitstag, wochentagKurz, tagMonat } from './zeit.js';
import { whatsappLink, kalenderZiel } from './teilen.js';
import { meinBock } from './speicher.js';
import { andere } from './gemeinsam.js';

/** Die zuletzt gezeichneten Einträge, für Knöpfe wie „Bock“. */
const angezeigt = new Map();
export const eintragZu = (schluessel) => angezeigt.get(schluessel);
export const vergessen = () => angezeigt.clear();
export const merkeEintrag = (e) => { angezeigt.set(e.schluessel, e); return e; };

const kennung = (e) => e.id || `${e.titel}|${e.ort || ''}`.toLowerCase().replace(/\s+/g, '-');

/** Gemeinsame Felder aller Einträge. */
const basis = (e) => ({
  titel: e.titel,
  ort: e.ort || '',
  beschreibung: e.beschreibung || '',
  preis: e.preis || '',
  kostenlos: kostenlos(e),
  anreise: e.anreise || '',
  link: sichererLink(e.link),
  unsicher: e.unsicher || '',
  imdb: e.imdb || '',
  kategorie: e.kategorie || '',
  region: e.region || '',
  draussen: e.draussen || '',
  hohwacht: Boolean(e.hohwacht) || e.region === 'HB',
  geo: e.geo || null,
  kuenstler: Boolean(e.kuenstler),
  neu: Boolean(e.neu),
  ausverkauft: Boolean(e.ausverkauft),
  vorverkauf: e.vorverkauf || '',
  tipp: Boolean(e.tipp),
});

/** Ein Termin an einem bestimmten Tag. */
export function eintragTermin(e, tag, tage) {
  const i = e.ganztags ? null : ende(e, tag.datum);
  const zeigeEnde = i && i.art !== 'zeitraum' && !offen(e, tag.datum) && e.kategorie !== 'Party'
    && (i.art === 'bekannt' || abendVorArbeitstag(tag, tage));
  return {
    ...basis(e),
    quelle: 'termin',
    schluessel: `t:${kennung(e)}:${tag.datum}`,
    datum: tag.datum,
    zeit: zeitAm(e, tag.datum),
    ganztags: Boolean(e.ganztags),
    endeMin: i ? i.ende : null,
    endeText: zeigeEnde ? `bis ${i.art === 'bekannt' ? '' : 'ca. '}${uhrzeit(i.ende)}` : '',
  };
}

/** Ein Angebot, das über Tage oder Wochen läuft. */
export const eintragLaufend = (e) => ({
  ...basis(e),
  quelle: 'laufend',
  schluessel: `l:${kennung(e)}`,
  datum: null,
  von: e.von,
  bis: e.bis,
  zeit: e.zeit || '',
});

/** Ein Ausflugsziel aus „Geht immer“. */
export const eintragImmer = (e) => ({
  ...basis(e),
  quelle: 'immer',
  schluessel: `i:${kennung(e)}`,
  datum: null,
  zeit: e.zeiten || '',
  wetterabhaengig: Boolean(e.wetterabhaengig),
});

const marke = (text, art = '') => `<span class="marke${art ? ` ${art}` : ''}">${esc(text)}</span>`;

/** Wer hat Bock: die anderen als farbige Chips; wenn alle beide, ein Treffer. */
function werZeile(eintrag) {
  const leute = andere(eintrag.schluessel);
  if (!leute.length) return { html: '', treffer: false };
  const ich = meinBock(eintrag.schluessel);
  const namen = leute.map((p) => `<span class="person p${p.nr % 4}">${esc(p.name)}</span>`).join('');
  return {
    html: `<div class="wer">${namen}<span class="wer-text">${ich ? (leute.length === 1 ? 'und du habt Bock' : 'und du haben Bock') : (leute.length === 1 ? 'hat Bock' : 'haben Bock')}</span></div>`,
    treffer: ich,
  };
}

/** Kurz: wann. Für die Spalte links, wenn sie ein Datum statt der Uhrzeit zeigt. */
export function wannKurz(eintrag) {
  if (eintrag.datum) return `${wochentagKurz(eintrag.datum)} ${tagMonat(eintrag.datum)}`;
  if (eintrag.von && eintrag.bis) return `${tagMonat(eintrag.von)}–${tagMonat(eintrag.bis)}`;
  return 'jederzeit';
}

/** Der Bock-Knopf – auf der Karte und in der Landkarte. */
export const bockKnopf = (eintrag) => {
  const an = meinBock(eintrag.schluessel);
  return `<button type="button" class="knopf bock" data-bock="${esc(eintrag.schluessel)}" aria-pressed="${an}">${an ? 'Bock ✓' : 'Bock'}</button>`;
};

/**
 * Die Karte als HTML.
 * @param {object} eintrag
 * @param {object} [o]
 * @param {boolean} [o.zeitSpalte]  Uhrzeit links (Tageslisten)
 * @param {string}  [o.zeitText]    statt der Uhrzeit, z. B. „Mi 28.10.“ (Wir-Liste)
 */
export function karte(eintrag, o = {}) {
  angezeigt.set(eintrag.schluessel, eintrag);
  const zeit = o.zeitSpalte
    ? `<div class="zeit${eintrag.ganztags ? ' ganztags' : ''}">${o.zeitText ? esc(o.zeitText) : esc(eintrag.ganztags ? 'ganztägig' : (eintrag.zeit || '–'))}${eintrag.endeText && !o.zeitText ? `<span class="bis">${esc(eintrag.endeText)}</span>` : ''}</div>`
    : '';
  // Die Uhrzeit steht unten, wenn die linke Spalte etwas anderes zeigt oder es
  // keine Spalte gibt – und dann auch das Ende gleich dahinter.
  const zeitUnten = !o.zeitSpalte || eintrag.ganztags || Boolean(o.zeitText);
  const uhr = zeitUnten
    ? [eintrag.zeit + (o.zeitText && /\d$/.test(eintrag.zeit || '') ? ' Uhr' : ''), o.zeitText ? eintrag.endeText : ''].filter(Boolean).join(', ')
    : '';
  const unterzeile = [eintrag.ort, uhr].filter(Boolean).join(' · ');
  const marken = [
    eintrag.kuenstler ? marke('♫ Dein Künstler', 'kuenstler') : '',
    eintrag.neu ? marke('NEU', 'neu') : '',
    eintrag.ausverkauft ? marke('ausverkauft', 'warn') : '',
    eintrag.vorverkauf ? marke(`Vorverkauf ${eintrag.vorverkauf}`) : '',
    eintrag.tipp ? marke('passt zu dir') : '',
    eintrag.kostenlos ? marke('kostenlos', 'frei') : (eintrag.preis ? `<span class="preis">${esc(eintrag.preis)}</span>` : ''),
    eintrag.kategorie ? marke(eintrag.kategorie) : '',
    eintrag.imdb ? marke(`IMDb Top 250 · Platz ${eintrag.imdb}`) : '',
    eintrag.region ? marke(REGIONEN[eintrag.region] || eintrag.region, 'rand') : '',
    eintrag.draussen ? marke(`${DRAUSSEN[eintrag.draussen] || eintrag.draussen}${eintrag.quelle === 'immer' ? (eintrag.wetterabhaengig ? ' · wetterabhängig' : ' · bei jedem Wetter') : ''}`, 'rand') : '',
    eintrag.hohwacht ? marke('Hohwacht-Kombi', 'hohwacht') : '',
    eintrag.unsicher ? marke('unsicher', 'warn') : '',
  ].filter(Boolean).join('');
  const kal = kalenderZiel(eintrag);
  const wer = werZeile(eintrag);
  const klassen = ['karte', eintrag.hohwacht ? 'hohwacht' : '', eintrag.kuenstler ? 'kuenstler' : '', wer.treffer ? 'treffer' : '', o.zeitSpalte ? '' : 'ohne-zeit']
    .filter(Boolean).join(' ');
  return `<article class="${klassen}" id="k-${esc(eintrag.schluessel.replace(/[^a-z0-9-]/gi, '-'))}">${zeit}<div class="inhalt">
    <h3>${esc(eintrag.titel)}</h3>
    ${unterzeile ? `<div class="unter">${esc(unterzeile)}</div>` : ''}
    ${eintrag.beschreibung ? `<p>${esc(eintrag.beschreibung)}</p>` : ''}
    ${marken ? `<div class="marken">${marken}</div>` : ''}
    ${eintrag.unsicher ? `<div class="unsicher">${esc(eintrag.unsicher)}</div>` : ''}
    ${eintrag.anreise ? `<div class="anreise">Anreise: ${esc(eintrag.anreise)}</div>` : ''}
    ${wer.html}
    <div class="aktionen">
      ${bockKnopf(eintrag)}
      <a class="knopf" href="${esc(whatsappLink(eintrag))}" target="_blank" rel="noopener">WhatsApp</a>
      ${kal ? `<a class="knopf" href="${esc(kal.href)}"${kal.datei ? ` download="${esc(kal.datei)}"` : ' target="_blank" rel="noopener"'}>Kalender</a>` : ''}
      ${eintrag.link ? `<a class="quelle" href="${esc(eintrag.link)}" target="_blank" rel="noopener">Quelle</a>` : ''}
    </div>
  </div></article>`;
}

/** Alle Einträge der Daten, nach Schlüssel – damit die Wir-Liste den frischen Stand zeigt. */
export function alleEintraege(p) {
  const m = new Map();
  if (!p) return m;
  const tagVon = (iso) => p.tage.find((t) => t.datum === iso) || { datum: iso };
  for (const e of p.termine) for (const d of e.daten) { const x = eintragTermin(e, tagVon(d), p.tage); m.set(x.schluessel, x); }
  for (const e of p.laufend) { const x = eintragLaufend(e); m.set(x.schluessel, x); }
  for (const e of p.immer) { const x = eintragImmer(e); m.set(x.schluessel, x); }
  return m;
}
