/*
 * Wann hat der Gastgeber Zeit? – seine belegten Zeiten aus dem Kalender, ohne
 * Titel, wie im Terminplanungs-Assistenten.
 *
 * Die Zeiten reisen als Haken des Gastgebers mit dem Schlüssel
 * z:<Montag der Woche>; ihre daten sind
 *
 *   { "z": [[von, bis], …], "stand": "2026-11-02T07:10" }
 *
 * mit Minuten ab Montag 0:00 (Berliner Zeit, 0–10080). Wer sie schreibt (eine
 * geplante Aufgabe oder die App des Gastgebers), steht in README.md. Für den
 * Server sind es Haken wie alle anderen: Eingeladene sehen sie, weil sie die
 * Haken des Gastgebers sehen; mit Terminen haben sie nichts zu tun und tauchen
 * deshalb nirgends als Eintrag auf (gemeinsam.js lässt sie dort weg). Gezeigt
 * werden sie an den Karten (zeitZeile) und in den Ansichten Woche und Tag
 * (ansicht-kalender.js).
 *
 * Ist eine Woche da, gilt jeder Tag darin ohne Block als frei. Für Wochen ohne
 * Zeiten weiß die App nichts und sagt nichts.
 */
import { esc } from './text.js';
import { zeitenMarken, rolle, gastgeberName } from './gemeinsam.js';
import { plusTage, montag, beginn, ende, zeitAm } from './zeit.js';

export const PRAEFIX = 'z:';
const TAG = 24 * 60;
const WOCHE = 7 * TAG;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Überlappende oder aneinanderstoßende Blöcke zu einem. */
function verschmelzen(liste) {
  const r = [];
  for (const [a, b] of [...liste].sort((x, y) => x[0] - y[0])) {
    const letzter = r[r.length - 1];
    if (letzter && a <= letzter[1]) letzter[1] = Math.max(letzter[1], b);
    else r.push([a, b]);
  }
  return r;
}

let zwischen = { ref: null, wert: null };

/** { tage: Map Tag → [[von, bis] Minuten des Tages], wochen: Set der Montage, stand } */
export function belegung() {
  const marken = zeitenMarken();
  if (zwischen.ref === marken.quelle && zwischen.wert) return zwischen.wert;
  const tage = new Map();
  const wochen = new Set();
  let stand = '';
  for (const m of marken.liste) {
    const mo = m.eintrag.slice(PRAEFIX.length);
    if (!ISO.test(mo) || montag(mo) !== mo) continue;
    const d = m.daten && typeof m.daten === 'object' ? m.daten : {};
    wochen.add(mo);
    if (typeof d.stand === 'string' && d.stand > stand) stand = d.stand;
    for (const block of Array.isArray(d.z) ? d.z : []) {
      if (!Array.isArray(block)) continue;
      const [a, b] = block.map(Number);
      if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b > WOCHE || a >= b) continue;
      for (let t = Math.floor(a / TAG); t < 7 && t * TAG < b; t++) {
        const datum = plusTage(mo, t);
        if (!tage.has(datum)) tage.set(datum, []);
        tage.get(datum).push([Math.max(a, t * TAG) - t * TAG, Math.min(b, (t + 1) * TAG) - t * TAG]);
      }
    }
  }
  for (const [k, liste] of tage) tage.set(k, verschmelzen(liste));
  zwischen = { ref: marken.quelle, wert: { tage, wochen, stand } };
  return zwischen.wert;
}

/** Weiß die App für diesen Tag Bescheid? */
export const bekannt = (datum) => belegung().wochen.has(montag(datum));

/** Belegte Blöcke eines Tages (Minuten des Tages). */
export const belegtAm = (datum) => belegung().tage.get(datum) || [];

/**
 * Passt ein Termin in den Kalender des Gastgebers? null, wenn man es nicht
 * weiß (keine Zeiten für die Woche, kein Tag, keine Uhrzeit, ganztägig);
 * sonst { frei, block } mit dem ersten belegten Block, der stört.
 */
export function passt(e) {
  if (!e || !e.datum || e.ganztags || !bekannt(e.datum)) return null;
  const b = beginn(zeitAm(e, e.datum));
  if (b === null) return null;
  const i = ende(e, e.datum);
  const bis = i && i.ende > b ? i.ende : b + 120;
  const stoert = (liste, versatz) => liste.find(([x, y]) => x + versatz < bis && y + versatz > b);
  const heute = stoert(belegtAm(e.datum), 0);
  const morgen = bis > TAG && bekannt(plusTage(e.datum, 1)) ? stoert(belegtAm(plusTage(e.datum, 1)), TAG) : null;
  const block = heute || morgen;
  return { frei: !block, block: block || null };
}

/** Die Zeile an einer Karte: bei Eingeladenen frei/verplant, beim Gastgeber nur, wenn es sich beißt. */
export function zeitZeile(e) {
  const r = rolle();
  if (!r) return '';
  const p = passt(e);
  if (!p) return '';
  if (r === 'gastgeber') {
    return p.frei ? '' : '<div class="zeit-hinweis belegt">Bei dir steht da schon was im Kalender</div>';
  }
  const n = esc(gastgeberName() || 'Der Gastgeber');
  return p.frei
    ? `<div class="zeit-hinweis frei">✓ ${n} hat da Zeit</div>`
    : `<div class="zeit-hinweis belegt">${n} ist da schon verplant</div>`;
}

/** Welche Wochen gibt es? Für die Pfeile. */
export function zeitenWochen() {
  return [...belegung().wochen].sort();
}
