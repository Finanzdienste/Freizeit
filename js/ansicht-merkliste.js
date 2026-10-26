/*
 * Reiter „Merkliste“: was du dir gemerkt hast, nach Datum.
 *
 * Gemerkt wird eine Kopie des Eintrags (siehe karte.js). Darum bleibt er
 * vollständig, auch wenn der nächste Montag die Wochendaten ersetzt.
 * Vergangenes rutscht nach unten und lässt sich mit einem Tipp wegräumen.
 */
import { anzahl } from './text.js';
import { wochentagKurz, tagMonat } from './zeit.js';
import { karte } from './karte.js';

/** Wann ist ein gemerkter Eintrag vorbei? Termine am Tag danach, Wochenangebote nach Sonntag. */
export const vorbei = (m, heute) => (m.datum ? m.datum < heute : Boolean(m.bis) && m.bis < heute);

const spalte = (m) => {
  if (m.datum) return `${wochentagKurz(m.datum)} ${tagMonat(m.datum)}`;
  if (m.von && m.bis) return `${tagMonat(m.von)}–${tagMonat(m.bis)}`;
  return 'jederzeit';
};

const sortiert = (liste) => [...liste].sort((a, b) => {
  const s = (m) => m.datum || m.bis || '9999';
  return (s(a) + (a.zeit || '')).localeCompare(s(b) + (b.zeit || ''));
});

export function merklisteAnsicht(liste, heute) {
  if (!liste.length) {
    return '<header class="woche-kopf"><h2 class="abschnitt-titel">Merkliste</h2></header><div class="leer"><p>Noch nichts gemerkt. Tippe bei einem Termin, Konzert oder Ausflugsziel auf „Merken“, dann steht er hier – auch nach dem nächsten Wochenwechsel.</p></div>';
  }
  const kommend = sortiert(liste.filter((m) => !vorbei(m, heute)));
  const alt = sortiert(liste.filter((m) => vorbei(m, heute)));
  const karten = (ms) => ms.map((m) => karte(m, { zeitSpalte: true, zeitText: spalte(m), entfernen: true })).join('');
  return `<header class="woche-kopf"><h2 class="abschnitt-titel">Merkliste</h2><p class="fein">${anzahl(kommend.length, 'Eintrag', 'Einträge')} vor dir.</p></header>
    ${kommend.length ? `<section class="abschnitt">${karten(kommend)}</section>` : ''}
    ${alt.length ? `<section class="abschnitt vorbei-liste"><div class="zeile"><h2 class="monat">Vorbei</h2><button type="button" class="knopf" data-aktion="vorbei-weg">Vorbei entfernen</button></div>${karten(alt)}</section>` : ''}`;
}
