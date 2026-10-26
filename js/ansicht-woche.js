/*
 * Reiter „Diese Woche“: Highlights, Filter, Tag für Tag, was die ganze Woche
 * läuft, was immer geht, Hinweise.
 *
 * Vergangene Tage sind eingeklappt – wer am Mittwoch öffnet, sucht nichts mehr
 * für Montag. Die 21:30-Regel ist kein Filter, sondern immer an; wie viele
 * Termine sie an einem Abend ausblendet, steht beim Tag.
 */
import { esc, anzahl, REGIONEN, kostenlos } from './text.js';
import {
  wochentag, wochentagKurz, tagMonat, datumLang, werktag, nachFeierabend,
  endetRechtzeitig, sortierung,
} from './zeit.js';
import { karte, eintragTermin, eintragWoche, eintragImmer } from './karte.js';

const SCHALTER = [
  ['kostenlos', 'kostenlos'],
  ['feierabend', 'Mo–Fr ab 15:30'],
  ['drinnen', 'drinnen'],
  ['draussen', 'draußen'],
  ['hohwacht', 'Hohwacht-Kombi'],
];

/** Region, Kategorie, kostenlos, drinnen/draußen, Hohwacht – für alle drei Listen. */
export function passt(e, f) {
  if (f.region && e.region !== f.region) return false;
  if (f.kategorie && e.kategorie !== f.kategorie) return false;
  if (f.kostenlos && !kostenlos(e)) return false;
  if (f.drinnen && !f.draussen && e.draussen === 'draußen') return false;
  if (f.draussen && !f.drinnen && e.draussen === 'drinnen') return false;
  if (f.hohwacht && !(e.hohwacht || e.region === 'HB')) return false;
  return true;
}

/** Was an einem Tag steht – und wie viele die 21:30-Regel weggenommen hat. */
export function termineAm(woche, tag, f) {
  const basis = woche.termine.filter((e) => !e.ganzeWoche && e.daten.includes(tag.datum) && passt(e, f)
    && (!f.feierabend || !werktag(tag) || nachFeierabend(e, tag.datum)));
  const liste = basis.filter((e) => endetRechtzeitig(e, tag, woche.tage))
    .sort((a, b) => sortierung(a, tag.datum) - sortierung(b, tag.datum));
  return { liste, spaet: basis.length - liste.length };
}

function filterLeiste(woche, f, zahlen) {
  const kategorien = [...new Set([...woche.termine, ...woche.immer].map((e) => e.kategorie).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'de'));
  const option = (wert, text, gewaehlt) => `<option value="${esc(wert)}"${gewaehlt ? ' selected' : ''}>${esc(text)}</option>`;
  return `<div class="filter" id="filter">
    <div class="filterzeile">
      <select id="f-region" aria-label="Region">${option('', 'Alle Regionen', !f.region)}${Object.entries(REGIONEN).map(([k, v]) => option(k, v, f.region === k)).join('')}</select>
      <select id="f-kategorie" aria-label="Kategorie">${option('', 'Alle Kategorien', !f.kategorie)}${kategorien.map((k) => option(k, k, f.kategorie === k)).join('')}</select>
    </div>
    <div class="filterzeile">
      ${SCHALTER.map(([k, text]) => `<button type="button" class="schalter${k === 'hohwacht' ? ' hb' : ''}" data-filter="${k}" aria-pressed="${Boolean(f[k])}">${text}</button>`).join('')}
    </div>
    <div class="zaehler" id="zaehler">${zahlen}</div>
  </div>`;
}

export function wocheAnsicht(woche, st, heute) {
  if (!woche) {
    return '<div class="leer"><h2>Keine Wochendaten</h2><p>Die Übersicht ließ sich nicht laden. Ohne Netz zeigt die App die zuletzt geladene Woche – beim ersten Öffnen braucht sie einmal Verbindung.</p></div>';
  }
  const f = st.filter;
  const vorbei = woche.tage.filter((t) => t.datum < heute);
  const sichtbar = woche.tage.filter((t) => st.vergangeneTage || t.datum >= heute);
  const ganzeWoche = woche.termine.filter((e) => e.ganzeWoche && passt(e, f));
  const immer = woche.immer.filter((e) => passt(e, f));

  let n = 0;
  const tageHtml = sichtbar.map((tag) => {
    const { liste, spaet } = termineAm(woche, tag, f);
    n += liste.length;
    const wochenweit = ganzeWoche.filter((e) => e.daten.includes(tag.datum)).length;
    const zeilen = [
      tag.wetter ? `<div><b>Wetter:</b> ${esc(tag.wetter)}</div>` : '',
      tag.wetterOstsee ? `<div>${esc(tag.wetterOstsee)}</div>` : '',
      tag.tipp ? `<div>${esc(tag.tipp)}</div>` : '',
      f.feierabend && werktag(tag) ? '<div><b>Filter aktiv:</b> nur Termine, die nach 15:30 noch gehen</div>' : '',
      spaet ? `<div>Ausgeblendet: ${spaet === 1 ? '1 Termin, der' : `${spaet} Termine, die`} erst nach 21:30 ${spaet === 1 ? 'endet' : 'enden'}</div>` : '',
      wochenweit ? `<div>Außerdem ${anzahl(wochenweit, 'Angebot', 'Angebote')} unter <a href="#abschnitt-woche">„Läuft die ganze Woche“</a></div>` : '',
    ].join('');
    const heuteMarke = tag.datum === heute ? '<span class="heute">heute</span>' : '';
    return `<section class="tag${tag.datum < heute ? ' vorbei' : ''}" id="tag-${tag.datum}">
      <div class="tag-kopf"><h2>${wochentag(tag.datum)}</h2><span class="datum">${datumLang(tag.datum)}</span>${heuteMarke}</div>
      <div class="tag-info">${zeilen}</div>
      ${liste.length ? liste.map((e) => karte(eintragTermin(e, tag, woche.tage), { zeitSpalte: true })).join('') : '<div class="leer-klein">Keine Termine für diese Filter.</div>'}
    </section>`;
  }).join('');

  const tagNav = sichtbar.map((t) => `<a href="#tag-${t.datum}">${wochentagKurz(t.datum)} ${tagMonat(t.datum)}</a>`).join('')
    + '<a href="#abschnitt-woche">Ganze Woche</a><a href="#abschnitt-immer">Geht immer</a>';
  const zahlen = `${anzahl(n, 'Termin', 'Termine')} · ${ganzeWoche.length} ganze Woche · ${anzahl(immer.length, 'Ausflugsziel', 'Ausflugsziele')}`;
  const veraltet = heute > woche.bis
    ? '<div class="banner">Das ist noch die Übersicht der letzten Woche. Die neue kommt montags gegen 7 Uhr.</div>' : '';

  return `${veraltet}
  <header class="woche-kopf">
    <div class="kicker">KW ${esc(woche.kw)} · ${wochentagKurz(woche.von)} ${tagMonat(woche.von)} – ${wochentagKurz(woche.bis)} ${datumLang(woche.bis)}</div>
    ${woche.infos.length ? `<div class="infos">${woche.infos.map((i) => `<span class="info"><b>${esc(i.titel)}:</b> ${esc(i.text)}</span>`).join('')}</div>` : ''}
  </header>
  ${woche.highlights.length ? `<section class="abschnitt"><h2 class="abschnitt-titel">Highlights der Woche</h2><ol class="highlights">${woche.highlights.map((h, i) => `<li><span class="nr">${i + 1}</span><div><strong>${esc(h.titel)}</strong><span>${esc(h.text)}</span></div></li>`).join('')}</ol></section>` : ''}
  ${filterLeiste(woche, f, zahlen)}
  <nav class="tagleiste" aria-label="Tage">${tagNav}</nav>
  ${vorbei.length ? `<button type="button" class="vergangene" data-aktion="vergangene" aria-pressed="${Boolean(st.vergangeneTage)}">${st.vergangeneTage ? 'Vergangene Tage ausblenden' : `Vergangene Tage zeigen (${vorbei.length})`}</button>` : ''}
  ${tageHtml}
  <section class="abschnitt" id="abschnitt-woche">
    <h2 class="abschnitt-titel">Läuft die ganze Woche</h2>
    <p class="fein">Was an (fast) jedem Tag läuft, mit seinen Zeiten. Der Filter „Mo–Fr ab 15:30“ wirkt hier nicht.</p>
    ${ganzeWoche.length ? ganzeWoche.map((e) => karte(eintragWoche(e, woche))).join('') : '<div class="leer-klein">Keine Einträge für diese Filter.</div>'}
  </section>
  <section class="abschnitt" id="abschnitt-immer">
    <h2 class="abschnitt-titel">Geht immer</h2>
    <p class="fein">Ausflugsziele unabhängig von Terminen. Öffnungszeiten vorher kurz prüfen.</p>
    ${immer.length ? immer.map((e) => karte(eintragImmer(e))).join('') : '<div class="leer-klein">Keine Einträge für diese Filter.</div>'}
  </section>
  ${woche.hinweise.length ? `<section class="abschnitt"><h2 class="abschnitt-titel">Hinweise</h2><ul class="hinweise">${woche.hinweise.map((h) => `<li>${h.titel ? `<b>${esc(h.titel)}:</b> ` : ''}${esc(h.text)}</li>`).join('')}</ul></section>` : ''}`;
}
