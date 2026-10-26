/*
 * Reiter „Konzerte“: Konzerte deiner Künstler in Hamburg und Umgebung, die
 * der Samstags-Musikcheck einträgt – neu Angekündigtes zuerst, dann nach Monat.
 *
 * Die 21:30-Regel gilt hier nicht: Für eine Band, die man wirklich sehen will,
 * bleibt man auch an einem Donnerstag länger.
 */
import { esc } from './text.js';
import { wochentagKurz, tagMonat, monatJahr, standText } from './zeit.js';
import { karte, eintragKonzert } from './karte.js';

const spalte = (k) => `${wochentagKurz(k.datum)} ${tagMonat(k.datum)}`;
const reihenfolge = (a, b) => (a.datum + (a.zeit || '')).localeCompare(b.datum + (b.zeit || ''));

export function konzerteAnsicht(daten, heute) {
  const kommend = (daten.konzerte || []).filter((k) => k.datum >= heute).sort(reihenfolge);
  const stand = daten.stand ? `<p class="fein">Stand: ${esc(standText(daten.stand))} · Der Musikcheck aktualisiert die Liste samstags.</p>` : '';
  if (!kommend.length) {
    return `<header class="woche-kopf"><h2 class="abschnitt-titel">Konzerte deiner Künstler</h2></header>
      <div class="leer"><p>Noch keine Konzerte eingetragen. Der Samstags-Musikcheck sucht sie in Hamburg und bis etwa 100 km drumherum und trägt sie hier ein.</p></div>${stand}`;
  }
  const neu = kommend.filter((k) => k.neu);
  const monate = new Map();
  kommend.forEach((k) => {
    const m = monatJahr(k.datum);
    if (!monate.has(m)) monate.set(m, []);
    monate.get(m).push(k);
  });
  const liste = (ks) => ks.map((k) => karte(eintragKonzert(k), { zeitSpalte: true, zeitText: spalte(k) })).join('');
  return `<header class="woche-kopf"><h2 class="abschnitt-titel">Konzerte deiner Künstler</h2>${stand}</header>
    ${neu.length ? `<section class="abschnitt"><h2 class="monat">Neu angekündigt</h2>${liste(neu)}</section>` : ''}
    ${[...monate].map(([m, ks]) => `<section class="abschnitt"><h2 class="monat">${esc(m)}</h2>${liste(ks)}</section>`).join('')}`;
}
