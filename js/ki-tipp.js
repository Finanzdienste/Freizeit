/*
 * „Für dich“: Claude sucht aus dem Programm eines Tages, einer Woche oder
 * eines Monats die Termine aus, die am besten zu Tobi passen – einen, zwei
 * bzw. drei – und sagt je in einem Satz, warum. Dabei sieht Claude, was Tobi
 * in dieser Zeit schon vorhat (seine Haken und Eingeplantes), und sorgt für
 * Abwechslung: Wer jeden Abend Schach geplant hat, bekommt am 31. etwas
 * anderes vorgeschlagen.
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
 * Was Claude bekommt: die Termine des Zeitraums ab heute, wie das Programm
 * sie ohne Filter zeigt – mit der 21:30-Regel, ohne Online & TV, ohne was
 * sich mit Tobis Kalender beißt (zeiten.js; seine Arbeitszeit zählt dort als
 * belegt) und ohne, worauf er schon Bock hat. Dazu, was er in dieser Zeit
 * schon vorhat (beim Tag: in dessen Woche), was er zuletzt gemacht und wie er
 * es bewertet hat (st.verlauf) und worauf er sonst Bock hat. Jeder Termin
 * steht als eine Zeile mit Nummer; die Antwort nennt nur Nummern, die Karten
 * baut die App selbst – so kann Claude keinen Termin erfinden.
 *
 * zeitraum(), kandidaten(), vorhaben(), vorlieben(), anfrageBauen() und
 * antwortLesen() sind ohne Netz und ohne DOM – tests/test-ki-tipp.mjs prüft
 * sie direkt.
 */
import { termineAm, tagVon } from './filter.js';
import {
  plusTage, wochentagKurz, tagMonat, zeitAm, monatPlus, montag,
} from './zeit.js';
import { istOnline, kostenlos, REGIONEN } from './text.js';
import { passt as kalenderPasst } from './zeiten.js';
import { LEERER_FILTER } from './speicher.js';

export const API = 'https://api.anthropic.com/v1/messages';
export const MODELL = 'claude-opus-5-5';
const VERSION = '2026-10-21';
const EIGEN = 'freizeit.ki.v1';
const BOXENSTOPP = 'boxenstopp.ki.v1';
export const MUSTER = /^sk-ant-[A-Za-z0-9_-]{20,250}$/;

/**
 * Die drei Zeiträume: wie viele Tipps, wie viele Termine höchstens mitgehen
 * (das hält die Frage billig) und die Wörter dafür.
 */
export const ARTEN = {
  tag: { zahl: 1, hoechstens: 60, wort: 'des Tages', knopf: 'Einen Tipp holen' },
  woche: { zahl: 2, hoechstens: 140, wort: 'der Woche', knopf: 'Zwei Tipps holen' },
  monat: { zahl: 3, hoechstens: 220, wort: 'des Monats', knopf: 'Drei Tipps holen' },
};

/**
 * Ein Zeitraum { art, schluessel, von, bis, kontextVon, kontextBis } – wert ist
 * der Tag, der Montag der Woche bzw. der Monat (JJJJ-MM). Der Schlüssel, unter
 * dem die Tipps liegen: t:<Tag>, der Montag (wie bisher) bzw. m:<Monat>. Der
 * Kontext ist, wessen Vorhaben Claude sieht – beim Tag die ganze Woche.
 */
export function zeitraum(art, wert) {
  if (art === 'tag') return { art, schluessel: `t:${wert}`, von: wert, bis: wert, kontextVon: montag(wert), kontextBis: plusTage(montag(wert), 6) };
  if (art === 'monat') {
    const von = `${wert}-01`;
    const bis = plusTage(`${monatPlus(wert, 1)}-01`, -1);
    return { art, schluessel: `m:${wert}`, von, bis, kontextVon: von, kontextBis: bis };
  }
  return { art: 'woche', schluessel: wert, von: wert, bis: plusTage(wert, 6), kontextVon: wert, kontextBis: plusTage(wert, 6) };
}

/** Der letzte Tag des Zeitraums hinter einem Schlüssel – danach fliegen seine Tipps raus. */
const endeVon = (k) => {
  if (k.startsWith('t:')) return k.slice(2);
  if (k.startsWith('m:')) return zeitraum('monat', k.slice(2)).bis;
  return plusTage(k, 6);
};

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

/** Was gerade läuft: laeuft (Schlüssel des Zeitraums, nach dem gefragt wird), fehler mit raum, einstellFehler. */
export const kiUi = {
  laeuft: '', fehler: '', raum: '', einstellFehler: '',
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

/** Die gemerkten Tipps eines Zeitraums (sein Schlüssel): { stand, liste: [{ id, datum, warum }] } oder null. */
export function gemerkteTipps(schluessel) {
  const t = eigen().tipps;
  return t && t[schluessel] && Array.isArray(t[schluessel].liste) ? t[schluessel] : null;
}

/** Tipps eines Zeitraums merken; vergangene Zeiträume fliegen dabei raus. */
export function tippsMerken(schluessel, liste, heute) {
  const e = eigen();
  const tipps = Object.fromEntries(Object.entries(e.tipps || {}).filter(([k]) => endeVon(k) >= heute));
  tipps[schluessel] = { stand: new Date().toISOString(), liste };
  schreiben({ ...e, tipps });
}

const kurz = (s, n) => (String(s || '').length > n ? `${String(s).slice(0, n - 1)}…` : String(s || ''));

/** Ein Zeitraum aus dem, was die Aufrufer kennen: ein Objekt von zeitraum() – oder ein Montag (die Woche). */
const alsRaum = (r) => (typeof r === 'string' ? zeitraum('woche', r) : r);

/**
 * Die Termine eines Zeitraums, die in Frage kommen: [{ nr, e, datum, auch }]
 * – ab heute, ohne Filter außer der 21:30-Regel, ohne Online & TV, ohne was
 * mit dem Kalender kollidiert und ohne, worauf Tobi an dem Tag schon Bock hat.
 * Ein Termin an mehreren Tagen steht einmal, am ersten passenden Tag; die
 * anderen stehen in `auch`. Sind es mehr als die Art erlaubt, bekommt jeder
 * Tag seinen Anteil – sonst fielen hinten im Monat ganze Wochen weg.
 */
export function kandidaten(p, raumOderMontag, heute, j, st = null) {
  const raum = alsRaum(raumOderMontag);
  const { hoechstens } = ARTEN[raum.art];
  const f = LEERER_FILTER();
  const bock = (st && st.bock) || {};
  const tage = [];
  for (let d = raum.von < heute ? heute : raum.von; d <= raum.bis && d <= p.bis; d = plusTage(d, 1)) tage.push(d);
  const jeTag = Math.max(4, Math.floor(hoechstens / Math.max(1, tage.length)));
  const nachId = new Map();
  for (const d of tage) {
    let neu = 0;
    for (const e of termineAm(p, d, f, j).liste) {
      if (istOnline(e) || Object.hasOwn(bock, `t:${e.id}:${d}`)) continue;
      const k = kalenderPasst({ ...e, datum: d });
      if (k && !k.frei) continue;
      if (nachId.has(e.id)) { nachId.get(e.id).auch.push(d); continue; }
      // Konzerte der eigenen Künstler gehen immer mit.
      if (neu >= jeTag && !e.kuenstler) continue;
      nachId.set(e.id, { e, datum: d, auch: [] });
      neu++;
    }
  }
  const liste = [...nachId.values()].sort((a, b) => Number(b.e.kuenstler) - Number(a.e.kuenstler));
  return liste.slice(0, hoechstens)
    .sort((a, b) => a.datum.localeCompare(b.datum) || zeitAm(a.e, a.datum).localeCompare(zeitAm(b.e, b.datum)))
    .map((x, i) => ({ ...x, nr: i + 1 }));
}

/**
 * Was Tobi im Kontext des Zeitraums schon vorhat: seine Haken auf Terminen
 * (auch Online & TV) und Eingeplantes an einem Tag darin, dazu Laufendes,
 * das dann läuft – als Zeilen „- Mi 4.11. 19:00 Titel (Kategorie)“.
 */
export function vorhaben(st, raumOderMontag) {
  const raum = alsRaum(raumOderMontag);
  const drin = (d) => typeof d === 'string' && d >= raum.kontextVon && d <= raum.kontextBis;
  return Object.entries((st && st.bock) || {})
    .filter(([k, b]) => b && b.titel && !String(k).startsWith('z:')
      && (drin(b.datum) || (b.von && b.bis && b.von <= raum.kontextBis && b.bis >= raum.kontextVon)))
    .map(([, b]) => ({ b, wann: b.datum || b.von }))
    .sort((x, y) => `${x.wann} ${x.b.zeit || ''}`.localeCompare(`${y.wann} ${y.b.zeit || ''}`))
    .slice(0, 60)
    .map(({ b }) => {
      const wann = b.datum ? `${wochentagKurz(b.datum)} ${tagMonat(b.datum)}${b.zeit ? ` ${kurz(b.zeit, 20)}` : ''}` : `läuft ${tagMonat(b.von)}–${tagMonat(b.bis)}`;
      const art = [b.kategorie || b.kat, b.online ? 'Online & TV' : '', b.quelle === 'plan' ? 'eingeplant' : ''].filter(Boolean).join(', ');
      return `- ${wann} ${kurz(b.titel, 80)}${art ? ` (${art})` : ''}`;
    });
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

/** Was man über Tobis Geschmack weiß: zuletzt Gemachtes mit Bewertung, und worauf er (sonst) Bock hat. */
export function vorlieben(st) {
  const note = { 1: 'naja', 2: 'gut', 3: 'super' };
  const gemacht = (Array.isArray(st.verlauf) ? st.verlauf : []).slice(-25)
    .map((v) => `- ${kurz(v.titel, 80)}${note[v.bewertung] ? ` (${note[v.bewertung]})` : ''}${v.flow ? ' (Flow)' : ''}`);
  const bock = Object.values(st.bock || {}).filter((b) => b && b.titel && !String(b.titel).startsWith('z:')).slice(-25)
    .map((b) => `- ${kurz(b.titel, 80)}${b.kategorie ? ` (${b.kategorie})` : ''}`);
  return { gemacht, bock };
}

/** Das Schema der Antwort – genau so viele Tipps, wie die Art verlangt. */
export const schema = (zahl) => ({
  type: 'object',
  properties: {
    tipps: {
      type: 'array',
      description: zahl === 1 ? 'Genau ein Tipp.' : `Genau ${zahl === 2 ? 'zwei' : 'drei'} Tipps, der beste zuerst.`,
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
});
export const SCHEMA = schema(2);

/** Wie viele Tipps welcher Art – für den Auftrag an Claude. */
const AUFTRAG = {
  tag: 'den einen Termin des Tages aus, der am besten zu ihm passt',
  woche: 'die zwei Termine der Woche aus, die am besten zu ihm passen – zwei verschiedene Arten von Unternehmungen',
  monat: 'die drei Termine des Monats aus, die am besten zu ihm passen – an verschiedenen Tagen, möglichst in verschiedenen Wochen, und drei verschiedene Arten von Unternehmungen',
};
const UEBER = { tag: 'Termine an diesem Tag', woche: 'Termine dieser Woche', monat: 'Termine dieses Monats' };
const KONTEXT = { tag: 'in dieser Woche', woche: 'in dieser Woche', monat: 'in diesem Monat' };

/** Der Rumpf der Anfrage an Claude – für einen Zeitraum (zeitraum()) oder, wie früher, eine Woche. */
export function anfrageBauen(liste, st, raumOderMontag = null) {
  const raum = raumOderMontag ? alsRaum(raumOderMontag) : null;
  const art = raum ? raum.art : 'woche';
  // Was im Zeitraum schon ansteht, steht unter „schon vor“ – unter „sonst Bock“ nur der Rest.
  const imKontext = (b) => Boolean(raum && b && b.datum && b.datum >= raum.kontextVon && b.datum <= raum.kontextBis);
  const rest = { ...st, bock: Object.fromEntries(Object.entries((st && st.bock) || {}).filter(([, b]) => !imKontext(b))) };
  const { gemacht, bock: sonst } = vorlieben(rest);
  const vor = raum ? vorhaben(st, raum) : [];
  const system = 'Du suchst für Tobi (27, wohnt in Hamburg-Wandsbek, arbeitet werktags bis 15:30, friert schnell) '
    + `${AUFTRAG[art]}. Achte auf das, was er gemacht und gut gefunden hat, und auf das, worauf er Bock hat – `
    + 'aber schlag nicht genau das vor, was schon auf seiner Bock-Liste steht. '
    + `Schau dir an, was er ${KONTEXT[art]} schon vorhat: Nichts vorschlagen, was sich damit zeitlich beißt, und für Abwechslung sorgen – `
    + 'hat er eine Art schon oft vor (etwa an vielen Abenden Schach oder lauter Konzerte), schlag bewusst etwas anderes vor. '
    + 'Konzerte seiner Lieblingskünstler sind fast immer ein Treffer. '
    + 'Draußen-Termine im Winter nur, wenn sie es wirklich wert sind. Jeder Grund ist ein kurzer, konkreter Satz auf Deutsch, '
    + 'per du, ohne Floskeln – passt es gerade wegen der Abwechslung, sag das ruhig. Antworte nur mit Nummern aus der Liste.';
  const text = [
    `${UEBER[art]} (nur, was zeitlich zu ihm passt):\n${liste.map(zeile).join('\n')}`,
    raum ? (vor.length ? `Was er ${KONTEXT[art]} schon vorhat:\n${vor.join('\n')}` : `Was er ${KONTEXT[art]} schon vorhat: noch nichts.`) : '',
    gemacht.length ? `Zuletzt gemacht und wie es war:\n${gemacht.join('\n')}` : 'Zuletzt gemacht: noch nichts eingetragen.',
    sonst.length ? `Worauf er sonst gerade Bock hat:\n${sonst.join('\n')}` : '',
  ].filter(Boolean).join('\n\n');
  return {
    model: MODELL,
    max_tokens: 2000,
    system,
    messages: [{ role: 'user', content: text }],
    output_config: { format: { type: 'json_schema', schema: schema(ARTEN[art].zahl) } },
  };
}

/** Die Antwort lesen: höchstens `zahl` Tipps (sonst zwei), jede Nummer aus der Liste und nur einmal. */
export function antwortLesen(info, liste, zahl = 2) {
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
    if (tipps.length === zahl) break;
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

const NICHTS = { tag: 'An diesem Tag passt zeitlich nichts mehr.', woche: 'In dieser Woche passt zeitlich nichts mehr.', monat: 'In diesem Monat passt zeitlich nichts mehr.' };

/** Fragt Claude nach den Tipps eines Zeitraums (zeitraum() oder ein Montag) und merkt sie sich. */
export async function tippsHolen(p, st, raumOderMontag, heute, { api = API } = {}) {
  const raum = alsRaum(raumOderMontag);
  const k = kiSchluessel();
  if (!k) throw new Error('Kein Schlüssel – trag unter Einstellungen → KI-Tipp einen ein.');
  const liste = kandidaten(p, raum, heute, undefined, st);
  if (!liste.length) throw new Error(NICHTS[raum.art]);
  let res;
  try {
    res = await fetch(api, {
      method: 'POST',
      headers: {
        'content-type': 'application/json', 'x-api-key': k.schluessel, 'anthropic-version': VERSION, 'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(anfrageBauen(liste, st, raum)),
    });
  } catch {
    throw new Error('Kein Netz – später noch mal.');
  }
  let info = null;
  try { info = await res.json(); } catch { /* bleibt null */ }
  if (!res.ok) throw new Error(fehlerText(res.status, String(info?.error?.message || '')));
  const tipps = antwortLesen(info, liste, ARTEN[raum.art].zahl);
  tippsMerken(raum.schluessel, tipps, heute);
  return tipps;
}

/** Ein gemerkter Tipp mit seinem Termin aus dem Programm – null, wenn es ihn nicht mehr gibt. */
export function tippTermin(p, t) {
  const e = p.termine.find((x) => x.id === t.id && x.daten.includes(t.datum));
  return e ? { e, tag: tagVon(p, t.datum) } : null;
}

