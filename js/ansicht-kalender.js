/*
 * Reiter „Kalender“: ein Monatsblatt, darunter der gewählte Tag.
 *
 * Jedes Feld zeigt, wie viele Termine an dem Tag stehen (nach Filtern und
 * 21:30-Regel – dieselbe Auswahl wie im Programm) und als Punkte, wer Bock
 * hat. Monate nach dem Programm zeigen nur noch Konzerte der eigenen Künstler.
 */
import { esc, anzahl } from './text.js';
import { monatsRaster, monatVon, monatPlus, monatJahr, datumMitTag, montag } from './zeit.js';
import { termineAm, laufendZwischen, letzterTag, filterAn } from './filter.js';
import { karte, eintragTermin } from './karte.js';
import { meinBock } from './speicher.js';
import { andere } from './gemeinsam.js';

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** Von diesem Monat bis zum Monat des letzten Termins. */
export function monatsBereich(p, heute) {
  const erster = monatVon(heute);
  const letzter = p ? monatVon(letzterTag(p) > heute ? letzterTag(p) : heute) : erster;
  return { erster, letzter };
}

/** Wer an einem Tag Bock hat: ich (0) und die anderen nach ihrer Nummer. */
function punkte(liste, tag, tage) {
  const wer = new Set();
  let treffer = false;
  for (const e of liste) {
    const x = eintragTermin(e, tag, tage);
    const ich = meinBock(x.schluessel);
    const sie = andere(x.schluessel);
    if (ich) wer.add('ich');
    for (const p of sie) wer.add(`p${p.nr % 4}`);
    if (ich && sie.length) treffer = true;
  }
  return { wer: [...wer], treffer };
}

export function kalenderAnsicht(p, st, heute, monatWunsch, gewaehlt) {
  if (!p) return '<div class="leer"><h2>Keine Daten</h2><p>Das Programm ließ sich nicht laden.</p></div>';
  const f = st.filter;
  const { erster, letzter } = monatsBereich(p, heute);
  const monat = monatWunsch < erster ? erster : (monatWunsch > letzter ? letzter : monatWunsch);
  const raster = monatsRaster(monat);
  const tag = gewaehlt && monatVon(gewaehlt) === monat ? gewaehlt : (monat === monatVon(heute) ? heute : `${monat}-01`);

  const felder = raster.map((d) => {
    const imMonat = monatVon(d) === monat;
    const { tag: t, liste } = termineAm(p, d, f);
    const { wer, treffer } = punkte(liste, t, p.tage);
    const klassen = ['feld', imMonat ? '' : 'fremd', d < heute ? 'vorbei' : '', d === heute ? 'heute' : '', d === tag ? 'gewaehlt' : '',
      d > p.bis ? 'ohne' : '', treffer ? 'treffer' : ''].filter(Boolean).join(' ');
    const zahl = liste.length ? `<span class="zahl">${liste.length}</span>` : '';
    const dots = wer.length ? `<span class="punkte">${wer.map((w) => `<i class="pkt ${w}"></i>`).join('')}</span>` : '';
    return `<button type="button" class="${klassen}" data-tag="${d}" aria-pressed="${d === tag}" aria-label="${esc(datumMitTag(d))}: ${anzahl(liste.length, 'Termin', 'Termine')}${wer.length ? ', mit Bock' : ''}">
      <span class="nr">${Number(d.slice(8))}</span>${zahl}${dots}</button>`;
  }).join('');

  const { tag: t, liste, spaet } = termineAm(p, tag, f);
  const laufend = laufendZwischen(p, tag, tag, f);
  const tagHtml = `<section class="kal-tag" id="kal-tag">
    <div class="tag-kopf"><h2>${esc(datumMitTag(tag))}</h2>${tag === heute ? '<span class="heute">heute</span>' : ''}</div>
    <div class="tag-info">
      ${t.wetter ? `<div><b>Wetter:</b> ${esc(t.wetter)}</div>` : ''}
      ${spaet ? `<div>Ausgeblendet: ${anzahl(spaet, 'Termin', 'Termine')}, die erst nach 21:30 enden</div>` : ''}
      ${laufend.length ? `<div>Außerdem laufen ${anzahl(laufend.length, 'Angebot', 'Angebote')} – <button type="button" class="textknopf" data-zu-woche="${montag(tag)}">im Programm ansehen</button></div>` : ''}
    </div>
    ${liste.length ? liste.map((e) => karte(eintragTermin(e, t, p.tage), { zeitSpalte: true })).join('')
    : `<div class="leer-klein">${tag > p.bis ? 'Für diesen Tag gibt es noch kein Programm – nur Konzerte deiner Künstler stehen schon fest.' : 'Keine Termine für diese Filter.'}</div>`}
  </section>`;

  return `<header class="woche-kopf">
    <div class="blaettern">
      <button type="button" class="pfeil" data-aktion="monat-zurueck" aria-label="Monat davor"${monat <= erster ? ' disabled' : ''}>‹</button>
      <h2 class="monatstitel">${monatJahr(`${monat}-01`)}</h2>
      <button type="button" class="pfeil" data-aktion="monat-vor" aria-label="Monat danach"${monat >= letzter ? ' disabled' : ''}>›</button>
    </div>
    ${filterAn(f) ? '<p class="fein">Filter aus dem Programm sind aktiv. <button type="button" class="textknopf" data-aktion="filter-weg">Alle zeigen</button></p>' : ''}
  </header>
  <div class="kalender" role="group" aria-label="${esc(monatJahr(`${monat}-01`))}">
    ${WOCHENTAGE.map((w) => `<div class="wt">${w}</div>`).join('')}
    ${felder}
  </div>
  <div class="legende"><span><i class="pkt ich"></i> du</span><span><i class="pkt p0"></i><i class="pkt p1"></i> die anderen</span><span><span class="feld-mini treffer"></span> ihr habt beide Bock</span></div>
  ${tagHtml}`;
}

export { monatPlus };
