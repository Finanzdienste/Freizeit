/*
 * Reiter „Programm“, Ansicht „Liste“: Woche für Woche, Tag für Tag nach
 * Uhrzeit. (Monat, Woche und Tag zeichnet ansicht-kalender.js.)
 *
 * Die Daten reichen gut fünf Wochen (Montagslauf), Konzerte der eigenen
 * Künstler Monate weiter. Geblättert wird wochenweise; Wochen nach dem Ende
 * des Programms zeigen nur noch diese Konzerte – und was ihr eingeplant habt.
 * In der laufenden Woche sind vergangene Tage eingeklappt. Die 21:30-Regel
 * ist kein Filter, sondern immer an; wie viele Termine sie an einem Abend
 * ausblendet, steht beim Tag. Eingeplante Ideen stehen oben am Tag, ohne
 * Filter und ohne Regel – die habt ihr euch ja ausgesucht.
 */
import { esc, anzahl, REGIONEN } from './text.js';
import {
  wochentag, wochentagKurz, tagMonat, datumLang, werktag, plusTage, montag, kalenderwoche,
} from './zeit.js';
import { SCHALTER, termineAm, laufendZwischen, kategorien, letzterTag, filterFuer, umkreisAn } from './filter.js';
import { karte, eintragTermin, eintragLaufend, aufklappbar } from './karte.js';
import { geplante } from './ideen.js';
import { UMKREISE, knopfName, standortUi } from './standort.js';

/** Wie viele Filter gerade an sind – für die Marke am Filter-Knopf. */
export const filterZahl = (f) => (f.region ? 1 : 0) + (f.kategorie ? 1 : 0) + SCHALTER.filter(([k]) => f[k]).length;

/**
 * Die Filter, eingeklappt hinter „Filter“ – daneben die Zahl der Treffer;
 * `vorn` kommt in dieselbe Zeile davor (die Highlights), `hinten` danach
 * (der Standort). Die Marke am Knopf zählt, was in ihm steckt; den Umkreis
 * zeigt der Standort-Knopf selbst.
 */
export function filterLeiste(p, f, zahlen = '', vorn = '', hinten = '') {
  const option = (wert, text, gewaehlt) => `<option value="${esc(wert)}"${gewaehlt ? ' selected' : ''}>${esc(text)}</option>`;
  const inhalt = `<div class="filterzeile">
      <select id="f-region" aria-label="Region">${option('', 'Alle Regionen', !f.region)}${Object.entries(REGIONEN).map(([k, v]) => option(k, v, f.region === k)).join('')}</select>
      <select id="f-kategorie" aria-label="Kategorie">${option('', 'Alle Kategorien', !f.kategorie)}${kategorien(p).map((k) => option(k, k, f.kategorie === k)).join('')}</select>
    </div>
    <div class="filterzeile">
      ${SCHALTER.map(([k, text]) => `<button type="button" class="schalter${k === 'hohwacht' ? ' hb' : ''}" data-filter="${k}" aria-pressed="${Boolean(f[k])}">${text}</button>`).join('')}
    </div>
    ${filterZahl(f) ? '<button type="button" class="textknopf" data-aktion="filter-weg" data-behalten="umkreis">Alle Filter zurücksetzen</button>' : ''}`;
  return `<div class="filter" id="filter">
    ${vorn}
    ${aufklappbar('filter', 'Filter', inhalt, { zahl: filterZahl(f), klasse: 'filter-klapp' })}
    ${hinten}
    ${zahlen ? `<div class="zaehler" id="zaehler">${zahlen}</div>` : ''}
  </div>`;
}

/**
 * „📍 Standort“: der Bezugspunkt für Entfernungen – das Gerät oder eine
 * Adresse –, der Umkreis und die Reihenfolge am Tag. Zugeklappt steht der
 * Bezugspunkt (und der Umkreis) auf dem Knopf.
 */
export function standortFeld(st, f) {
  const s = st.standort;
  const ui = standortUi;
  const laeuft = Boolean(ui.laeuft);
  const zeit = s && s.art === 'geraet' && /T\d{2}:\d{2}/.test(s.zeit)
    ? new Date(s.zeit).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '';
  const gewaehlt = s ? `<div class="standort-jetzt">
      <span class="standort-name">📍 ${esc(s.name)}${zeit ? ` <span class="fein">· bestimmt ${zeit} Uhr</span>` : ''}</span>
      <button type="button" class="textknopf" data-aktion="standort-weg">Löschen</button>
    </div>` : '';
  const wahl = `<div class="standort-wahl">
      <button type="button" class="knopf" data-aktion="standort-geraet"${laeuft ? ' disabled' : ''}>${s && s.art === 'geraet' ? 'Standort neu bestimmen' : 'Mein Standort'}</button>
      <div class="standort-suche">
        <input id="standort-adresse" class="eingabe" type="search" placeholder="Adresse oder Ort" aria-label="Adresse oder Ort" enterkeyhint="search" maxlength="200" value="${esc(ui.eingabe)}">
        <button type="button" class="knopf" data-aktion="standort-suchen"${laeuft ? ' disabled' : ''}>Suchen</button>
      </div>
    </div>`;
  const status = ui.laeuft ? `<p class="fein" role="status">${ui.laeuft === 'geraet' ? 'Standort wird bestimmt …' : 'Suche läuft …'}</p>` : '';
  const fehler = ui.fehler ? `<p class="standort-fehler" role="alert">${esc(ui.fehler)}</p>` : '';
  const treffer = ui.treffer.length ? `<div class="standort-treffer" role="group" aria-label="Treffer">
      <span class="fein">Welcher Ort ist gemeint?</span>
      ${ui.treffer.map((t, i) => `<button type="button" class="treffer-knopf" data-aktion="standort-waehlen" data-nr="${i}">${esc(t.name)}</button>`).join('')}
    </div>` : '';
  const einstellungen = s ? `<div class="standort-zeile"><span class="fein">Umkreis</span>
      <div class="filterzeile">${UMKREISE.map((km) => `<button type="button" class="schalter" data-aktion="umkreis" data-km="${km}" aria-pressed="${f.umkreis === km}">${km ? `${km} km` : 'alle'}</button>`).join('')}</div>
    </div>
    <div class="standort-zeile"><span class="fein">Reihenfolge am Tag</span>
      <div class="filterzeile">
        <button type="button" class="schalter" data-aktion="reihenfolge" data-wert="zeit" aria-pressed="${!f.nachEntfernung}">Uhrzeit</button>
        <button type="button" class="schalter" data-aktion="reihenfolge" data-wert="entfernung" aria-pressed="${Boolean(f.nachEntfernung)}">Entfernung</button>
      </div>
    </div>` : '';
  const hinweis = '<p class="fein standort-hinweis">Luftlinie. Dein Standort bleibt auf dem Gerät; eine eingetippte Adresse geht zum Suchen an OpenStreetMap.</p>';
  const titel = s ? `📍 ${esc(knopfName(s.name, 18))}${umkreisAn(f) ? ` · ${f.umkreis} km` : ''}` : '📍 Standort';
  return aufklappbar('standort', titel, `<div class="standort-feld">${gewaehlt}${wahl}${status}${fehler}${treffer}${einstellungen}${hinweis}</div>`,
    { klasse: `standort-klapp${s ? ' gesetzt' : ''}` });
}

/** Die Wochen, durch die man blättern kann: von dieser bis zur letzten mit einem Termin oder Plan. */
export function wochenBereich(p, heute) {
  const erste = montag(heute);
  const bis = letzterTag(p, geplante().map((e) => e.datum));
  const letzte = montag(bis > heute ? bis : heute);
  return { erste, letzte };
}

export function programmAnsicht(p, st, heute, wocheWunsch) {
  if (!p) {
    return '<div class="leer"><h2>Keine Daten</h2><p>Das Programm ließ sich nicht laden. Ohne Netz zeigt die App das zuletzt geladene – beim ersten Öffnen braucht sie einmal Verbindung.</p></div>';
  }
  const f = filterFuer(st);
  const { erste, letzte } = wochenBereich(p, heute);
  const woche = wocheWunsch < erste ? erste : (wocheWunsch > letzte ? letzte : wocheWunsch);
  const sonntag = plusTage(woche, 6);
  const dieseWoche = woche === erste;
  const ohneProgramm = woche > p.bis;

  const alleTage = [0, 1, 2, 3, 4, 5, 6].map((n) => plusTage(woche, n));
  const vorbei = dieseWoche ? alleTage.filter((d) => d < heute) : [];
  let tage = alleTage.filter((d) => st.vergangeneTage || d >= heute);
  const proTag = new Map(tage.map((d) => [d, termineAm(p, d, f)]));
  const plaene = geplante(st);
  const geplantAm = (d) => plaene.filter((e) => e.datum === d);
  // Jenseits des Programms bleiben nur Tage mit Konzerten oder Plänen stehen.
  if (ohneProgramm) tage = tage.filter((d) => proTag.get(d).liste.length || geplantAm(d).length);
  const laufend = laufendZwischen(p, woche, sonntag, f);

  // Ein leerer Tag sagt, woran es liegt – mit Umkreis dessen Weite.
  const leerText = umkreisAn(f)
    ? `Keine Termine${filterZahl(f) ? ' für diese Filter' : ''} bis ${f.umkreis} km.`
    : 'Keine Termine für diese Filter.';
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
    const geplant = geplantAm(d);
    return `<section class="tag${d < heute ? ' vorbei' : ''}" id="tag-${d}">
      <div class="tag-kopf"><h2>${wochentag(d)}</h2><span class="datum">${datumLang(d)}</span>${heuteMarke}</div>
      <div class="tag-info">${zeilen}</div>
      ${geplant.map((e) => karte(e, { zeitSpalte: true })).join('')}
      ${liste.length ? liste.map((e) => karte(eintragTermin(e, tag, p.tage), { zeitSpalte: true })).join('') : (geplant.length && d > p.bis ? '' : `<div class="leer-klein">${d > p.bis ? 'Für diesen Tag gibt es noch kein Programm.' : leerText}</div>`)}
    </section>`;
  }).join('');

  const tagNav = tage.map((d) => `<a href="#tag-${d}">${wochentagKurz(d)} ${tagMonat(d)}</a>`).join('')
    + (laufend.length ? '<a href="#abschnitt-laufend">Läuft gerade</a>' : '');
  const zahlen = `${anzahl(n, 'Termin', 'Termine')}${laufend.length ? ` · ${laufend.length} laufend` : ''}${umkreisAn(f) ? ` · bis ${f.umkreis} km` : ''}`;
  const veraltet = dieseWoche && heute > p.bis
    ? '<div class="banner">Das Programm ist abgelaufen. Das neue kommt montags gegen 7 Uhr.</div>' : '';
  const hinweisOhne = ohneProgramm
    ? `<div class="banner">Für diese Woche gibt es noch kein Programm – hier stehen nur Konzerte deiner Künstler und was ihr eingeplant habt. Das Programm kommt mit dem Montagslauf, sobald die Woche in den nächsten fünf Wochen liegt.</div>` : '';

  const navi = `<div class="blaettern">
    <button type="button" class="pfeil" data-aktion="woche-zurueck" aria-label="Woche davor"${woche <= erste ? ' disabled' : ''}>‹</button>
    <div class="kicker"><b>KW ${kalenderwoche(woche)}</b> ${wochentagKurz(woche)} ${tagMonat(woche)} – ${wochentagKurz(sonntag)} ${datumLang(sonntag)}</div>
    <button type="button" class="pfeil" data-aktion="woche-vor" aria-label="Woche danach"${woche >= letzte ? ' disabled' : ''}>›</button>
  </div>`;

  return `${veraltet}
  <header class="woche-kopf">
    ${navi}
    ${dieseWoche && p.infos.length ? `<div class="infos">${p.infos.map((i) => `<span class="info">${i.titel ? `<b>${esc(i.titel)}:</b> ` : ''}${esc(i.text)}</span>`).join('')}</div>` : ''}
  </header>
  ${hinweisOhne}
  ${filterLeiste(p, f, zahlen, (dieseWoche && p.highlights.length ? aufklappbar('highlights', `${anzahl(p.highlights.length, 'Highlight', 'Highlights')} der Woche`,
    `<ol class="highlights">${p.highlights.map((h) => `<li><strong>${esc(h.titel)}</strong><span>${esc(h.text)}</span></li>`).join('')}</ol>`, { klasse: 'highlights-klapp' }) : ''), standortFeld(st, f))}
  <nav class="tagleiste" aria-label="Tage">${tagNav}</nav>
  ${vorbei.length ? `<button type="button" class="vergangene" data-aktion="vergangene" aria-pressed="${Boolean(st.vergangeneTage)}">${st.vergangeneTage ? 'Vergangene Tage ausblenden' : `Vergangene Tage zeigen (${vorbei.length})`}</button>` : ''}
  ${tageHtml || (ohneProgramm ? '<div class="leer-klein">In dieser Woche keine Konzerte deiner Künstler und nichts eingeplant.</div>' : '')}
  ${laufend.length ? `<section class="abschnitt" id="abschnitt-laufend">
    <h2 class="abschnitt-titel">Läuft gerade</h2>
    <p class="fein">Ausstellungen, Märkte, Saisonangebote – über Tage oder Wochen, mit ihren Zeiten. Der Filter „Mo–Fr ab 15:30“ wirkt hier nicht.</p>
    ${laufend.map((e) => karte(eintragLaufend(e))).join('')}
  </section>` : ''}
  ${dieseWoche ? `<section class="abschnitt verweis">
    <h2 class="abschnitt-titel">Ohne Termin</h2>
    <p class="fein">Ausflugsziele und Ideen für freie Abende – Sport, Spiele, Kreatives, Ausflüge – stehen im Reiter <button type="button" class="textknopf" data-reiter="ideen">Ideen</button>.</p>
  </section>` : ''}
  ${dieseWoche && p.hinweise.length ? `<section class="abschnitt"><h2 class="abschnitt-titel">Hinweise</h2><ul class="hinweise">${p.hinweise.map((h) => `<li>${h.titel ? `<b>${esc(h.titel)}:</b> ` : ''}${esc(h.text)}</li>`).join('')}</ul></section>` : ''}`;
}
