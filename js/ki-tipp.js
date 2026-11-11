/*
 * „Für dich“: Claude sucht aus dem Programm einer Woche die zwei Termine aus,
 * die am besten zu Tobi passen – und sagt in einem Satz, warum.
 *
 * Gefragt wird nur auf Knopfdruck, über die Messages-API von Anthropic mit
 * einem eigenen Schlüssel (sk-ant-…). Das kostet vom Guthaben der Console,
 * bei einem Claude-Abo Max oder Ultra aus dessen Monatsguthaben – pro Frage
 * wenige Cent. Der Schlüssel bleibt auf dem Gerät:
 *
 *   freizeit.ki.v1     der hier eingetragene, dazu die Tipps je Woche
 *   boxenstopp.ki.v1   sonst der aus Boxenstopp – beide Apps liegen unter
 *                      finanzdienste.github.io und teilen sich darum den
 *                      Speicher des Browsers. Nur ein Claude-Schlüssel zählt,
 *                      ein Gemini-Schlüssel nicht.
 *
 * Eingeladene sehen nichts davon (es ginge auf Tobis Guthaben).
 *
 * Was Claude bekommt: die Termine der Woche ab heute, wie das Programm sie
 * ohne Filter zeigt – mit der 21:30-Regel, ohne Online & TV und ohne, was
 * sich mit Tobis Kalender beißt (zeiten.js; seine Arbeitszeit zählt dort als
 * belegt). Dazu, was er zuletzt gemacht und wie er es bewertet hat
 * (st.verlauf) und worauf er gerade Bock hat. Jeder Termin steht als eine
 * Zeile mit Nummer; die Antwort nennt nur Nummern, die Karten baut die App
 * selbst – so kann Claude keinen Termin erfinden.
 *
 * kandidaten(), vorlieben(), anfrageBauen() und antwortLesen() sind ohne
 * Netz und ohne DOM – tests/test-ki-tipp.mjs prüft sie direkt.
 */
import { termineAm, tagVon } from './filter.js';
import { plusTage, wochentagKurz, tagMonat, zeitAm } from './zeit.js';
import { istOnline, kostenlos, REGIONEN } from './text.js';
import { passt as kalenderPasst } from './zeiten.js';
import { LEERER_FILTER } from './speicher.js';

export const API = 'https://api.anthropic.com/v1/messages';
export const MODELL = 'claude-opus-5-5';
const VERSION = '2026-10-21';
const EIGEN = 'freizeit.ki.v1';
const BOXENSTOPP = 'boxenstopp.ki.v1';
export const MUSTER = /^sk-ant-[A-Za-z0-9_-]{20,250}$/;
/** So viele Termine gehen höchstens mit – reicht für jede Woche und hält die Frage billig. */
const HOECHSTENS = 140;

const lesen = (k) => {
  try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; }
};
const eigen = () => {
  const r = lesen(EIGEN);
  return r && typeof r === 'object' ? r : {};
};
const schreiben = (wert) => {
  try { localStorage.setItem(EIGEN, JSON.stringify(wert)); return true; } catch { return false; }
};

/** Was gerade läuft: laeuft (Montag der Woche, nach der gefragt wird), fehler mit woche, einstellFehler. */
export const kiUi = {
  laeuft: '', fehler: '', woche: '', einstellFehler: '',
};

/** Der Schlüssel dieses Geräts: { schluessel, quelle: 'eigen' | 'boxenstopp' } oder null. */
export function kiSchluessel() {
  const e = eigen();
  if (typeof e.schluessel === 'string' && MUSTER.test(e.schluessel)) return { schluessel: e.schluessel, quelle: 'eigen' };
  const b = lesen(BOXENSTOPP);
  if (b && typeof b.schluessel === 'string' && MUSTER.test(b.schluessel)) return { schluessel: b.schluessel, quelle: 'boxenstopp' };
  return null;
}

/** Einen eigenen Schlüssel speichern – false, wenn er nicht wie einer von Anthropic aussieht. */
export function kiSchluesselSetzen(text) {
  const s = String(text || '').trim();
  if (!MUSTER.test(s)) return false;
  return schreiben({ ...eigen(), schluessel: s });
}

/** Den eigenen Schlüssel löschen (der aus Boxenstopp bleibt, wo er ist). */
export function kiSchluesselWeg() {
  const { schluessel, ...rest } = eigen();
  schreiben(rest);
}

/** Die gemerkten Tipps einer Woche (Montag): { stand, liste: [{ id, datum, warum }] } oder null. */
export function gemerkteTipps(mo) {
  const t = eigen().tipps;
  return t && t[mo] && Array.isArray(t[mo].liste) ? t[mo] : null;
}

/** Tipps einer Woche merken; vergangene Wochen fliegen dabei raus. */
export function tippsMerken(mo, liste, heute) {
  const e = eigen();
  const tipps = Object.fromEntries(Object.entries(e.tipps || {}).filter(([k]) => plusTage(k, 6) >= heute));
  tipps[mo] = { stand: new Date().toISOString(), liste };
  schreiben({ ...e, tipps });
}

const kurz = (s, n) => (String(s || '').length > n ? `${String(s).slice(0, n - 1)}…` : String(s || ''));

/**
 * Die Termine einer Woche, die in Frage kommen: [{ nr, e, datum, auch }] –
 * ab heute, ohne Filter außer der 21:30-Regel, ohne Online & TV, ohne was
 * mit dem Kalender kollidiert. Ein Termin an mehreren Tagen steht einmal,
 * am ersten passenden Tag; die anderen stehen in `auch`.
 */
export function kandidaten(p, mo, heute, j) {
  const f = LEERER_FILTER();
  const nachId = new Map();
  for (let i = 0; i < 7; i++) {
    const d = plusTage(mo, i);
    if (d < heute || d > p.bis) continue;
    for (const e of termineAm(p, d, f, j).liste) {
      if (istOnline(e)) continue;
      const k = kalenderPasst({ ...e, datum: d });
      if (k && !k.frei) continue;
      if (nachId.has(e.id)) nachId.get(e.id).auch.push(d);
      else nachId.set(e.id, { e, datum: d, auch: [] });
    }
  }
  // Konzerte der eigenen Künstler zuerst, damit sie nie hinten abgeschnitten werden.
  const liste = [...nachId.values()].sort((a, b) => Number(b.e.kuenstler) - Number(a.e.kuenstler));
  return liste.slice(0, HOECHSTENS)
    .sort((a, b) => a.datum.localeCompare(b.datum) || zeitAm(a.e, a.datum).localeCompare(zeitAm(b.e, b.datum)))
    .map((x, i) => ({ ...x, nr: i + 1 }));
}

/** Eine Zeile je Kandidat – das, was beim Aussuchen hilft. */
export function zeile({
  nr, e, datum, auch = [],
}) {
  const region = typeof REGIONEN[e.region] === 'string' ? REGIONEN[e.region] : e.region;
  const teile = [
    `${wochentagKurz(datum)} ${tagMonat(datum)} ${e.ganztags ? 'ganztägig' : zeitAm(e, datum)}${auch.length ? ` (auch ${auch.map(wochentagKurz).join(', ')})` : ''}`.trim(),
    e.titel,
    [e.kategorie, e.ort, region].filter(Boolean).join(', '),
    kostenlos(e) ? 'kostenlos' : kurz(e.preis, 40),
    e.draussen,
    e.kuenstler ? 'KONZERT SEINES LIEBLINGSKÜNSTLERS' : '',
    kurz(e.einordnung || e.beschreibung, 160),
  ].filter(Boolean);
  return `[${nr}] ${teile.join(' | ')}`;
}

/** Was man über Tobis Geschmack weiß: zuletzt Gemachtes mit Bewertung, und worauf er Bock hat. */
export function vorlieben(st) {
  const note = { 1: 'naja', 2: 'gut', 3: 'super' };
  const gemacht = (Array.isArray(st.verlauf) ? st.verlauf : []).slice(-25)
    .map((v) => `- ${kurz(v.titel, 80)}${note[v.bewertung] ? ` (${note[v.bewertung]})` : ''}${v.flow ? ' (Flow)' : ''}`);
  const bock = Object.values(st.bock || {}).filter((b) => b && b.titel && !String(b.titel).startsWith('z:')).slice(-25)
    .map((b) => `- ${kurz(b.titel, 80)}${b.kategorie ? ` (${b.kategorie})` : ''}`);
  return { gemacht, bock };
}

export const SCHEMA = {
  type: 'object',
  properties: {
    tipps: {
      type: 'array',
      description: 'Genau zwei Tipps, der bessere zuerst.',
      items: {
        type: 'object',
        properties: {
          nr: { type: 'integer', description: 'Die Nummer des Termins aus der Liste.' },
          warum: { type: 'string', description: 'Ein kurzer Satz an Tobi (du), warum genau das zu ihm passt.' },
        },
        required: ['nr', 'warum'],
        additionalProperties: false,
      },
    },
  },
  required: ['tipps'],
  additionalProperties: false,
};

/** Der Rumpf der Anfrage an Claude. */
export function anfrageBauen(liste, st) {
  const { gemacht, bock } = vorlieben(st);
  const system = 'Du suchst für Tobi (27, wohnt in Hamburg-Wandsbek, arbeitet werktags bis 15:30, friert schnell) '
    + 'die zwei Termine der Woche aus, die am besten zu ihm passen. Achte auf das, was er gemacht und gut gefunden hat, '
    + 'und auf das, worauf er Bock hat – aber schlag nicht genau das vor, was schon auf seiner Bock-Liste steht, '
    + 'und nimm zwei verschiedene Arten von Unternehmungen. Konzerte seiner Lieblingskünstler sind fast immer ein Treffer. '
    + 'Draußen-Termine im Winter nur, wenn sie es wirklich wert sind. Jeder Grund ist ein kurzer, konkreter Satz auf Deutsch, '
    + 'per du, ohne Floskeln. Antworte nur mit Nummern aus der Liste.';
  const text = [
    `Termine dieser Woche (nur, was zeitlich zu ihm passt):\n${liste.map(zeile).join('\n')}`,
    gemacht.length ? `Zuletzt gemacht und wie es war:\n${gemacht.join('\n')}` : 'Zuletzt gemacht: noch nichts eingetragen.',
    bock.length ? `Worauf er gerade Bock hat:\n${bock.join('\n')}` : '',
  ].filter(Boolean).join('\n\n');
  return {
    model: MODELL,
    max_tokens: 2000,
    system,
    messages: [{ role: 'user', content: text }],
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
  };
}

/** Die Antwort lesen: höchstens zwei Tipps, jede Nummer aus der Liste und nur einmal. */
export function antwortLesen(info, liste) {
  if (info?.stop_reason === 'refusal') throw new Error('Claude wollte dazu nichts sagen.');
  const text = (Array.isArray(info?.content) ? info.content : []).filter((b) => b?.type === 'text').map((b) => b.text || '').join('');
  let roh;
  try { roh = JSON.parse(text); } catch { throw new Error('Die Antwort war unlesbar – noch mal probieren.'); }
  const nachNr = new Map(liste.map((x) => [x.nr, x]));
  const gesehen = new Set();
  const tipps = [];
  for (const t of Array.isArray(roh?.tipps) ? roh.tipps : []) {
    const x = nachNr.get(Number(t?.nr));
    if (!x || gesehen.has(x.nr) || typeof t.warum !== 'string' || !t.warum.trim()) continue;
    gesehen.add(x.nr);
    tipps.push({ id: x.e.id, titel: x.e.titel, datum: x.datum, warum: kurz(t.warum.trim(), 300) });
    if (tipps.length === 2) break;
  }
  if (!tipps.length) throw new Error('Claude hat keinen passenden Termin genannt – noch mal probieren.');
  return tipps;
}

/** Fehlertexte, die man versteht. */
function fehlerText(status, meldung) {
  if (status === 401 || status === 403) return 'Der Schlüssel wird nicht angenommen – unter Einstellungen → KI-Tipp einen neuen eintragen.';
  if (status === 402 || /credit|balance|billing/i.test(meldung)) return 'Das API-Guthaben ist aufgebraucht.';
  if (status === 429) return 'Gerade zu viele Anfragen – in einer Minute noch mal.';
  if (status === 529 || status >= 500) return 'Claude ist gerade überlastet – gleich noch mal probieren.';
  return `Die Anfrage ging nicht durch (${meldung || `HTTP ${status}`}).`;
}

/** Fragt Claude nach den zwei Tipps einer Woche und merkt sie sich. */
export async function tippsHolen(p, st, mo, heute, { api = API } = {}) {
  const k = kiSchluessel();
  if (!k) throw new Error('Kein Schlüssel – trag unter Einstellungen → KI-Tipp einen ein.');
  const liste = kandidaten(p, mo, heute);
  if (!liste.length) throw new Error('In dieser Woche passt zeitlich nichts mehr.');
  let res;
  try {
    res = await fetch(api, {
      method: 'POST',
      headers: {
        'content-type': 'application/json', 'x-api-key': k.schluessel, 'anthropic-version': VERSION, 'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(anfrageBauen(liste, st)),
    });
  } catch {
    throw new Error('Kein Netz – später noch mal.');
  }
  let info = null;
  try { info = await res.json(); } catch { /* bleibt null */ }
  if (!res.ok) throw new Error(fehlerText(res.status, String(info?.error?.message || '')));
  const tipps = antwortLesen(info, liste);
  tippsMerken(mo, tipps, heute);
  return tipps;
}

/** Ein gemerkter Tipp mit seinem Termin aus dem Programm – null, wenn es ihn nicht mehr gibt. */
export function tippTermin(p, t) {
  const e = p.termine.find((x) => x.id === t.id && x.daten.includes(t.datum));
  return e ? { e, tag: tagVon(p, t.datum) } : null;
}

