/*
 * Reiter „Programm“, die Kalenderansichten: Monat, Woche und Tag – wie bei
 * Google, mit dem, was die App weiß. Die vierte Ansicht, die Liste, zeichnet
 * ansicht-programm.js; den Schalter zwischen allen vieren gibt es hier.
 *
 *   Monat   Blatt mit der Zahl der Termine je Tag (nach Filtern und
 *           21:30-Regel – dieselbe Auswahl wie im Programm) und Punkten,
 *           wer Bock hat. Ein Tipp auf einen Tag öffnet den Tag.
 *   Woche   sieben Spalten von 7 bis 24 Uhr: dunkel, wo der Gastgeber laut
 *           Kalender belegt ist (zeiten.js), darauf als Chips, was zählt –
 *           Haken, Eingeplantes, Treffer. Oben je Tag, wie viele Termine es
 *           gibt; ein Tipp öffnet den Tag, ein Tipp auf einen Chip die Karte.
 *   Tag     ein Zeitstreifen mit belegten Zeiten und den Haken, darunter
 *           alle Termine des Tages als Karten.
 *
 * Monate nach dem Programm zeigen nur noch Konzerte der eigenen Künstler und
 * Eingeplantes.
 */
import { esc, anzahl } from './text.js';
import {
  monatsRaster, monatVon, monatPlus, monatJahr, datumMitTag, montag, plusTage, kalenderwoche, wochentagKurz, tagMonat,
  beginn, ende, zeitAm, uhrzeit, jetztMinuten,
} from './zeit.js';
import { termineAm, laufendZwischen, letzterTag, filterAn, filterFuer, umkreisAn } from './filter.js';
import { knopfName } from './standort.js';
import { karte, eintragTermin, merkeEintrag } from './karte.js';
import { meinBock } from './speicher.js';
import { andere, treffer as istTreffer, rolle, gastgeberName } from './gemeinsam.js';
import { geplante } from './ideen.js';
import { belegtAm, bekannt } from './zeiten.js';

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const ANSICHTEN = [['liste', 'Liste'], ['monat', 'Monat'], ['woche', 'Woche'], ['tag', 'Tag']];

/** Die Schalter Liste · Monat · Woche · Tag und der Knopf „Heute“. */
export function ansichtSchalter(ansicht, heuteSchon) {
  return `<div class="kal-schalter" role="tablist" aria-label="Ansicht">
    ${ANSICHTEN.map(([k, t]) => `<button type="button" role="tab" class="schalter" data-kal-ansicht="${k}" aria-selected="${k === ansicht}" aria-pressed="${k === ansicht}">${t}</button>`).join('')}
    <button type="button" class="knopf klein" data-aktion="kal-heute"${heuteSchon ? ' disabled' : ''}>Heute</button>
  </div>`;
}
const VON = 7 * 60;
const BIS = 24 * 60;
const TAG = 24 * 60;

/** Von diesem Monat bis zum Monat des letzten Termins oder Plans. */
export function monatsBereich(p, heute) {
  const erster = monatVon(heute);
  const bis = p ? letzterTag(p, geplante().map((e) => e.datum)) : heute;
  const letzter = monatVon(bis > heute ? bis : heute);
  return { erster, letzter };
}

/** Der erste und der letzte Tag, den der Kalender zeigt. */
export function tagesBereich(p, heute) {
  const { letzter } = monatsBereich(p, heute);
  const d = new Date(`${letzter}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return { erster: `${monatVon(heute)}-01`, letzter: d.toISOString().slice(0, 10) };
}

/** Wer an einem Tag Bock hat: ich (0) und die anderen nach ihrer Nummer. */
function punkte(eintraege) {
  const wer = new Set();
  let treffer = false;
  for (const x of eintraege) {
    const ich = meinBock(x.schluessel);
    const sie = andere(x.schluessel);
    if (ich) wer.add('ich');
    for (const p of sie) wer.add(`p${p.nr % 4}`);
    if (istTreffer(x.schluessel)) treffer = true;
  }
  return { wer: [...wer], treffer };
}

/** Alle Einträge eines Tages, wie das Programm sie zeigt, dazu Eingeplantes. */
function tagesEintraege(p, d, f, plaene) {
  const { tag, liste, spaet } = termineAm(p, d, f);
  return { tag, spaet, eintraege: [...plaene.filter((e) => e.datum === d), ...liste.map((e) => eintragTermin(e, tag, p.tage))] };
}

/** Was im Kalender als Chip zählt: eigene Haken, Haken der anderen, Eingeplantes. */
const zaehlt = (e) => e.quelle === 'plan' || meinBock(e.schluessel) || andere(e.schluessel).length > 0;

const prozent = (t) => `${(((Math.min(Math.max(t, VON), BIS) - VON) / (BIS - VON)) * 100).toFixed(2)}%`;
const blockText = ([a, b]) => `${uhrzeit(a)}–${b >= TAG ? '24:00' : uhrzeit(b)}`;
const belegtHtml = (d, senkrecht) => belegtAm(d).filter(([a, b]) => b > VON && a < BIS)
  .map(([a, b]) => `<i class="belegt" style="${senkrecht ? 'top' : 'left'}:${prozent(a)};${senkrecht ? 'height' : 'width'}:calc(${prozent(b)} - ${prozent(a)})" title="belegt ${esc(blockText([a, b]))}"></i>`)
  .join('');

/** Farbe eines Chips: Treffer, eigener Haken, Haken der anderen, Eingeplantes. */
function chipKlasse(e) {
  if (istTreffer(e.schluessel)) return 'treffer';
  if (meinBock(e.schluessel)) return 'ich';
  const sie = andere(e.schluessel);
  if (sie.length) return `p${sie[0].nr % 4}`;
  return 'plan';
}

/** Beginn und Ende eines Eintrags in Minuten des Tages – ganztägig ohne. */
function spanne(e) {
  if (e.ganztags) return null;
  const b = beginn(zeitAm(e, e.datum));
  if (b === null) return null;
  const i = ende(e, e.datum);
  const bis = i && i.ende > b ? Math.min(i.ende, TAG) : Math.min(b + 120, TAG);
  return [b, Math.max(bis, b + 30)];
}

/** Chips, die sich überschneiden, nebeneinander: höchstens zwei Spalten, dann versetzt. */
function spalten(chips) {
  const ergebnis = [];
  const enden = [];
  for (const c of [...chips].sort((x, y) => x.von - y.von || y.bis - x.bis)) {
    let s = enden.findIndex((e) => e <= c.von);
    if (s < 0) s = Math.min(enden.length, 1 + ((enden.length - 1) % 2));
    enden[s] = c.bis;
    ergebnis.push({ ...c, spalte: Math.min(s, 1), versetzt: s > 1 });
  }
  return ergebnis;
}

const anker = (e) => `k-${esc(e.schluessel.replace(/[^a-z0-9-]/gi, '-'))}`;
const merkeAlle = (liste) => liste.forEach((e) => merkeEintrag(e));

function wochenSpalte(p, d, f, plaene, heute) {
  const { eintraege } = tagesEintraege(p, d, f, plaene);
  const wichtig = eintraege.filter(zaehlt);
  merkeAlle(wichtig);
  const ganz = wichtig.filter((e) => !spanne(e));
  const chips = spalten(wichtig.map((e) => ({ e, s: spanne(e) })).filter((x) => x.s).map(({ e, s }) => ({ e, von: s[0], bis: s[1] })));
  const zweispaltig = chips.some((x) => x.spalte);
  const chipHtml = chips.map((c) => `<button type="button" class="chip ${chipKlasse(c.e)}${c.versetzt ? ' versetzt' : ''}" data-zu-eintrag="${anker(c.e)}" data-tag="${d}"
      style="top:${prozent(c.von)};height:calc(${prozent(c.bis)} - ${prozent(c.von)});left:${c.spalte ? '50%' : '0'};width:${zweispaltig ? '50%' : '100%'}"
      title="${esc(`${uhrzeit(c.von)} ${c.e.titel}`)}"><span>${esc(c.e.titel)}</span></button>`).join('');
  const jetzt = d === heute ? `<i class="jetzt" style="top:${prozent(jetztMinuten())}"></i>` : '';
  const klassen = ['wo-spalte', d === heute ? 'wo-heute' : '', d < heute ? 'vorbei' : ''].filter(Boolean).join(' ');
  return `<div class="${klassen}" data-wo-tag="${d}">
    <button type="button" class="wo-kopf" data-tag="${d}" aria-label="${esc(datumMitTag(d))}: ${anzahl(eintraege.length, 'Termin', 'Termine')}">
      <span class="wo-wt">${esc(wochentagKurz(d))}</span><span class="wo-nr">${Number(d.slice(8))}</span>${eintraege.length ? `<span class="wo-zahl">${eintraege.length}</span>` : ''}
    </button>
    <div class="wo-ganz">${ganz.map((e) => `<button type="button" class="chip ganz ${chipKlasse(e)}" data-zu-eintrag="${anker(e)}" data-tag="${d}"><span>${esc(e.titel)}</span></button>`).join('')}</div>
    <div class="wo-zeit">${belegtHtml(d, true)}${chipHtml}${jetzt}</div>
  </div>`;
}

function wochenAnsicht(p, st, heute, mo, plaene) {
  const tage = Array.from({ length: 7 }, (_, i) => plusTage(mo, i));
  const stunden = [];
  for (let h = 8; h < 24; h += 2) stunden.push(`<i style="top:${prozent(h * 60)}">${h}</i>`);
  const zeiten = tage.some((d) => bekannt(d));
  const n = esc(gastgeberName() || 'der Gastgeber');
  return `<div class="woche-raster" role="grid" aria-label="Woche ab ${esc(tagMonat(mo))}">
    <div class="wo-rail"><div class="wo-kopf leer"></div><div class="wo-ganz"></div><div class="wo-zeit">${stunden.join('')}</div></div>
    ${tage.map((d) => wochenSpalte(p, d, filterFuer(st), plaene, heute)).join('')}
  </div>
  <div class="legende">
    ${zeiten ? `<span><i class="feld-mini belegt"></i> ${rolle() === 'gastgeber' ? 'du bist belegt (Kalender)' : `${n} ist belegt`}</span>` : ''}
    <span><i class="chip-mini ich"></i> dein Haken</span><span><i class="chip-mini p0"></i> die anderen</span><span><i class="chip-mini treffer"></i> Treffer</span><span><i class="chip-mini plan"></i> eingeplant</span>
  </div>
  <p class="fein">Oben je Tag die Zahl aller Termine – ein Tipp darauf öffnet den Tag.${zeiten ? '' : (rolle() ? ' Belegte Zeiten aus dem Kalender stehen hier, sobald welche da sind.' : ' Im gemeinsamen Plan steht hier auch, wann der Gastgeber Zeit hat.')}</p>`;
}

function monatsAnsicht(p, st, heute, monat, plaene) {
  const raster = monatsRaster(monat);
  const f = filterFuer(st);
  const felder = raster.map((d) => {
    const imMonat = monatVon(d) === monat;
    const { eintraege } = tagesEintraege(p, d, f, plaene);
    const { wer, treffer } = punkte(eintraege);
    const klassen = ['feld', imMonat ? '' : 'fremd', d < heute ? 'vorbei' : '', d === heute ? 'heute' : '', d > p.bis ? 'ohne' : '', treffer ? 'treffer' : '']
      .filter(Boolean).join(' ');
    const termine = eintraege.filter((e) => e.quelle !== 'plan').length;
    const zahl = termine ? `<span class="zahl">${termine}</span>` : '';
    const dots = wer.length ? `<span class="punkte">${wer.map((w) => `<i class="pkt ${w}"></i>`).join('')}</span>` : '';
    return `<button type="button" class="${klassen}" data-tag="${d}" aria-label="${esc(datumMitTag(d))}: ${anzahl(termine, 'Termin', 'Termine')}${wer.length ? ', mit Bock' : ''}">
      <span class="nr">${Number(d.slice(8))}</span>${zahl}${dots}</button>`;
  }).join('');
  return `<div class="kalender" role="group" aria-label="${esc(monatJahr(`${monat}-01`))}">
    ${WOCHENTAGE.map((w) => `<div class="wt">${w}</div>`).join('')}
    ${felder}
  </div>
  <div class="legende"><span><i class="pkt ich"></i> du</span><span><i class="pkt p0"></i><i class="pkt p1"></i> die anderen</span><span><span class="feld-mini treffer"></span> Treffer</span><span>Zahl: Termine am Tag</span></div>`;
}

function tagesAnsicht(p, st, tag, plaene) {
  const f = filterFuer(st);
  const { tag: t, spaet, eintraege } = tagesEintraege(p, tag, f, plaene);
  const laufend = laufendZwischen(p, tag, tag, f);
  const wichtig = eintraege.filter(zaehlt);
  const marker = wichtig.map((e) => ({ e, s: spanne(e) })).filter((x) => x.s)
    .map(({ e, s }) => `<i class="marker ${chipKlasse(e)}" style="left:${prozent(s[0])};width:calc(${prozent(s[1])} - ${prozent(s[0])})" title="${esc(`${uhrzeit(s[0])} ${e.titel}`)}"></i>`).join('');
  const streifen = bekannt(tag) || wichtig.length ? `<div class="tag-streifen" aria-label="Zeitstreifen">
      <div class="zr-skala">${[8, 12, 16, 20, 24].map((h) => `<i style="left:${prozent(h * 60)}">${h}</i>`).join('')}</div>
      <div class="zr-balken">${belegtHtml(tag, false)}${marker}</div>
    </div>` : '';
  const n = esc(gastgeberName() || 'der Gastgeber');
  const belegt = belegtAm(tag).filter(([a, b]) => b > VON && a < BIS);
  const zeitText = bekannt(tag)
    ? (belegt.length ? `${rolle() === 'gastgeber' ? 'Du bist' : `${n} ist`} belegt ${belegt.map(blockText).join(', ')}.` : `${rolle() === 'gastgeber' ? 'Du hast' : `${n} hat`} den ganzen Tag Zeit.`)
    : '';
  return `<section class="kal-tag" id="kal-tag">
    ${streifen}
    <div class="tag-info">
      ${zeitText ? `<div>${zeitText}</div>` : ''}
      ${t.wetter ? `<div><b>Wetter:</b> ${esc(t.wetter)}</div>` : ''}
      ${spaet ? `<div>Ausgeblendet: ${anzahl(spaet, 'Termin', 'Termine')}, die erst nach 21:30 enden</div>` : ''}
      ${laufend.length ? `<div>Außerdem laufen ${anzahl(laufend.length, 'Angebot', 'Angebote')} – <button type="button" class="textknopf" data-zu-woche="${montag(tag)}">im Programm ansehen</button></div>` : ''}
    </div>
    ${eintraege.length ? eintraege.map((e) => karte(e, { zeitSpalte: true })).join('')
    : `<div class="leer-klein">${tag > p.bis ? 'Für diesen Tag gibt es noch kein Programm – nur Konzerte deiner Künstler und Eingeplantes stehen schon fest.' : 'Keine Termine für diese Filter.'}</div>`}
  </section>`;
}

/**
 * „Filter aus dem Programm sind aktiv“ – mit dem Umkreis, wenn er gilt.
 * Auch für die Karte (ansicht-landkarte.js).
 */
export function filterHinweis(st) {
  const f = filterFuer(st);
  if (!filterAn(f)) return '';
  // „um deinen Standort“ bzw. „um Wandsbek Markt“ – den Umkreis gibt es nur mit Bezugspunkt.
  const wo = () => (st.standort.art === 'geraet' ? 'deinen Standort' : esc(knopfName(st.standort.name, 28)));
  const um = umkreisAn(f) ? ` – nur bis ${f.umkreis} km um ${wo()}` : '';
  return `<p class="fein">Filter aus dem Programm sind aktiv${um}. <button type="button" class="textknopf" data-aktion="filter-weg">Alle zeigen</button></p>`;
}

/**
 * @param {object} ui  { ansicht: 'monat'|'woche'|'tag', datum: gewählter Tag }
 */
export function kalenderAnsicht(p, st, heute, ui) {
  if (!p) return '<div class="leer"><h2>Keine Daten</h2><p>Das Programm ließ sich nicht laden.</p></div>';
  const { erster, letzter } = tagesBereich(p, heute);
  const ansicht = ['monat', 'woche', 'tag'].includes(ui.ansicht) ? ui.ansicht : 'monat';
  const datum = ui.datum && ui.datum >= erster && ui.datum <= letzter ? ui.datum : heute;
  const plaene = geplante(st);
  const monat = monatVon(datum);
  const mo = montag(datum);

  let titel;
  let zurueck;
  let vor;
  if (ansicht === 'monat') {
    titel = monatJahr(`${monat}-01`);
    zurueck = monat > monatVon(erster) ? `${monatPlus(monat, -1)}-01` : '';
    const naechster = `${monatPlus(monat, 1)}-01`;
    vor = naechster <= letzter ? naechster : '';
  } else if (ansicht === 'woche') {
    titel = `KW ${kalenderwoche(mo)} · ${tagMonat(mo)} – ${tagMonat(plusTage(mo, 6))}`;
    zurueck = plusTage(mo, -7) >= montag(erster) ? plusTage(mo, -7) : '';
    vor = plusTage(mo, 7) <= letzter ? plusTage(mo, 7) : '';
  } else {
    titel = datumMitTag(datum) + (datum === heute ? ' · heute' : '');
    zurueck = plusTage(datum, -1) >= erster ? plusTage(datum, -1) : '';
    vor = plusTage(datum, 1) <= letzter ? plusTage(datum, 1) : '';
  }
  const kopf = `<header class="woche-kopf kal-kopf">
    <div class="blaettern">
      <button type="button" class="pfeil" data-aktion="kal-zurueck" data-datum="${esc(zurueck)}" aria-label="Zurück"${zurueck ? '' : ' disabled'}>‹</button>
      <h2 class="monatstitel${ansicht === 'monat' ? '' : ' klein'}">${esc(titel)}</h2>
      <button type="button" class="pfeil" data-aktion="kal-vor" data-datum="${esc(vor)}" aria-label="Weiter"${vor ? '' : ' disabled'}>›</button>
    </div>
    ${filterHinweis(st)}
  </header>`;

  if (ansicht === 'woche') return `${kopf}${wochenAnsicht(p, st, heute, mo, plaene)}`;
  if (ansicht === 'tag') return `${kopf}${tagesAnsicht(p, st, datum, plaene)}`;
  return `${kopf}${monatsAnsicht(p, st, heute, monat, plaene)}`;
}

export { monatPlus };
