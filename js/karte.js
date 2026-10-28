/*
 * Eine Karte für alles, was man unternehmen kann – Termin, Konzert, laufendes
 * Angebot, Ausflugsziel – und die kleine Fassung für die Landkarte.
 *
 * Erst wird aus den Daten ein „Eintrag“ gebaut: ein flaches Objekt mit allem,
 * was Karte, WhatsApp-Nachricht, Kalender und Bock-Haken brauchen. Sein
 * Schlüssel bleibt über die Montagsläufe hinweg gleich, solange der Lauf die
 * Kennung behält: t:<id>:<tag>, l:<id>. Ideen und Eingeplantes (i:, e:, p:)
 * baut ideen.js; gezeichnet werden Eingeplantes hier, Ideen in ansicht-ideen.js.
 */
import {
  esc, kostenlos, preisSagtWas, REGIONEN, DRAUSSEN, sichererLink,
} from './text.js';
import { zeitAm, ende, uhrzeit, offen, abendVorArbeitstag, wochentagKurz, tagMonat } from './zeit.js';
import { whatsappLink, kalenderZiel } from './teilen.js';
import { WO } from './ideen.js';
import { zeitZeile } from './zeiten.js';
import { aktuell, meinBock } from './speicher.js';
import { bezugVon, entfernung, entfernungText } from './standort.js';
import {
  andere, rolle, gastgeberName, mitWem, treffer,
} from './gemeinsam.js';

/** Die zuletzt gezeichneten Einträge, für Knöpfe wie „Bock“. */
const angezeigt = new Map();
export const eintragZu = (schluessel) => angezeigt.get(schluessel);
export const vergessen = () => angezeigt.clear();
export const merkeEintrag = (e) => { angezeigt.set(e.schluessel, e); return e; };

/**
 * Eine Karte zeigt erst das Nötige – Zeit, Titel, Ort, wer Bock hat, der
 * Bock-Knopf. Ein Tipp auf den Titel klappt den Rest auf: Beschreibung,
 * alle Marken, Anreise, WhatsApp, Kalender, Quelle. Was aufgeklappt ist,
 * bleibt es beim Neuzeichnen.
 */
const aufgeklappt = new Set();
export const istAuf = (schluessel) => aufgeklappt.has(schluessel);
export function aufklappen(schluessel) {
  if (aufgeklappt.has(schluessel)) aufgeklappt.delete(schluessel);
  else aufgeklappt.add(schluessel);
  return aufgeklappt.has(schluessel);
}
/**
 * Aufklappbare Abschnitte (Filter, Highlights …) als <details data-offen>:
 * Was man aufklappt, bleibt beim Neuzeichnen offen. Nur, was man selbst
 * antippt – app.js hört auf den Tipp auf die Zusammenfassung.
 */
const offeneAbschnitte = new Set();
export const abschnittAuf = (name) => offeneAbschnitte.has(name);
export function abschnittUmschalten(name, auf) {
  if (auf) offeneAbschnitte.add(name); else offeneAbschnitte.delete(name);
}
/** Ein aufklappbarer Abschnitt; `zahl` steht als Marke an der Zusammenfassung (etwa aktive Filter). */
export function aufklappbar(name, titel, inhalt, { zahl = 0, klasse = '' } = {}) {
  return `<details class="aufklappbar${klasse ? ` ${klasse}` : ''}" data-offen="${esc(name)}"${abschnittAuf(name) ? ' open' : ''}>
    <summary><span>${titel}</span>${zahl ? `<span class="zahl-marke">${zahl}</span>` : ''}</summary>
    <div class="aufklappbar-inhalt">${inhalt}</div>
  </details>`;
}

/** Die Kopfzeile einer Karte: Titel als Schalter fürs Aufklappen. */
export const kopfzeile = (eintrag, titel = eintrag.titel) => `<div class="kopfzeile" role="button" tabindex="0" data-auf="${esc(eintrag.schluessel)}" aria-expanded="${istAuf(eintrag.schluessel)}">
      <h3>${esc(titel)}</h3><span class="chevron" aria-hidden="true"></span></div>`;

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

const marke = (text, art = '') => `<span class="marke${art ? ` ${art}` : ''}">${esc(text)}</span>`;

const chips = (leute) => leute.map((p) => `<span class="person p${p.nr % 4}">${esc(p.name)}</span>`).join('');

/**
 * Wer hat Bock: die anderen als farbige Chips. Der Gastgeber sieht, wer mit
 * ihm will und wer es ohne ihn macht; die anderen sehen nur den Gastgeber.
 * Treffer: siehe treffer() in gemeinsam.js.
 */
export function werZeile(eintrag) {
  const leute = andere(eintrag.schluessel);
  if (!leute.length) return { html: '', treffer: false };
  const ich = meinBock(eintrag.schluessel);
  const teile = [];
  if (rolle() === 'gastgeber') {
    const mit = leute.filter((p) => p.mitwem === 'gastgeber');
    const ohne = leute.filter((p) => p.mitwem === 'andere');
    if (mit.length) teile.push(`${chips(mit)}<span class="wer-text">${mit.length === 1 ? 'will' : 'wollen'} mit dir${ich ? ' – du auch' : ''}</span>`);
    if (ohne.length) teile.push(`${chips(ohne)}<span class="wer-text">${ohne.length === 1 ? "macht's" : "machen's"} ohne dich</span>`);
  } else {
    const zusammen = ich && mitWem(aktuell().bock[eintrag.schluessel]) === 'gastgeber';
    const einer = leute.length === 1;
    teile.push(`${chips(leute)}<span class="wer-text">${zusammen ? 'und du habt Bock' : `${einer ? 'hat' : 'haben'}${ich ? ' auch' : ''} Bock`}</span>`);
  }
  return { html: `<div class="wer">${teile.join('')}</div>`, treffer: treffer(eintrag.schluessel) };
}

/** Kurz: wann. Für die Spalte links, wenn sie ein Datum statt der Uhrzeit zeigt. */
export function wannKurz(eintrag) {
  if (eintrag.datum) return `${wochentagKurz(eintrag.datum)} ${tagMonat(eintrag.datum)}`;
  if (eintrag.von && eintrag.bis) return `${tagMonat(eintrag.von)}–${tagMonat(eintrag.bis)}`;
  return 'jederzeit';
}

/**
 * Der Bock-Knopf – auf der Karte, bei den Ideen und in der Landkarte. Wer
 * eingeladen ist, wählt zwischen zwei Knöpfen: mit dem Gastgeber oder
 * allein bzw. mit anderen. Die Hülle trägt den Schlüssel, damit app.js nach
 * einem Tipp alle Knöpfe desselben Eintrags neu zeichnen kann.
 */
export function bockKnopf(eintrag) {
  const k = esc(eintrag.schluessel);
  const an = meinBock(eintrag.schluessel);
  if (rolle() !== 'mitglied') {
    return `<span class="bock-feld" data-bock-feld="${k}"><button type="button" class="knopf bock" data-bock="${k}" aria-pressed="${an}">${an ? 'Bock ✓' : 'Bock'}</button></span>`;
  }
  const wie = an ? mitWem(aktuell().bock[eintrag.schluessel]) : '';
  const knopf = (mitwem, text) => `<button type="button" class="knopf bock" data-bock="${k}" data-mitwem="${mitwem}" aria-pressed="${wie === mitwem}">${text}${wie === mitwem ? ' ✓' : ''}</button>`;
  return `<span class="bock-feld wahl" data-bock-feld="${k}" role="group" aria-label="Bock">${knopf('gastgeber', `Mit ${esc(gastgeberName() || 'Gastgeber')}`)}${knopf('andere', 'Allein/mit anderen')}</span>`;
}

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
  // Mit Bezugspunkt steht die Entfernung (Luftlinie) gleich hinter dem Ort.
  const km = entfernung(bezugVon(aktuell()), eintrag.geo);
  const unterzeile = [eintrag.ort, km === null ? '' : entfernungText(km), uhr, eintrag.kategorie].filter(Boolean).join(' · ');
  // Zugeklappt nur, was beim Entscheiden hilft; der Rest nach dem Aufklappen.
  const wichtig = [
    eintrag.quelle === 'plan' ? marke('Eingeplant', 'plan') : '',
    eintrag.kuenstler ? marke('♫ Dein Künstler', 'kuenstler') : '',
    eintrag.neu ? marke('NEU', 'neu') : '',
    eintrag.ausverkauft ? marke('ausverkauft', 'warn') : '',
    eintrag.vorverkauf ? marke(`Vorverkauf ${eintrag.vorverkauf}`) : '',
    eintrag.tipp ? marke('passt zu dir') : '',
    eintrag.kostenlos ? marke('kostenlos', 'frei') : (preisSagtWas(eintrag.preis) ? `<span class="preis">${esc(eintrag.preis)}</span>` : ''),
    eintrag.unsicher ? marke('unsicher', 'warn') : '',
  ].filter(Boolean).join('');
  const mehr = [
    eintrag.imdb ? marke(`IMDb Top 250 · Platz ${eintrag.imdb}`) : '',
    // Eine Idee sagt, wo sie spielt (Zuhause, Hamburg, Ausflug) – nicht ihre Region.
    eintrag.quelle === 'idee' ? (WO[eintrag.wo] ? marke(WO[eintrag.wo], 'rand') : '')
      : (eintrag.region ? marke(REGIONEN[eintrag.region] || eintrag.region, 'rand') : ''),
    eintrag.draussen ? marke(DRAUSSEN[eintrag.draussen] || eintrag.draussen, 'rand') : '',
    eintrag.hohwacht ? marke('Hohwacht-Kombi', 'hohwacht') : '',
  ].filter(Boolean).join('');
  const kal = kalenderZiel(eintrag);
  const wer = werZeile(eintrag);
  const klassen = ['karte', istAuf(eintrag.schluessel) ? 'auf' : '', eintrag.hohwacht ? 'hohwacht' : '', eintrag.kuenstler ? 'kuenstler' : '', wer.treffer ? 'treffer' : '', o.zeitSpalte ? '' : 'ohne-zeit']
    .filter(Boolean).join(' ');
  return `<article class="${klassen}" id="k-${esc(eintrag.schluessel.replace(/[^a-z0-9-]/gi, '-'))}">${zeit}<div class="inhalt">
    ${kopfzeile(eintrag)}
    ${unterzeile ? `<div class="unter">${esc(unterzeile)}</div>` : ''}
    ${wichtig ? `<div class="marken">${wichtig}</div>` : ''}
    ${wer.html}
    ${zeitZeile(eintrag)}
    <div class="mehr">
      ${eintrag.beschreibung ? `<p>${esc(eintrag.beschreibung)}</p>` : ''}
      ${mehr ? `<div class="marken">${mehr}</div>` : ''}
      ${eintrag.unsicher ? `<div class="unsicher">${esc(eintrag.unsicher)}</div>` : ''}
      ${eintrag.anreise ? `<div class="anreise">Anreise: ${esc(eintrag.anreise)}</div>` : ''}
    </div>
    <div class="aktionen">
      ${bockKnopf(eintrag)}
      <span class="mehr aktionen-mehr">
        <a class="knopf" href="${esc(whatsappLink(eintrag))}" target="_blank" rel="noopener">WhatsApp</a>
        ${kal ? `<a class="knopf" href="${esc(kal.href)}"${kal.datei ? ` download="${esc(kal.datei)}"` : ' target="_blank" rel="noopener"'}>Kalender</a>` : ''}
        ${eintrag.link ? `<a class="quelle" href="${esc(eintrag.link)}" target="_blank" rel="noopener">Quelle</a>` : ''}
      </span>
    </div>
  </div></article>`;
}

/** Alle Einträge der Daten und alle Ideen, nach Schlüssel – damit die Wir-Liste den frischen Stand zeigt. */
export function alleEintraege(p, ideen = []) {
  const m = new Map();
  for (const x of ideen) m.set(x.schluessel, x);
  if (!p) return m;
  const tagVon = (iso) => p.tage.find((t) => t.datum === iso) || { datum: iso };
  for (const e of p.termine) for (const d of e.daten) { const x = eintragTermin(e, tagVon(d), p.tage); m.set(x.schluessel, x); }
  for (const e of p.laufend) { const x = eintragLaufend(e); m.set(x.schluessel, x); }
  return m;
}
