/*
 * Reiter „Programm“, Ansicht „Liste“: Woche für Woche, Tag für Tag nach
 * Uhrzeit. (Monat, Woche und Tag zeichnet ansicht-kalender.js.)
 *
 * Oben, in dieser Reihenfolge: blättern (‹ KW 45 · 2.11. – 8.11. ›), die
 * Filterleiste, die Tagesleiste – sieben Tage mit der Zahl der Termine und
 * Punkten, wer Bock hat; ein Tipp springt zum Tag, beim Scrollen bleibt sie
 * oben stehen – und eingeklappt „Diese Woche“ mit Highlights und Infos des
 * Montagslaufs. Darunter die Tage, „Läuft gerade“ und die Hinweise.
 *
 * Die Daten reichen gut fünf Wochen (Montagslauf), Konzerte der eigenen
 * Künstler Monate weiter. Geblättert wird wochenweise; Wochen nach dem Ende
 * des Programms zeigen nur noch diese Konzerte – und was ihr eingeplant habt.
 * In der laufenden Woche sind vergangene Tage eingeklappt. Die 21:30-Regel
 * ist kein Filter, sondern immer an; wie viele Termine sie an einem Abend
 * ausblendet, steht beim Tag. Eingeplante Ideen stehen oben am Tag, ohne
 * Filter und ohne Regel – die habt ihr euch ja ausgesucht.
 */
import { esc, anzahl } from './text.js';
import {
  wochentag, wochentagKurz, datumLang, datumMitTag, werktag, plusTage, montag,
} from './zeit.js';
import {
  termineAm, laufendZwischen, letzterTag, filterFuer, umkreisAn, spaetText,
} from './filter.js';
import { karte, eintragTermin, eintragLaufend, aufklappbar } from './karte.js';
import { geplante } from './ideen.js';
import { filterLeiste, chipsProgramm } from './ansicht-filter.js';
import { navZeile, wochenTitel, punkte } from './ansicht-kalender.js';

/** Die Wochen, durch die man blättern kann: von dieser bis zur letzten mit einem Termin oder Plan. */
export function wochenBereich(p, heute) {
  const erste = montag(heute);
  const bis = letzterTag(p, geplante().map((e) => e.datum));
  const letzte = montag(bis > heute ? bis : heute);
  return { erste, letzte };
}

/** Was die Liste für eine Woche zeigt – gezeichnet und gezählt aus demselben. */
function woche(p, st, heute, wunsch) {
  const f = filterFuer(st);
  const { erste, letzte } = wochenBereich(p, heute);
  const mo = wunsch < erste ? erste : (wunsch > letzte ? letzte : wunsch);
  const alleTage = Array.from({ length: 7 }, (_, n) => plusTage(mo, n));
  const dieseWoche = mo === erste;
  const ohneProgramm = mo > p.bis;
  const proTag = new Map(alleTage.map((d) => [d, termineAm(p, d, f)]));
  const plaene = geplante(st);
  const geplantAm = (d) => plaene.filter((e) => e.datum === d);
  let tage = alleTage.filter((d) => st.vergangeneTage || d >= heute);
  // Jenseits des Programms bleiben nur Tage mit Konzerten oder Plänen stehen.
  if (ohneProgramm) tage = tage.filter((d) => proTag.get(d).liste.length || geplantAm(d).length);
  const n = tage.reduce((summe, d) => summe + proTag.get(d).liste.length, 0);
  return {
    f, erste, letzte, mo, alleTage, dieseWoche, ohneProgramm, proTag, geplantAm, tage, n,
    laufend: laufendZwischen(p, mo, plusTage(mo, 6), f),
  };
}

/** Wie viele Termine die Liste in dieser Woche zeigt – für den Knopf unten im Filter-Blatt. */
export const listenZahl = (p, st, heute, wunsch) => (p ? woche(p, st, heute, wunsch).n : 0);

/** Nur die Tagesleiste – nach einem Bock-Haken, ohne die ganze Liste neu zu zeichnen. */
export const tagesleisteNeu = (p, st, heute, wunsch) => (p ? tagesleiste(p, woche(p, st, heute, wunsch), heute) : '');

/** Sieben Tage nebeneinander: Wochentag, Tag, Zahl der Termine, wer Bock hat. Ein Tipp springt hin. */
function tagesleiste(p, w, heute) {
  return `<nav class="tagleiste" aria-label="Tage der Woche">${w.alleTage.map((d) => {
    const { tag, liste } = w.proTag.get(d);
    const geplant = w.geplantAm(d);
    const zahl = liste.length + geplant.length;
    const { wer } = punkte([...geplant, ...liste.map((e) => eintragTermin(e, tag, p.tage))]);
    const klassen = ['tagzelle', d === heute ? 'ist-heute' : '', d < heute ? 'vorbei' : ''].filter(Boolean).join(' ');
    const innen = `<span class="tz-wt">${wochentagKurz(d)}</span><span class="tz-nr">${Number(d.slice(8))}</span>
      <span class="tz-unter"><span class="tz-zahl">${zahl || '–'}</span>${wer.slice(0, 3).map((x) => `<i class="pkt ${x}"></i>`).join('')}</span>`;
    // Ausgeblendete Tage (vergangen, oder ohne Programm leer) stehen da, sind aber kein Sprungziel.
    return w.tage.includes(d)
      ? `<a class="${klassen}" href="#tag-${d}" aria-label="${esc(datumMitTag(d))}: ${anzahl(zahl, 'Termin', 'Termine')}${wer.length ? ', mit Bock' : ''}">${innen}</a>`
      : `<span class="${klassen}" aria-hidden="true">${innen}</span>`;
  }).join('')}</nav>`;
}

/** „Diese Woche“: Highlights und Infos des Montagslaufs, eingeklappt – zugeklappt eine Zeile Vorschau. */
function dieseWocheKasten(p) {
  if (!p.infos.length && !p.highlights.length) return '';
  const vorschau = [...p.highlights.map((h) => h.titel), ...p.infos.map((i) => i.titel || i.text)].filter(Boolean).join(' · ');
  const inhalt = `${p.highlights.length ? `<h3 class="dw-unter">${anzahl(p.highlights.length, 'Highlight', 'Highlights')}</h3>
      <ol class="highlights">${p.highlights.map((h) => `<li><strong>${esc(h.titel)}</strong><span>${esc(h.text)}</span></li>`).join('')}</ol>` : ''}
    ${p.infos.length ? `<h3 class="dw-unter">Gut zu wissen</h3>
      <ul class="infos">${p.infos.map((i) => `<li>${i.titel ? `<b>${esc(i.titel)}:</b> ` : ''}${esc(i.text)}</li>`).join('')}</ul>` : ''}`;
  return aufklappbar('diese-woche', `<span class="dw-titel">Diese Woche</span><span class="dw-vorschau">${esc(vorschau)}</span>`, inhalt, { klasse: 'woche-info' });
}

export function programmAnsicht(p, st, heute, wocheWunsch) {
  if (!p) {
    return '<div class="leer"><h2>Keine Daten</h2><p>Das Programm ließ sich nicht laden. Ohne Netz zeigt die App das zuletzt geladene – beim ersten Öffnen braucht sie einmal Verbindung.</p></div>';
  }
  const w = woche(p, st, heute, wocheWunsch);
  const { f, mo, dieseWoche, ohneProgramm, laufend } = w;
  const chips = chipsProgramm(st);
  const vorbei = dieseWoche ? w.alleTage.filter((d) => d < heute) : [];

  // Ein leerer Tag sagt, woran es liegt – mit Umkreis dessen Weite.
  const leerText = chips.length
    ? `Keine Termine für diese Filter${umkreisAn(f) ? ` bis ${f.umkreis} km` : ''}. <button type="button" class="textknopf" data-aktion="filter-weg">Alle zeigen</button>`
    : 'Keine Termine.';
  const tageHtml = w.tage.map((d) => {
    const { tag, liste, spaet, spaetOnline } = w.proTag.get(d);
    const zeilen = [
      tag.wetter ? `<div><b>Wetter:</b> ${esc(tag.wetter)}</div>` : '',
      tag.wetterOstsee ? `<div>${esc(tag.wetterOstsee)}</div>` : '',
      tag.feiertag ? '<div><b>Feiertag</b></div>' : '',
      tag.tipp ? `<div>${esc(tag.tipp)}</div>` : '',
      f.feierabend && werktag(tag) ? '<div><b>Filter aktiv:</b> nur Termine, die nach 15:30 noch gehen</div>' : '',
      spaet ? `<div>${spaetText(spaet, spaetOnline)}</div>` : '',
    ].join('');
    const geplant = w.geplantAm(d);
    return `<section class="tag${d < heute ? ' vorbei' : ''}" id="tag-${d}">
      <div class="tag-kopf"><h2>${wochentag(d)}</h2><span class="datum">${datumLang(d)}</span>${d === heute ? '<span class="heute">heute</span>' : ''}</div>
      ${zeilen ? `<div class="tag-info">${zeilen}</div>` : ''}
      ${geplant.map((e) => karte(e, { zeitSpalte: true })).join('')}
      ${liste.length ? liste.map((e) => karte(eintragTermin(e, tag, p.tage), { zeitSpalte: true })).join('') : (geplant.length && d > p.bis ? '' : `<div class="leer-klein">${d > p.bis ? 'Für diesen Tag gibt es noch kein Programm.' : leerText}</div>`)}
    </section>`;
  }).join('');

  const zahlen = `${anzahl(w.n, 'Termin', 'Termine')}${laufend.length ? ` · <a href="#abschnitt-laufend">${laufend.length} laufend</a>` : ''}`;
  const veraltet = dieseWoche && heute > p.bis
    ? '<div class="banner">Das Programm ist abgelaufen. Das neue kommt montags gegen 7 Uhr.</div>' : '';
  const hinweisOhne = ohneProgramm
    ? '<div class="banner">Für diese Woche gibt es noch kein Programm – hier stehen nur Konzerte deiner Künstler und was ihr eingeplant habt. Es kommt mit dem Montagslauf, sobald die Woche in den nächsten fünf Wochen liegt.</div>' : '';

  return `<header class="liste-kopf">
    ${navZeile({
    titel: wochenTitel(mo), heuteSchon: dieseWoche, klein: true,
    zurueck: { aktion: 'woche-zurueck', aus: mo <= w.erste },
    vor: { aktion: 'woche-vor', aus: mo >= w.letzte },
  })}
    ${filterLeiste(chips, { rechts: `<span class="zaehler" id="zaehler">${zahlen}</span>` })}
  </header>
  ${tagesleiste(p, w, heute)}
  ${veraltet}
  ${dieseWoche ? dieseWocheKasten(p) : ''}
  ${hinweisOhne}
  ${vorbei.length ? `<button type="button" class="textknopf vergangene" data-aktion="vergangene" aria-pressed="${Boolean(st.vergangeneTage)}">${st.vergangeneTage ? 'Vergangene Tage ausblenden' : `Vergangene Tage zeigen (${vorbei.length})`}</button>` : ''}
  ${tageHtml || (ohneProgramm ? '<div class="leer-klein">In dieser Woche keine Konzerte deiner Künstler und nichts eingeplant.</div>' : '')}
  ${laufend.length ? `<section class="abschnitt" id="abschnitt-laufend">
    <h2 class="abschnitt-titel">Läuft gerade<span class="abschnitt-zahl">${laufend.length}</span></h2>
    <p class="fein">Über Tage oder Wochen, mit ihren Zeiten – der Filter „Mo–Fr ab 15:30“ wirkt hier nicht.</p>
    ${laufend.map((e) => karte(eintragLaufend(e))).join('')}
  </section>` : ''}
  ${dieseWoche && p.hinweise.length ? `<section class="abschnitt"><h2 class="abschnitt-titel">Hinweise</h2><ul class="hinweise">${p.hinweise.map((h) => `<li>${h.titel ? `<b>${esc(h.titel)}:</b> ` : ''}${esc(h.text)}</li>`).join('')}</ul></section>` : ''}`;
}
