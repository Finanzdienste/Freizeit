/*
 * Kleine Textwerkzeuge für die Anzeige.
 */

const ZEICHEN = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Für HTML-Text und Attributwerte. Alles aus den Daten geht hier durch. */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ZEICHEN[c]);

/** „1 Termin“ / „3 Termine“ */
export const anzahl = (n, eins, viele) => `${n} ${n === 1 ? eins : viele}`;

export const REGIONEN = {
  HH: 'Hamburg',
  LUE: 'Lübeck & Ostsee',
  LG: 'Lüneburg & Heide',
  STD: 'Stade & Altes Land',
  HB: 'Hohwachter Bucht & Kiel',
  WIS: 'Wismar',
  WEI: 'Weitere Ziele',
};

export const DRAUSSEN = { drinnen: 'drinnen', draußen: 'draußen', beides: 'drinnen & draußen' };

/** Kostenlos laut Feld oder Preisangabe. */
export const kostenlos = (e) => Boolean(e.kostenlos) || /^(kostenlos|Eintritt frei)/i.test(e.preis || '');

/** Preisangaben ohne Aussage lohnen keine Zeile in einer Nachricht. */
export const preisSagtWas = (p) => Boolean(p) && !/^Preis (nicht|im Flyer nicht)/.test(p);

/**
 * Nur Links mit http(s) – javascript:, data: und alles andere wird leer.
 * Was von außen kommt (Datendatei, Häkchen der anderen), geht hier durch,
 * bevor es in ein href wandert.
 */
export const sichererLink = (u) => (/^https?:\/\/\S+$/i.test(String(u || '')) ? String(u) : '');
