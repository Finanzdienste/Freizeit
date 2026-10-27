/*
 * Aus Kalenderterminen die belegten Zeiten je Woche – für die Haken
 * z:<Montag> (siehe zeiten.js). Ohne Abhängigkeiten, damit dasselbe im
 * Browser und in Node läuft (werkzeug/zeiten-senden.mjs).
 *
 * Ein Termin ist { start, ende, ganztags? }:
 *   - mit Uhrzeit: ISO mit Zeitzone, „2026-11-03T18:00:00+01:00“ (oder Z)
 *   - ganztägig: nur Tage, „2026-11-05“ bis „2026-11-06“ (Ende ausschließlich,
 *     wie im Kalender)
 *
 * Gerechnet wird in Berliner Wanduhrzeit: Ein Block ist [von, bis] in Minuten
 * ab Montag 0:00 der Woche (0–10080). Titel und alles andere bleiben draußen.
 */
const TAG = 24 * 60;
const WOCHE = 7 * TAG;
const NUR_TAG = /^\d{4}-\d{2}-\d{2}$/;

const teile = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** Ein Zeitpunkt als Berliner Tag und Minute des Tages – oder null. */
export function berlin(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = Object.fromEntries(teile.formatToParts(d).map((x) => [x.type, x.value]));
  return { tag: `${p.year}-${p.month}-${p.day}`, minute: Number(p.hour) * 60 + Number(p.minute) };
}

const tageZwischen = (a, b) => Math.round((Date.UTC(...b.split('-').map((x, i) => Number(x) - (i === 1 ? 1 : 0)))
  - Date.UTC(...a.split('-').map((x, i) => Number(x) - (i === 1 ? 1 : 0)))) / 86400000);
const plus = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Montag der Woche eines Tages. */
export function montagVon(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  return plus(iso, -((d.getUTCDay() + 6) % 7));
}

/** Beginn und Ende eines Termins in Minuten ab `von` (einem Montag) – oder null. */
function spanne(t, von) {
  if (!t || !t.start) return null;
  if (t.ganztags || NUR_TAG.test(t.start)) {
    const a = String(t.start).slice(0, 10);
    const b = t.ende && NUR_TAG.test(String(t.ende).slice(0, 10)) ? String(t.ende).slice(0, 10) : plus(a, 1);
    if (!NUR_TAG.test(a)) return null;
    return [tageZwischen(von, a) * TAG, Math.max(tageZwischen(von, b), tageZwischen(von, a) + 1) * TAG];
  }
  const a = berlin(t.start);
  const b = berlin(t.ende || t.start);
  if (!a || !b) return null;
  const x = tageZwischen(von, a.tag) * TAG + a.minute;
  const y = tageZwischen(von, b.tag) * TAG + b.minute;
  return y > x ? [x, y] : null;
}

/**
 * Belegte Blöcke je Woche: { 'JJJJ-MM-TT' (Montag) → [[von, bis], …] } für
 * `wochen` Wochen ab dem Montag `von`. Wochen ohne Termin stehen mit leerer
 * Liste drin – für sie weiß man dann: frei.
 */
export function belegteWochen(termine, von, wochen = 5) {
  const ergebnis = {};
  for (let w = 0; w < wochen; w++) ergebnis[plus(von, 7 * w)] = [];
  for (const t of Array.isArray(termine) ? termine : []) {
    const s = spanne(t, von);
    if (!s) continue;
    const [a, b] = [Math.max(s[0], 0), Math.min(s[1], wochen * WOCHE)];
    for (let w = Math.floor(a / WOCHE); w < wochen && w * WOCHE < b; w++) {
      const x = Math.max(a, w * WOCHE) - w * WOCHE;
      const y = Math.min(b, (w + 1) * WOCHE) - w * WOCHE;
      if (y > x) ergebnis[plus(von, 7 * w)].push([x, y]);
    }
  }
  for (const [mo, liste] of Object.entries(ergebnis)) {
    const r = [];
    for (const [x, y] of liste.sort((p, q) => p[0] - q[0])) {
      const letzter = r[r.length - 1];
      if (letzter && x <= letzter[1]) letzter[1] = Math.max(letzter[1], y);
      else r.push([x, y]);
    }
    ergebnis[mo] = r;
  }
  return ergebnis;
}
