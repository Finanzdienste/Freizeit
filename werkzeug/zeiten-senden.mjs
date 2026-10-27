#!/usr/bin/env node
/*
 * Die belegten Zeiten des Gastgebers an den gemeinsamen Plan schicken – als
 * Haken z:<Montag> (Format in js/zeiten.js). Gedacht für die geplante
 * Aufgabe, die Tobis Google Kalender liest; läuft mit Node allein, ohne
 * npm ci.
 *
 *   node werkzeug/zeiten-senden.mjs --zugang "<Link „Weiteres Gerät“>" --termine termine.json
 *        [--wochen 5] [--trocken] [--server https://…]
 *
 * termine.json ist eine Liste von Terminen, an denen Tobi wirklich belegt ist
 * (nicht abgesagt, nicht als „frei“ markiert) – nur Zeiten, keine Titel:
 *
 *   [{ "start": "2026-11-03T18:00:00+01:00", "ende": "2026-11-03T20:30:00+01:00" },
 *    { "start": "2026-11-05", "ende": "2026-11-06", "ganztags": true }]
 *
 * Geschrieben werden die Wochen ab Montag dieser Woche (Berliner Zeit), auch
 * leere – dann wissen die anderen: frei. Ältere Zeiten-Haken nimmt es weg.
 * Der Zugang ist der Link „Weiteres Gerät“ des Gastgebers (Code, Kennung,
 * Schlüssel); ohne Schlüssel lehnt der Server ab.
 */
import { readFileSync } from 'node:fs';
import { SERVER } from '../js/config.js';
import { belegteWochen, montagVon, berlin } from '../js/zeiten-rechnen.js';

const args = process.argv.slice(2);
const wert = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const TROCKEN = args.includes('--trocken');
const fehler = (text) => {
  console.error(`Fehler: ${text}`);
  process.exit(1);
};

const zugang = String(wert('zugang') || process.env.FREIZEIT_ZUGANG || '').trim();
const m = zugang.match(/(?:^|geraet=)([a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4})\.([a-z0-9-]{8,40})\.([a-z0-9]{20,64})$/i);
if (!m && !TROCKEN) fehler('--zugang braucht den Link „Weiteres Gerät“ des Gastgebers (mit Schlüssel).');
const [code, person, schluessel] = m ? [m[1].toLowerCase(), m[2].toLowerCase(), m[3].toLowerCase()] : [];

let termine;
try {
  const datei = wert('termine');
  termine = JSON.parse(readFileSync(datei === '-' || !datei ? 0 : datei, 'utf8'));
} catch (e) {
  fehler(`--termine ist keine lesbare JSON-Liste (${e.message})`);
}
if (!Array.isArray(termine)) fehler('--termine muss eine Liste sein.');

const wochen = Math.min(Math.max(Number(wert('wochen') || 5), 1), 8);
const jetzt = berlin(new Date().toISOString());
const von = montagVon(jetzt.tag);
const stand = `${jetzt.tag}T${String(Math.floor(jetzt.minute / 60)).padStart(2, '0')}:${String(jetzt.minute % 60).padStart(2, '0')}`;
const bloecke = belegteWochen(termine, von, wochen);

/** Der Server nimmt höchstens 2000 Byte je Haken: notfalls kleine Lücken schließen. */
function passend(liste) {
  let l = liste.map((b) => [...b]);
  const groesse = () => JSON.stringify({ z: l, stand }).length;
  while (groesse() > 1900 && l.length > 1) {
    let k = 0;
    for (let i = 1; i < l.length - 1; i++) if (l[i + 1][0] - l[i][1] < l[k + 1][0] - l[k][1]) k = i;
    l = [...l.slice(0, k), [l[k][0], l[k + 1][1]], ...l.slice(k + 2)];
  }
  return l;
}

if (TROCKEN) {
  console.log(JSON.stringify({ von, stand, wochen: Object.fromEntries(Object.entries(bloecke).map(([mo, l]) => [mo, passend(l)])) }, null, 1));
  process.exit(0);
}

const url = String(wert('server') || process.env.FREIZEIT_SERVER || SERVER.url).replace(/\/$/, '');
async function rpc(name, params) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SERVER.key },
    body: JSON.stringify(params),
  });
  const text = await res.text();
  let j = null;
  try { j = JSON.parse(text); } catch { /* kein JSON */ }
  if (!res.ok) fehler(`${name}: ${(j && j.message) || `HTTP ${res.status}`}`);
  return j;
}

const ich = { p_code: code, p_person: person, p_schluessel: schluessel };
let stand2 = await rpc('freizeit_lesen', ich);
if (!stand2 || stand2.rolle !== 'gastgeber') fehler(`Der Zugang ist nicht der des Gastgebers (Rolle: ${stand2 && stand2.rolle}).`);
let anzahl = 0;
for (const [mo, liste] of Object.entries(bloecke)) {
  const z = passend(liste);
  anzahl += z.length;
  stand2 = await rpc('freizeit_bock', { ...ich, p_eintrag: `z:${mo}`, p_bock: true, p_daten: { z, stand } });
}
// Zeiten von Wochen, die vorbei sind, braucht niemand mehr.
const alt = (stand2.bock || []).filter((b) => b.person === person && /^z:\d{4}-\d{2}-\d{2}$/.test(b.eintrag) && b.eintrag.slice(2) < von);
for (const b of alt) await rpc('freizeit_bock', { ...ich, p_eintrag: b.eintrag, p_bock: false, p_daten: null });
console.log(`Zeiten gesendet: ${Object.keys(bloecke).length} Wochen ab ${von}, ${anzahl} belegte Blöcke, Stand ${stand}${alt.length ? `, ${alt.length} alte Woche(n) entfernt` : ''}.`);
