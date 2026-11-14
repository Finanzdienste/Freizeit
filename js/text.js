/*
 * Kleine Textwerkzeuge für die Anzeige.
 */

const ZEICHEN = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Für HTML-Text und Attributwerte. Alles aus den Daten geht hier durch. */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ZEICHEN[c]);

/** „1 Termin“ / „3 Termine“ */
export const anzahl = (n, eins, viele) => `${n} ${n === 1 ? eins : viele}`;

/**
 * Die Regionen der Termine. Das Umland reicht so weit, wie man von zuhause
 * (Wandsbek) in gut einer Stunde mit dem Auto kommt – dazu Hohwacht, Wismar
 * und Hannover. ONL ist keine Gegend, sondern „Online & TV“: Live-Events zum
 * Zuschauen (Stream, Fernsehen) – ohne Ort, ohne Anreise.
 */
export const REGIONEN = {
  HH: 'Hamburg',
  AHR: 'Ahrensburg & Stormarn',
  SE: 'Norderstedt & Segeberg',
  PI: 'Pinneberg & Elmshorn',
  RZ: 'Herzogtum Lauenburg',
  LUE: 'Lübeck & Ostsee',
  LG: 'Lüneburg & Heide',
  STD: 'Stade & Altes Land',
  HB: 'Hohwachter Bucht & Kiel',
  WIS: 'Wismar',
  HAN: 'Hannover',
  WEI: 'Weitere Ziele',
  ONL: 'Online & TV',
};

/**
 * Regionen, die die App gerade nicht zeigt – ihre Termine fallen beim Laden
 * weg, im Filter stehen sie nicht. Seit 14.11.2026 Hannover und Wismar: Tobi
 * plant zurzeit nur Hamburg mit Umland und die Hohwachter Bucht; was weiter
 * weg liegt, nur als besonderer Tagesausflug am Wochenende – das trägt dann
 * die Region WEI. Wieder aufnehmen: hier herausnehmen und den Monatslauf
 * wieder dort suchen lassen (CLAUDE.md, „Ausgesetzt“).
 */
export const AUSGEBLENDET = new Set(['HAN', 'WIS']);

/** Die Regionen, die man vor Ort besuchen kann – für die Auswahl „Wo“ im Filter. */
export const ORTE = Object.entries(REGIONEN).filter(([k]) => k !== 'ONL' && !AUSGEBLENDET.has(k));

export const DRAUSSEN = { drinnen: 'drinnen', draußen: 'draußen', beides: 'drinnen & draußen' };

/** Kostenlos laut Feld oder Preisangabe. */
export const kostenlos = (e) => Boolean(e.kostenlos) || /^(kostenlos|Eintritt frei)/i.test(e.preis || '');

/** Online & TV: zum Zuschauen im Stream oder im Fernsehen. `ort` ist dann der Sender. */
export const istOnline = (e) => Boolean(e && (e.online === true || e.region === 'ONL'));

/** Preisangaben ohne Aussage lohnen keine Zeile in einer Nachricht. */
export const preisSagtWas = (p) => Boolean(p) && !/^Preis (nicht|im Flyer nicht)/.test(p);

/**
 * Nur Links mit http(s) – javascript:, data: und alles andere wird leer.
 * Was von außen kommt (Datendatei, Häkchen der anderen), geht hier durch,
 * bevor es in ein href wandert.
 */
export const sichererLink = (u) => (/^https?:\/\/\S+$/i.test(String(u || '')) ? String(u) : '');
