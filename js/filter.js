/*
 * Was zu sehen ist: Filter, die 21:30-Regel und was an einem Tag läuft.
 *
 * Die 21:30-Regel ist an, bis man sie abstellt (f.auchSpaet – im Filter
 * „Bis 21:30“, beim Tag „Zeigen“); dann steht auch Spätes da, und der Tag
 * sagt, wie viel davon erst nach 21:30 endet.
 *
 * Gemeinsam für Programm, Kalender und Karte – alle zeigen dieselbe Auswahl,
 * nur anders angeordnet. Den Filter dafür baut filterFuer(st): der
 * gespeicherte samt Bezugspunkt für Umkreis und Reihenfolge und dem Abzug
 * für Abwechslung. Die Reihenfolge am Tag ist sonst der Score (rang).
 *
 * Online & TV (Region ONL, `online: true`) hat keinen Ort: Der Umkreis lässt
 * es stehen, nach Entfernung steht es am Ende, und für die 21:30-Regel zählt
 * der Beginn statt des Endes.
 */
import { kostenlos, istOnline } from './text.js';
import {
  werktag, nachFeierabend, endetRechtzeitig, beginntRechtzeitig, sortierung, schonVorbei, jetzt, plusTage,
} from './zeit.js';
import { bezugVon, entfernung } from './standort.js';

export { istOnline };

/** Die Schalter im Filter: Feldname im Speicher, Beschriftung. */
export const SCHALTER = [
  ['kuenstler', '♫ Meine Künstler'],
  ['kostenlos', 'kostenlos'],
  ['feierabend', 'Mo–Fr ab 15:30'],
  ['drinnen', 'drinnen'],
  ['draussen', 'draußen'],
  ['hohwacht', 'Hohwacht-Kombi'],
];

/** Die Wahl „Art“: Wert im Speicher, Beschriftung. */
export const ART = [['', 'Alles'], ['vorort', 'Vor Ort'], ['online', 'Online & TV']];

/** Der Score eines Termins (0–100, vom Monatslauf – README „Woher die Daten kommen“); ohne einen die Mitte. */
export const score = (e) => (Number.isInteger(e && e.score) ? e.score : 50);

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Abwechslung: Was man selbst schon vorhat – die eigenen Haken auf Terminen
 * und Eingeplantes mit Kategorie –, drückt andere Termine derselben
 * Kategorie in den sechs Tagen davor und danach, je Vorhaben um 8 Punkte,
 * höchstens um 24. Wer jeden Abend Schach schaut, sieht am nächsten Abend
 * zuerst etwas anderes. Konzerte der eigenen Künstler drückt das nie.
 * Gibt (e, Tag) => Abzug zurück.
 */
export const ABWECHSLUNG = { je: 8, hoechstens: 24, tage: 6 };
export function abwechslung(bock) {
  const vorhaben = Object.entries(bock || {})
    .filter(([k, b]) => b && b.kategorie && ISO.test(b.datum || '') && !k.startsWith('z:'))
    .map(([k, b]) => ({ k, kategorie: b.kategorie, datum: b.datum }));
  if (!vorhaben.length) return () => 0;
  return (e, iso) => {
    if (e.kuenstler) return 0;
    const von = plusTage(iso, -ABWECHSLUNG.tage);
    const bis = plusTage(iso, ABWECHSLUNG.tage);
    // Der Termin selbst an anderen Tagen zählt nicht – ob Daten (id) oder Eintrag (schluessel t:<id>:<Tag>).
    const selbst = e.schluessel ? e.schluessel.slice(0, e.schluessel.lastIndexOf(':') + 1) : `t:${e.id}:`;
    const n = vorhaben.filter((v) => v.kategorie === e.kategorie && v.datum >= von && v.datum <= bis && !v.k.startsWith(selbst)).length;
    return Math.min(ABWECHSLUNG.hoechstens, n * ABWECHSLUNG.je);
  };
}

/** Wie weit oben ein Termin an einem Tag steht: sein Score abzüglich der Abwechslung (f.malus aus filterFuer). */
export const rang = (e, iso, f) => score(e) - (f && f.malus ? f.malus(e, iso) : 0);

/** Derselbe Titel – etwa ein Film in drei Kinos – zählt in den Bestenlisten nur einmal. */
export const titelSchluessel = (e) => String(e.titel || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');

/**
 * „Das Beste zuerst“ an einem Tag: nach Rang, bei Gleichstand das Nähere
 * (mit Bezugspunkt), sonst wie gehabt nach Uhrzeit. Läuft derselbe Titel
 * mehrmals (ein Film in mehreren Kinos), steht nur der beste in `erste` –
 * die übrigen in `weitere`, für unten.
 */
export function besteZuerst(liste, iso, f) {
  const sortiert = [...liste].sort((a, b) => rang(b, iso, f) - rang(a, iso, f) || (f.bezug ? abstand(a, f) - abstand(b, f) || 0 : 0));
  const gesehen = new Set();
  const erste = [];
  const weitere = [];
  for (const e of sortiert) {
    const k = titelSchluessel(e);
    (gesehen.has(k) ? weitere : erste).push(e);
    gesehen.add(k);
  }
  return { erste, weitere };
}

/** Die Reihenfolge am Tag: 'beste' (Vorgabe), 'zeit' oder – nur mit Bezugspunkt – 'entfernung'. */
export const reihenfolge = (f) => {
  if (f.bezug && f.nachEntfernung) return 'entfernung';
  return f.nachZeit ? 'zeit' : 'beste';
};

/**
 * Der Filter, wie er gilt: der gespeicherte (st.filter) mit dem
 * Bezugspunkt für Umkreis und Reihenfolge (st.standort) – ohne Bezugspunkt
 * wirken beide nicht – und dem Abzug für Abwechslung (malus, aus den
 * eigenen Haken).
 */
export const filterFuer = (st) => ({ ...st.filter, bezug: bezugVon(st), malus: abwechslung(st.bock) });

/** Ist der Umkreis an – mit Bezugspunkt? */
export const umkreisAn = (f) => Boolean(f.bezug && f.umkreis > 0);

/** Wie weit ein Eintrag vom Bezugspunkt weg ist; ohne Ort (auch Online & TV) unendlich – das sortiert ans Ende. */
const abstand = (e, f) => {
  const km = istOnline(e) ? null : entfernung(f.bezug, e.geo);
  return km === null ? Infinity : km;
};

/** Nach Nähe zuerst, wenn so gewünscht – sonst 0 (gleich), dann entscheidet der Rest. */
const naeher = (a, b, f) => {
  if (!f.bezug || !f.nachEntfernung) return 0;
  const d = abstand(a, f) - abstand(b, f);
  return Number.isNaN(d) ? 0 : d;
};

/**
 * Art, Regionen (eine davon muss es sein), Kategorie, die Schalter und der Umkreis – ohne Zeitbezug. Im
 * Umkreis fällt weg, was keinen Ort hat; Online & TV bleibt, das schaut man,
 * wo man ist.
 */
export function passt(e, f) {
  const online = istOnline(e);
  if (f.art === 'online' && !online) return false;
  if (f.art === 'vorort' && online) return false;
  if (umkreisAn(f) && !online && abstand(e, f) > f.umkreis) return false;
  if (f.regionen && f.regionen.length && !f.regionen.includes(e.region)) return false;
  if (f.kategorie && e.kategorie !== f.kategorie) return false;
  if (f.kostenlos && !kostenlos(e)) return false;
  if (f.drinnen && !f.draussen && e.draussen === 'draußen') return false;
  if (f.draussen && !f.drinnen && e.draussen === 'drinnen') return false;
  if (f.hohwacht && !(e.hohwacht || e.region === 'HB')) return false;
  if (f.kuenstler && !e.kuenstler) return false;
  return true;
}

/** Ist irgendein Filter an – auch Art und Umkreis? Und ist die 21:30-Regel abgestellt (auch das weicht vom Üblichen ab)? */
export const filterAn = (f) => Boolean(f.art || (f.regionen && f.regionen.length) || f.kategorie || SCHALTER.some(([k]) => f[k]) || umkreisAn(f) || f.auchSpaet);

/** Der Tag aus den Daten – oder ein nackter, wenn die Daten ihn nicht kennen. */
export const tagVon = (p, iso) => p.tage.find((t) => t.datum === iso) || { datum: iso };

/**
 * Was an einem Tag steht – und wie viele die 21:30-Regel weggenommen hat
 * (spaet), davon wie viele Online & TV (spaetOnline). Vor Ort zählt das
 * Ende, online der Beginn; für Konzerte der eigenen Künstler gilt die Regel
 * nicht. Mit f.auchSpaet bleiben sie stehen – spaet zählt dann, wie viele
 * davon da sind, `spaete` sind genau die. Was heute schon zu Ende ist, fehlt
 * ganz (schonVorbei, `j`: jetzt). Sortiert nach Uhrzeit (Ganztägiges zuerst)
 * – oder, mit nachEntfernung, das Nächste zuerst.
 */
export function termineAm(p, iso, f, j = jetzt()) {
  const tag = tagVon(p, iso);
  const basis = p.termine.filter((e) => e.daten.includes(iso) && passt(e, f) && !schonVorbei(e, iso, j)
    && (!f.feierabend || !werktag(tag) || nachFeierabend(e, iso)));
  const rechtzeitig = (e) => e.kuenstler || (istOnline(e) ? beginntRechtzeitig(e, tag, p.tage) : endetRechtzeitig(e, tag, p.tage));
  const liste = basis.filter((e) => f.auchSpaet || rechtzeitig(e))
    .sort((a, b) => naeher(a, b, f) || sortierung(a, iso) - sortierung(b, iso) || a.titel.localeCompare(b.titel, 'de'));
  const weg = basis.filter((e) => !rechtzeitig(e));
  return {
    tag, liste, spaet: weg.length, spaetOnline: weg.filter(istOnline).length, spaete: new Set(weg),
  };
}

/**
 * „Ausgeblendet: 1 Termin, der erst nach 21:30 endet“ – und was online erst
 * nach 21:30 beginnt. Ist die Regel abgestellt (gezeigt): „Mit dabei: …“.
 */
export function spaetText(spaet, spaetOnline = 0, gezeigt = false) {
  const vorOrt = spaet - spaetOnline;
  const teile = [
    vorOrt ? (vorOrt === 1 ? '1 Termin, der erst nach 21:30 endet' : `${vorOrt} Termine, die erst nach 21:30 enden`) : '',
    spaetOnline ? (spaetOnline === 1 ? '1 Online-Termin, der erst nach 21:30 beginnt' : `${spaetOnline} Online-Termine, die erst nach 21:30 beginnen`) : '',
  ].filter(Boolean);
  return teile.length ? `${gezeigt ? 'Mit dabei' : 'Ausgeblendet'}: ${teile.join(' und ')}` : '';
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
