/*
 * Datum, Uhrzeit und die beiden Zeitregeln der Freizeit-App.
 *
 * Reine Rechnung ohne Anzeige, damit die Tests sie direkt prüfen können.
 *
 *   Mo–Fr ab 15:30   ein Filter zum Einschalten: An Werktagen bleibt nur, was
 *                    nach Feierabend noch geht.
 *   bis 21:30        immer an: Abends vor einem Arbeitstag (So–Do) steht nur,
 *                    was spätestens um 21:30 endet. Wer am nächsten Morgen ins
 *                    Büro muss, will um zehn zu Hause sein.
 *
 * Alle Tage sind ISO-Daten („2026-10-28“). Gerechnet wird mittags, damit die
 * Umstellung auf Winterzeit kein Datum verschiebt.
 */

export const NACH_FEIERABEND = 15 * 60 + 30;
export const SPAETESTES_ENDE = 21 * 60 + 30;
export const SPAETESTER_BEGINN_OFFEN = 20 * 60 + 30;

/** Richtwerte für die Dauer in Minuten, wenn weder Ende noch Dauer bekannt sind. */
export const DAUER = {
  Konzert: 135, Bühne: 150, Comedy: 135, Party: 300, Sport: 120,
  Führung: 90, Erlebnis: 90, Food: 150, Kino: 130,
};
/** Zum Kommen und Gehen: Hier zählt nicht das Ende, sondern ob man vor 20:30 hinkommt. */
export const KOMMEN_UND_GEHEN = new Set(['Markt', 'Fest & Saisonal', 'Ausstellung']);

const TAGNAMEN = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

const zwei = (n) => String(n).padStart(2, '0');

/** Heute als ISO-Datum in der Zeitzone des Geräts. */
export function heute() {
  const d = new Date();
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
}

/** Jetzt in Minuten seit Mitternacht. */
export function jetztMinuten() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

const mittag = (iso) => new Date(`${iso}T12:00:00`);

export function plusTage(iso, n) {
  const d = mittag(iso);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
}

export const wochentag = (iso) => TAGNAMEN[mittag(iso).getDay()];
export const wochentagKurz = (iso) => wochentag(iso).slice(0, 2);
/** „28.10.“ */
export const tagMonat = (iso) => `${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}.`;
/** „28.10.2026“ */
export const datumLang = (iso) => `${tagMonat(iso)}${iso.slice(0, 4)}`;
/** „Mittwoch, 28.10.2026“ */
export const datumMitTag = (iso) => `${wochentag(iso)}, ${datumLang(iso)}`;
/** „Oktober 2026“ */
export const monatJahr = (iso) => `${MONATE[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

/** „2026-10-26T07:03“ → „Mo 26.10., 07:03 Uhr“; nur ein Datum → „Mo 26.10.“ */
export function standText(stand) {
  const m = String(stand || '').match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/);
  if (!m) return '';
  return `${wochentagKurz(m[1])} ${tagMonat(m[1])}${m[2] ? `, ${m[2]} Uhr` : ''}`;
}

export const minuten = (h, m) => Number(h) * 60 + Number(m);
/** 1290 → „21:30“, auch über Mitternacht hinaus. */
export const uhrzeit = (t) => `${zwei(Math.floor(t / 60) % 24)}:${zwei(t % 60)}`;

const ZEIT = /(\d{1,2}):(\d{2})/;
const ZEITRAUM = /(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/;

/** Die Uhrzeit eines Termins an einem Tag: abweichende Tageszeit, sonst die übliche. */
export const zeitAm = (e, iso) => String((e.zeiten && e.zeiten[iso]) || e.zeit || '');

/** Erste Uhrzeit im Text in Minuten, sonst null. */
export function beginn(text) {
  const m = String(text).match(ZEIT);
  return m ? minuten(m[1], m[2]) : null;
}

export const istWochenende = (iso) => /^(Samstag|Sonntag)$/.test(wochentag(iso));

/**
 * Ist der Abend dieses Tages einer vor einem Arbeitstag?
 *
 * Freitag und Samstag nie. Sonst entscheidet der Folgetag: Ist er ein
 * Feiertag, gilt die Grenze nicht. Den Folgetag des Sonntags kennt die Woche
 * nicht – dafür steht am Sonntag `vorFeiertag`.
 */
export function abendVorArbeitstag(tag, tage = []) {
  if (/^(Freitag|Samstag)$/.test(wochentag(tag.datum)) || tag.vorFeiertag) return false;
  const morgen = tage.find((t) => t.datum === plusTage(tag.datum, 1));
  return !(morgen && morgen.feiertag);
}

/** Werktag im Sinn des 15:30-Filters: Mo–Fr und kein Feiertag. */
export const werktag = (tag) => !istWochenende(tag.datum) && !tag.feiertag;

/** Wie lange ein Termin dauert, in Minuten. */
export function dauer(e) {
  if (e.dauer) return Number(e.dauer);
  const text = e.beschreibung || '';
  let m = text.match(/(\d{1,2}):(\d{2})\s*Std/);
  if (m) return minuten(m[1], m[2]);
  m = text.match(/(\d{2,3})\s*Min/);
  if (m) return Number(m[1]);
  m = text.match(/ca\.\s*(\d+(?:,\d+)?)\s*Stunden?/);
  if (m) return Math.round(parseFloat(m[1].replace(',', '.')) * 60);
  if (e.kategorie === 'Konzert' && /Elbphilharmonie|Laeiszhalle|Konzertsaal|Konzerthaus|Kirche/.test(e.ort || '')) return 120;
  return DAUER[e.kategorie] || 120;
}

/** Zum Kommen und Gehen statt mit festem Ende? */
export function offen(e, iso) {
  const z = zeitAm(e, iso);
  return KOMMEN_UND_GEHEN.has(e.kategorie) || (/\bab\b/.test(z) && !ZEITRAUM.test(z));
}

/**
 * Das Ende eines Termins an einem Tag.
 * @returns {{ende:number, art:'zeitraum'|'bekannt'|'geschaetzt'}|null}
 */
export function ende(e, iso) {
  const z = zeitAm(e, iso);
  const r = z.match(ZEITRAUM);
  if (r) return { ende: minuten(r[3], r[4]), art: 'zeitraum' };
  const b = beginn(z);
  if (e.ende && !(e.zeiten && e.zeiten[iso])) {
    const k = String(e.ende).match(ZEIT);
    if (k) {
      let t = minuten(k[1], k[2]);
      if (b !== null && t < b) t += 24 * 60;
      return { ende: t, art: 'bekannt' };
    }
  }
  if (b === null) return null;
  const start = b + (/Einlass/i.test(`${z} ${e.titel || ''}`) ? 45 : 0);
  return { ende: start + dauer(e), art: 'geschaetzt' };
}

/** Die 21:30-Regel: Darf der Termin an diesem Tag stehen? */
export function endetRechtzeitig(e, tag, tage) {
  if (e.ganztags || !abendVorArbeitstag(tag, tage)) return true;
  if (offen(e, tag.datum)) {
    const b = beginn(zeitAm(e, tag.datum));
    return b === null || b <= SPAETESTER_BEGINN_OFFEN;
  }
  const i = ende(e, tag.datum);
  return !i || i.ende <= SPAETESTES_ENDE;
}

/**
 * Der Filter „Mo–Fr ab 15:30“: Was bleibt an einem Werktag?
 * Beginn ab 15:30, ein Zeitraum bis mindestens 17:00, ein offenes „ab …“,
 * Ganztägiges und alles ohne Uhrzeit.
 */
export function nachFeierabend(e, iso) {
  if (e.ganztags) return true;
  const z = zeitAm(e, iso);
  const r = z.match(ZEITRAUM);
  if (r) return minuten(r[1], r[2]) >= NACH_FEIERABEND || minuten(r[3], r[4]) >= 17 * 60;
  const zeiten = [...z.matchAll(/(\d{1,2}):(\d{2})/g)].map((m) => minuten(m[1], m[2]));
  if (!zeiten.length) return true;
  return zeiten.some((t) => t >= NACH_FEIERABEND) || /\bab\b/.test(z);
}

/** Sortierschlüssel: Ganztägiges zuerst, dann nach Beginn, ohne Uhrzeit dazwischen. */
export function sortierung(e, iso) {
  if (e.ganztags) return -1;
  const b = beginn(zeitAm(e, iso));
  return b === null ? -0.5 : b;
}
