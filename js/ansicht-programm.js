/*
 * Reiter „Programm“: Woche für Woche, Tag für Tag nach Uhrzeit.
 *
 * Die Daten reichen gut fünf Wochen (Montagslauf), Konzerte der eigenen
 * Künstler Monate weiter. Geblättert wird wochenweise; Wochen nach dem Ende
 * des Programms zeigen nur noch diese Konzerte. In der laufenden Woche sind
 * vergangene Tage eingeklappt. Die 21:30-Regel ist kein Filter, sondern immer
 * an; wie viele Termine sie an einem Abend ausblendet, steht beim Tag.
 */
import { esc, anzahl, REGIONEN } from './text.js';
import {
  wochentag, wochentagKurz, tagMonat, datumLang, werktag, plusTage, montag, kalenderwoche,
} from './zeit.js';
import { SCHALTER, termineAm, laufendZwischen, kategorien, letzterTag, passt } from './filter.js';
import { karte, eintragTermin, eintragLaufend, eintragImmer } from './karte.js';

export function filterLeiste(p, f, zahlen = '') {
  const option = (wert, text, gewaehlt) => `<option value="${esc(wert)}"${gewaehlt ? ' selected' : ''}>${esc(text)}</option>`;
  return `<div class="filter" id="filter">
    <div class="filterzeile">
      <select id="f-region" aria-label="Region">${option('', 'Alle Regionen', !f.region)}${Object.entries(REGIONEN).map(([k, v]) => option(k, v, f.region === k)).join('')}</select>
      <select id="f-kategorie" aria-label="Kategorie">${option('', 'Alle Kategorien', !f.kategorie)}${kategorien(p).map((k) => option(k, k, f.kategorie === k)).join('')}</select>
    </div>
    <div class="filterzeile">
      ${SCHALTER.map(([k, text]) => `<button type="button" class="schalter${k === 'hohwacht' ? ' hb' : ''}" data-filter="${k}" aria-pressed="${Boolean(f[k])}">${text}</button>`).join('')}
    </div>
    ${zahlen ? `<div class="zaehler" id="zaehler">${zahlen}</div>` : ''}
  </div>`;
}

/** Die Wochen, durch die man blättern kann: von dieser bis zur letzten mit einem Termin. */
export function wochenBereich(p, heute) {
  const erste = montag(heute);
  const letzte = montag(letzterTag(p) > heute ? letzterTag(p) : heute);
  return { erste, letzte };
}

export function programmAnsicht(p, st, heute, wocheWunsch) {
  if (!p) {
    return '<div class="leer"><h2>Keine Daten</h2><p>Das Programm ließ sich nicht laden. Ohne Netz zeigt die App das zuletzt geladene – beim ersten Öffnen braucht sie einmal Verbindung.</p></div>';
  }
  const f = st.filter;
  const { erste, letzte } = wochenBereich(p, heute);
  const woche = wocheWunsch < erste ? erste : (wocheWunsch > letzte ? letzte : wocheWunsch);
  const sonntag = plusTage(woche, 6);
  const dieseWoche = woche === erste;
  const ohneProgramm = woche > p.bis;

  const alleTage = [0, 1, 2, 3, 4, 5, 6].map((n) => plusTage(woche, n));
  const vorbei = dieseWoche ? alleTage.filter((d) => d < heute) : [];
  let tage = alleTage.filter((d) => st.vergangeneTage || d >= heute);
  const proTag = new Map(tage.map((d) => [d, termineAm(p, d, f)]));
  // Jenseits des Programms bleiben nur Tage mit Konzerten stehen.
  if (ohneProgramm) tage = tage.filter((d) => proTag.get(d).liste.length);
  const laufend = laufendZwischen(p, woche, sonntag, f);

  let n = 0;
  const tageHtml = tage.map((d) => {
    const { tag, liste, spaet } = proTag.get(d);
    n += liste.length;
    const laufendHeute = laufend.filter((e) => e.von <= d && d <= e.bis).length;
    const zeilen = [
      tag.wetter ? `<div><b>Wetter:</b> ${esc(tag.wetter)}</div>` : '',
      tag.wetterOstsee ? `<div>${esc(tag.wetterOstsee)}</div>` : '',
      tag.feiertag ? '<div><b>Feiertag</b></div>' : '',
      tag.tipp ? `<div>${esc(tag.tipp)}</div>` : '',
      f.feierabend && werktag(tag) ? '<div><b>Filter aktiv:</b> nur Termine, die nach 15:30 noch gehen</div>' : '',
      spaet ? `<div>Ausgeblendet: ${spaet === 1 ? '1 Termin, der' : `${spaet} Termine, die`} erst nach 21:30 ${spaet === 1 ? 'endet' : 'enden'}</div>` : '',
      laufendHeute ? `<div>Außerdem ${anzahl(laufendHeute, 'Angebot', 'Angebote')} unter <a href="#abschnitt-laufend">„Läuft gerade“</a></div>` : '',
    ].join('');
    const heuteMarke = d === heute ? '<span class="heute">heute</span>' : '';
    return `<section class="tag${d < heute ? ' vorbei' : ''}" id="tag-${d}">
      <div class="tag-kopf"><h2>${wochentag(d)}</h2><span class="datum">${datumLang(d)}</span>${heuteMarke}</div>
      <div class="tag-info">${zeilen}</div>
      ${liste.length ? liste.map((e) => karte(eintragTermin(e, tag, p.tage), { zeitSpalte: true })).join('') : `<div class="leer-klein">${d > p.bis ? 'Für diesen Tag gibt es noch kein Programm.' : 'Keine Termine für diese Filter.'}</div>`}
    </section>`;
  }).join('');

  const immer = p.immer.filter((e) => passt(e, f));
  const tagNav = tage.map((d) => `<a href="#tag-${d}">${wochentagKurz(d)} ${tagMonat(d)}</a>`).join('')
    + (laufend.length ? '<a href="#abschnitt-laufend">Läuft gerade</a>' : '')
    + (dieseWoche && immer.length ? '<a href="#abschnitt-immer">Geht immer</a>' : '');
  const zahlen = `${anzahl(n, 'Termin', 'Termine')}${laufend.length ? ` · ${laufend.length} laufend` : ''}${dieseWoche ? ` · ${anzahl(immer.length, 'Ausflugsziel', 'Ausflugsziele')}` : ''}`;
  const veraltet = dieseWoche && heute > p.bis
    ? '<div class="banner">Das Programm ist abgelaufen. Das neue kommt montags gegen 7 Uhr.</div>' : '';
  const hinweisOhne = ohneProgramm
    ? `<div class="banner">Für diese Woche gibt es noch kein Programm – hier stehen nur Konzerte deiner Künstler. Das Programm kommt mit dem Montagslauf, sobald die Woche in den nächsten fünf Wochen liegt.</div>` : '';

  const navi = `<div class="blaettern">
    <button type="button" class="pfeil" data-aktion="woche-zurueck" aria-label="Woche davor"${woche <= erste ? ' disabled' : ''}>‹</button>
    <div class="kicker">KW ${kalenderwoche(woche)} · ${wochentagKurz(woche)} ${tagMonat(woche)} – ${wochentagKurz(sonntag)} ${datumLang(sonntag)}</div>
    <button type="button" class="pfeil" data-aktion="woche-vor" aria-label="Woche danach"${woche >= letzte ? ' disabled' : ''}>›</button>
    ${dieseWoche ? '' : '<button type="button" class="knopf klein" data-aktion="woche-heute">Heute</button>'}
  </div>`;

  return `${veraltet}
  <header class="woche-kopf">
    ${navi}
    ${dieseWoche && p.infos.length ? `<div class="infos">${p.infos.map((i) => `<span class="info">${i.titel ? `<b>${esc(i.titel)}:</b> ` : ''}${esc(i.text)}</span>`).join('')}</div>` : ''}
  </header>
  ${hinweisOhne}
  ${dieseWoche && p.highlights.length ? `<section class="abschnitt"><h2 class="abschnitt-titel">Highlights</h2><ol class="highlights">${p.highlights.map((h, i) => `<li><span class="nr">${i + 1}</span><div><strong>${esc(h.titel)}</strong><span>${esc(h.text)}</span></div></li>`).join('')}</ol></section>` : ''}
  ${filterLeiste(p, f, zahlen)}
  <nav class="tagleiste" aria-label="Tage">${tagNav}</nav>
  ${vorbei.length ? `<button type="button" class="vergangene" data-aktion="vergangene" aria-pressed="${Boolean(st.vergangeneTage)}">${st.vergangeneTage ? 'Vergangene Tage ausblenden' : `Vergangene Tage zeigen (${vorbei.length})`}</button>` : ''}
  ${tageHtml || (ohneProgramm ? '<div class="leer-klein">In dieser Woche keine Konzerte deiner Künstler.</div>' : '')}
  ${laufend.length ? `<section class="abschnitt" id="abschnitt-laufend">
    <h2 class="abschnitt-titel">Läuft gerade</h2>
    <p class="fein">Ausstellungen, Märkte, Saisonangebote – über Tage oder Wochen, mit ihren Zeiten. Der Filter „Mo–Fr ab 15:30“ wirkt hier nicht.</p>
    ${laufend.map((e) => karte(eintragLaufend(e))).join('')}
  </section>` : ''}
  ${dieseWoche ? `<section class="abschnitt" id="abschnitt-immer">
    <h2 class="abschnitt-titel">Geht immer</h2>
    <p class="fein">Ausflugsziele unabhängig von Terminen. Öffnungszeiten vorher kurz prüfen.</p>
    ${immer.length ? immer.map((e) => karte(eintragImmer(e))).join('') : '<div class="leer-klein">Keine Einträge für diese Filter.</div>'}
  </section>` : ''}
  ${dieseWoche && p.hinweise.length ? `<section class="abschnitt"><h2 class="abschnitt-titel">Hinweise</h2><ul class="hinweise">${p.hinweise.map((h) => `<li>${h.titel ? `<b>${esc(h.titel)}:</b> ` : ''}${esc(h.text)}</li>`).join('')}</ul></section>` : ''}`;
}
