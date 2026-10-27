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
 * deshalb nirgends als Eintrag auf (gemeinsam.js lässt sie dort weg).
 *
 * Ist eine Woche da, gilt jeder Tag darin ohne Block als frei. Für Wochen ohne
 * Zeiten weiß die App nichts und sagt nichts.
 */
import { esc } from './text.js';
import { zeitenMarken, rolle, gastgeberName } from './gemeinsam.js';
import {
  plusTage, montag, beginn, ende, zeitAm, uhrzeit, wochentagKurz, tagMonat,
} from './zeit.js';

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

const SKALA_VON = 8 * 60;
const SKALA_BIS = TAG;
const prozent = (t) => `${(((Math.min(Math.max(t, SKALA_VON), SKALA_BIS) - SKALA_VON) / (SKALA_BIS - SKALA_VON)) * 100).toFixed(2)}%`;
const blockText = ([a, b]) => `${uhrzeit(a)}–${b >= TAG ? '24:00' : uhrzeit(b)}`;
/** „Tobis Kalender“, „Jonas' Kalender“. */
const genitiv = (name) => (/[sßxz]$/i.test(name) ? `${name}'` : `${name}s`);

/** Welche Wochen gibt es? Für die Pfeile. */
export function zeitenWochen() {
  return [...belegung().wochen].sort();
}

/** Die Woche ab `mo` als Raster: je Tag ein Balken 8–24 Uhr, belegt ist dunkel. */
export function wochenRaster(mo, heute) {
  const zeilen = Array.from({ length: 7 }, (_, i) => {
    const datum = plusTage(mo, i);
    const bloecke = belegtAm(datum).filter(([a, b]) => b > SKALA_VON && a < SKALA_BIS);
    const text = bloecke.length ? `belegt ${bloecke.map(blockText).join(', ')}` : 'frei';
    const vorbei = datum < heute;
    return `<div class="zr-zeile${datum === heute ? ' heute' : ''}${vorbei ? ' vorbei' : ''}" role="row" aria-label="${esc(`${wochentagKurz(datum)} ${tagMonat(datum)}: ${text}`)}">
      <span class="zr-tag" role="rowheader">${esc(wochentagKurz(datum))} ${esc(tagMonat(datum))}</span>
      <span class="zr-balken" role="cell">${bloecke.map((x) => `<b style="left:${prozent(x[0])};width:calc(${prozent(x[1])} - ${prozent(x[0])})" title="${esc(blockText(x))}"></b>`).join('')}</span>
    </div>`;
  }).join('');
  const skala = [8, 12, 16, 20, 24].map((h) => `<i style="left:${prozent(h * 60)}">${h}</i>`).join('');
  return `<div class="zeiten-raster" role="table" aria-label="Belegte Zeiten in der Woche ab ${esc(tagMonat(mo))}">
    <div class="zr-kopf" aria-hidden="true"><span></span><span class="zr-skala">${skala}</span></div>
    ${zeilen}
  </div>`;
}

/** Der Abschnitt „Wann hat … Zeit?“ – oder '', solange keine Zeiten da sind. */
export function zeitenAbschnitt(heute, woche) {
  const wochen = zeitenWochen();
  if (!wochen.length) return '';
  const jetzt = montag(heute);
  const kuenftig = wochen.filter((w) => w >= jetzt);
  if (!kuenftig.length) return '';
  const mo = kuenftig.includes(woche) ? woche : kuenftig[0];
  const i = kuenftig.indexOf(mo);
  const { stand } = belegung();
  const gastgeber = rolle() === 'gastgeber';
  const name = gastgeberName();
  const n = esc(name || 'der Gastgeber');
  const standText = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(stand)
    ? `${wochentagKurz(stand.slice(0, 10))} ${tagMonat(stand.slice(0, 10))}, ${stand.slice(11)} Uhr` : '';
  return `<section class="abschnitt" id="wir-zeiten">
    <h2 class="abschnitt-titel">${gastgeber ? 'Deine Zeiten' : `Wann hat ${n} Zeit?`}</h2>
    <p class="fein">${gastgeber ? 'So sehen deine Leute deinen Kalender: dunkel ist belegt, Titel sehen sie nicht.' : `Dunkel ist belegt laut ${name ? esc(genitiv(name)) : 'seinem'} Kalender – was drinsteht, siehst du nicht.`}${standText ? ` Stand ${esc(standText)}.` : ''}</p>
    <div class="blaettern zeiten-blaettern">
      <button type="button" class="pfeil" data-aktion="zeiten-zurueck" data-woche="${esc(kuenftig[i - 1] || '')}" aria-label="Woche davor"${i <= 0 ? ' disabled' : ''}>‹</button>
      <span class="kicker">Mo ${esc(tagMonat(mo))} – So ${esc(tagMonat(plusTage(mo, 6)))}</span>
      <button type="button" class="pfeil" data-aktion="zeiten-vor" data-woche="${esc(kuenftig[i + 1] || '')}" aria-label="Woche danach"${i >= kuenftig.length - 1 ? ' disabled' : ''}>›</button>
    </div>
    ${wochenRaster(mo, heute)}
  </section>`;
}
