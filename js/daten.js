/*
 * Die Daten der App: daten/programm.json, geschrieben vom Montagslauf.
 *
 * Das Format steht in README.md. Hier wird nur geladen und so weit geprüft,
 * dass ein kaputter Lauf die App nicht leer zurücklässt: Was nicht passt,
 * fällt weg, und die Fehler werden angezeigt statt verschluckt. Links ohne
 * http(s) werden leer, Koordinaten außerhalb des Möglichen fallen weg.
 */
import { sichererLink } from './text.js';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

async function holen(pfad) {
  // no-cache: Der Browser fragt immer beim Server nach. Ohne Netz antwortet
  // der Service Worker mit der zuletzt geladenen Fassung.
  const res = await fetch(pfad, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${pfad}: HTTP ${res.status}`);
  return res.json();
}

const liste = (x) => (Array.isArray(x) ? x : []);
const geoOk = (g) => Array.isArray(g) && g.length === 2
  && g.every((x) => typeof x === 'number' && Number.isFinite(x))
  && Math.abs(g[0]) <= 90 && Math.abs(g[1]) <= 180;
const sauber = (e) => ({ ...e, link: sichererLink(e.link), geo: geoOk(e.geo) ? e.geo : null });

/** Programm prüfen: Termine mit Titel und Tagen, Laufendes mit Zeitraum, Ziele mit Titel. */
export function programmBereinigen(roh, fehler = []) {
  if (!roh || typeof roh !== 'object' || roh.version !== 2) {
    fehler.push('programm.json ist leer oder hat ein unbekanntes Format');
    return null;
  }
  if (!ISO.test(roh.von || '') || !ISO.test(roh.bis || '')) {
    fehler.push('programm.json: von/bis fehlen');
    return null;
  }
  const termine = liste(roh.termine).filter((e) => {
    const ok = e && e.titel && liste(e.daten).length && liste(e.daten).every((d) => ISO.test(d));
    if (!ok) fehler.push(`Termin ohne Titel oder Datum übersprungen: ${JSON.stringify(e).slice(0, 80)}`);
    return ok;
  }).map(sauber);
  const laufend = liste(roh.laufend).filter((e) => {
    const ok = e && e.titel && ISO.test(e.von || '') && ISO.test(e.bis || '') && e.von <= e.bis;
    if (!ok) fehler.push(`Laufendes Angebot ohne Titel oder Zeitraum übersprungen: ${JSON.stringify(e).slice(0, 80)}`);
    return ok;
  }).map(sauber);
  return {
    ...roh,
    tage: liste(roh.tage).filter((t) => t && ISO.test(t.datum || '')),
    termine,
    laufend,
    immer: liste(roh.immer).filter((e) => e && e.titel).map(sauber),
    infos: liste(roh.infos),
    highlights: liste(roh.highlights),
    hinweise: liste(roh.hinweise),
  };
}

export async function ladeAlles() {
  const fehler = [];
  try {
    const programm = programmBereinigen(await holen('daten/programm.json'), fehler);
    return { programm, fehler };
  } catch (e) {
    fehler.push(`Programm nicht geladen (${e.message})`);
    return { programm: null, fehler };
  }
}
