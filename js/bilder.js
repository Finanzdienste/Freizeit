/*
 * Bilder an den Karten: ein freies Foto der Spielstätte – sonst ein
 * gezeichnetes Motiv der Kategorie.
 *
 * Die Fotos stammen von Wikimedia Commons (werkzeug/ortsbilder.py): nur
 * Fotos der Orte, nie von Veranstaltern oder Künstlern, nur freie Lizenzen.
 * daten/ortsbilder.json ordnet jedem Ort („Thalia Theater, Altstadt“) ein
 * Bild zu und nennt Objekt, Urheber, Lizenz und Dateiseite; die Dateien
 * liegen verkleinert unter bilder/orte/ (<name>-klein.webp für die Vorschau,
 * <name>.webp groß). Zugeklappt steht das kleine Bild vorn an der Karte,
 * aufgeklappt das große mit Fotograf und Lizenz darunter; alle Nachweise
 * stehen außerdem in den Einstellungen.
 *
 * Die Motive sind eigene Zeichnungen, als <symbol id="m-…"> in index.html.
 */
import { esc, istOnline, sichererLink } from './text.js';

/** Kategorie → Motiv. Online & TV ohne eigene Kategorie: der Bildschirm; Unbekanntes: der Kalender. */
const MOTIVE = {
  Konzert: 'konzert',
  Bühne: 'buehne',
  Sport: 'sport',
  Lesung: 'lesung',
  'Fest & Saisonal': 'fest',
  Ausstellung: 'ausstellung',
  Markt: 'markt',
  Comedy: 'comedy',
  Führung: 'fuehrung',
  Erlebnis: 'erlebnis',
  Kino: 'kino',
  Food: 'food',
  Party: 'party',
  Schach: 'schach',
  'Outdoor & Natur': 'natur',
};
export const MOTIV_NAMEN = [...new Set(Object.values(MOTIVE)), 'online', 'sonst'];

const PFAD = 'bilder/orte/';
const NAME = /^[a-z0-9][a-z0-9-]{0,80}$/;
const text = (s, max = 160) => (typeof s === 'string' ? s.trim().slice(0, max) : '');

let orte = new Map();
let bilder = new Map();

/** Die Zuordnung aus daten/ortsbilder.json übernehmen – geprüft: Namen nur [a-z0-9-], Links nur http(s), Texte gekürzt. */
export function ortsbilderSetzen(roh) {
  orte = new Map();
  bilder = new Map();
  if (!roh || typeof roh !== 'object') return;
  for (const [name, b] of Object.entries(roh.bilder || {})) {
    if (!NAME.test(name) || !b || typeof b !== 'object') continue;
    const lizenz = text(b.lizenz, 40);
    const seite = sichererLink(b.seite);
    if (!lizenz || !seite) continue;
    bilder.set(name, {
      name,
      objekt: text(b.objekt, 80) || 'Ort',
      urheber: text(b.urheber, 120) || 'unbekannt',
      lizenz,
      lizenzLink: sichererLink(b.lizenzLink),
      seite,
    });
  }
  for (const [ort, name] of Object.entries(roh.orte || {})) {
    if (typeof ort === 'string' && bilder.has(name)) orte.set(ort, name);
  }
}

/** Das Foto zu einem Eintrag (über seinen Ort) – oder null. Online & TV hat keinen Ort. */
export function fotoZu(eintrag) {
  if (!eintrag || !eintrag.ort || istOnline(eintrag)) return null;
  const b = bilder.get(orte.get(eintrag.ort));
  return b ? { ...b, klein: `${PFAD}${b.name}-klein.webp`, gross: `${PFAD}${b.name}.webp` } : null;
}

/** Das Motiv zu einem Eintrag: nach Kategorie, sonst Bildschirm (Online & TV) oder Kalender. */
export const motivZu = (eintrag) => MOTIVE[eintrag && eintrag.kategorie] || (istOnline(eintrag) ? 'online' : 'sonst');

export const motivHtml = (motiv) => `<span class="bildchen motiv m-${motiv}" aria-hidden="true"><svg focusable="false"><use href="#m-${motiv}"/></svg></span>`;

/** Das kleine Bild vorn an der Karte: das Foto des Orts oder das Motiv. */
export function bildchen(eintrag) {
  const f = fotoZu(eintrag);
  if (!f) return motivHtml(motivZu(eintrag));
  return `<img class="bildchen foto" src="${esc(f.klein)}" alt="" width="56" height="56" loading="lazy" decoding="async" data-motiv="${motivZu(eintrag)}">`;
}

/** Wer das Foto gemacht hat, unter welcher Lizenz, und wo es herkommt. */
const nachweis = (f) => {
  const lizenz = f.lizenzLink ? `<a href="${esc(f.lizenzLink)}" target="_blank" rel="noopener license">${esc(f.lizenz)}</a>` : esc(f.lizenz);
  return `Foto: ${esc(f.urheber)}, ${lizenz}, <a href="${esc(f.seite)}" target="_blank" rel="noopener">Wikimedia Commons</a>`;
};

/** Aufgeklappt: das Foto groß, darunter der Nachweis. */
export function ortsfoto(eintrag) {
  const f = fotoZu(eintrag);
  if (!f) return '';
  return `<figure class="ortsfoto"><img src="${esc(f.gross)}" alt="${esc(f.objekt)}" loading="lazy" decoding="async">
      <figcaption><span class="ortsfoto-was">${esc(f.objekt)}</span> · ${nachweis(f)}</figcaption></figure>`;
}

/** Alle Fotos mit Nachweis – für die Einstellungen. */
export function bildnachweise() {
  const liste = [...bilder.values()].sort((a, b) => a.objekt.localeCompare(b.objekt, 'de'));
  if (!liste.length) return '';
  return `<details class="e-zeile bildnachweise" data-offen="bildnachweise"><summary>Fotos der Orte (${liste.length}) – Nachweise</summary>
    <p class="fein">Freie Fotos von Wikimedia Commons, verkleinert. Die Motive ohne Foto sind eigene Zeichnungen.</p>
    <ul>${liste.map((f) => `<li><b>${esc(f.objekt)}</b> – ${nachweis(f)}</li>`).join('')}</ul></details>`;
}
