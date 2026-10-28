/*
 * Was zu sehen ist: Filter, die 21:30-Regel und was an einem Tag läuft.
 *
 * Gemeinsam für Programm, Kalender und Karte – alle drei zeigen dieselbe
 * Auswahl, nur anders angeordnet. Den Filter dafür baut filterFuer(st):
 * der gespeicherte samt Bezugspunkt für Umkreis und Reihenfolge.
 */
import { kostenlos } from './text.js';
import { werktag, nachFeierabend, endetRechtzeitig, sortierung } from './zeit.js';
import { bezugVon, entfernung } from './standort.js';

/** Die Schalter in der Filterleiste: Feldname im Speicher, Beschriftung. */
export const SCHALTER = [
  ['kuenstler', '♫ Meine Künstler'],
  ['kostenlos', 'kostenlos'],
  ['feierabend', 'Mo–Fr ab 15:30'],
  ['drinnen', 'drinnen'],
  ['draussen', 'draußen'],
  ['hohwacht', 'Hohwacht-Kombi'],
];

/**
 * Der Filter, wie er gilt: der gespeicherte (st.filter) mit dem
 * Bezugspunkt für Umkreis und Reihenfolge (st.standort). Ohne Bezugspunkt
 * wirken beide nicht.
 */
export const filterFuer = (st) => ({ ...st.filter, bezug: bezugVon(st) });

/** Ist der Umkreis an – mit Bezugspunkt? */
export const umkreisAn = (f) => Boolean(f.bezug && f.umkreis > 0);

/** Wie weit ein Eintrag vom Bezugspunkt weg ist; ohne Ort oder Bezugspunkt unendlich – das sortiert ans Ende. */
const abstand = (e, f) => {
  const km = entfernung(f.bezug, e.geo);
  return km === null ? Infinity : km;
};

/** Nach Nähe zuerst, wenn so gewünscht – sonst 0 (gleich), dann entscheidet der Rest. */
const naeher = (a, b, f) => {
  if (!f.bezug || !f.nachEntfernung) return 0;
  const d = abstand(a, f) - abstand(b, f);
  return Number.isNaN(d) ? 0 : d;
};

/** Region, Kategorie, die Schalter und der Umkreis – ohne Zeitbezug. Im Umkreis fällt weg, was keinen Ort hat. */
export function passt(e, f) {
  if (umkreisAn(f) && abstand(e, f) > f.umkreis) return false;
  if (f.region && e.region !== f.region) return false;
  if (f.kategorie && e.kategorie !== f.kategorie) return false;
  if (f.kostenlos && !kostenlos(e)) return false;
  if (f.drinnen && !f.draussen && e.draussen === 'draußen') return false;
  if (f.draussen && !f.drinnen && e.draussen === 'drinnen') return false;
  if (f.hohwacht && !(e.hohwacht || e.region === 'HB')) return false;
  if (f.kuenstler && !e.kuenstler) return false;
  return true;
}

/** Ist irgendein Filter an – auch der Umkreis? */
export const filterAn = (f) => Boolean(f.region || f.kategorie || SCHALTER.some(([k]) => f[k]) || umkreisAn(f));

/** Der Tag aus den Daten – oder ein nackter, wenn die Daten ihn nicht kennen. */
export const tagVon = (p, iso) => p.tage.find((t) => t.datum === iso) || { datum: iso };

/**
 * Was an einem Tag steht – und wie viele die 21:30-Regel weggenommen hat.
 * Für Konzerte der eigenen Künstler gilt die Regel nicht. Sortiert nach
 * Uhrzeit (Ganztägiges zuerst) – oder, mit nachEntfernung, das Nächste zuerst.
 */
export function termineAm(p, iso, f) {
  const tag = tagVon(p, iso);
  const basis = p.termine.filter((e) => e.daten.includes(iso) && passt(e, f)
    && (!f.feierabend || !werktag(tag) || nachFeierabend(e, iso)));
  const liste = basis.filter((e) => e.kuenstler || endetRechtzeitig(e, tag, p.tage))
    .sort((a, b) => naeher(a, b, f) || sortierung(a, iso) - sortierung(b, iso) || a.titel.localeCompare(b.titel, 'de'));
  return { tag, liste, spaet: basis.length - liste.length };
}

/** Was über mehrere Wochen läuft und sich mit dem Zeitraum von–bis überschneidet – zuerst, was bald endet (oder was nah ist). */
export const laufendZwischen = (p, von, bis, f) => p.laufend
  .filter((e) => e.von <= bis && von <= e.bis && passt(e, f))
  .sort((a, b) => naeher(a, b, f) || a.bis.localeCompare(b.bis) || a.titel.localeCompare(b.titel, 'de'));

/** Alle Kategorien, die vorkommen – für die Auswahl im Filter. */
export const kategorien = (p) => [...new Set([...p.termine, ...p.laufend]
  .map((e) => e.kategorie).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));

/** Der letzte Tag mit irgendeinem Termin – Konzerte und Eingeplantes reichen Monate voraus. */
export const letzterTag = (p, extra = []) => [p.bis, ...p.termine.flatMap((e) => e.daten), ...extra].sort().pop();
