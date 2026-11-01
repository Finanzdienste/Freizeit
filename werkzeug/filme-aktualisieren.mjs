// IMDb Top 250 aktuell halten – aus IMDbs offiziellen Daten (datasets.imdbws.com, für den
// privaten, nicht kommerziellen Gebrauch, täglich neu). Den Chart selbst gibt es dort nicht;
// er gewichtet zusätzlich „Stammwähler“. Deshalb bleibt die bisherige Liste der Anker:
//
//   - Wer drin ist, bleibt drin, solange er ein Kinofilm mit mindestens 25 000 Stimmen und einer
//     Bewertung von mindestens 7,8 ist (der offizielle Chart hält Klassiker mit wenigen Stimmen).
//   - Neu kommt, wer im laufenden oder letzten Jahr erschienen ist und nach der Gewichtung, die IMDb
//     früher offenlegte (WR = v/(v+m)·R + m/(v+m)·C, m = 25 000 Stimmen, C = 7,0), unter den besten
//     200 steht – an der Stelle dieses Rangs. Wer dadurch über Platz 250 rutscht, fällt heraus, wie im
//     Chart. Werden Plätze frei, rücken die nächstbesten nach.
//   - Bewertung und Stimmen werden jede Woche aufgefrischt; Titel, Beschreibung und Schlüssel bleiben.
//
// Neue Filme bekommen den deutschen Titel aus IMDb (Region DE) und die Regie; die Beschreibung
// fehlt dann noch – das Skript nennt sie, der Montagslauf schreibt sie (1–2 eigene Sätze).
//
//   node werkzeug/filme-aktualisieren.mjs [--trocken]
import { readFileSync, writeFileSync } from 'node:fs';
import { DecompressionStream, TextDecoderStream } from 'node:stream/web';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATEI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'daten', 'filme.json');
const QUELLE = 'https://datasets.imdbws.com';
const TROCKEN = process.argv.includes('--trocken');
const M = 25000;
const C = 7.0;
const BLEIBEN_AB = 7.8;
const NEU_BIS = 200;
const GENRE = {
  Drama: 'Drama', Crime: 'Krimi', Action: 'Action', Adventure: 'Abenteuer', Biography: 'Biografie', History: 'Geschichte', Western: 'Western',
  Romance: 'Romanze', 'Sci-Fi': 'Science-Fiction', Fantasy: 'Fantasy', Mystery: 'Mystery', Family: 'Familie', Thriller: 'Thriller', War: 'Krieg',
  Comedy: 'Komödie', Animation: 'Animation', Music: 'Musik', Horror: 'Horror', 'Film-Noir': 'Film noir', Musical: 'Musical', Sport: 'Sport',
};

/** Eine .tsv.gz-Datei von IMDb Zeile für Zeile lesen. */
async function* zeilen(name) {
  const res = await fetch(`${QUELLE}/${name}.tsv.gz`);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const text = res.body.pipeThrough(new DecompressionStream('gzip')).pipeThrough(new TextDecoderStream());
  let rest = '';
  let erste = true;
  for await (const stueck of text) {
    const teile = (rest + stueck).split('\n');
    rest = teile.pop();
    for (const z of teile) {
      if (erste) { erste = false; continue; }
      yield z.split('\t');
    }
  }
  if (rest) yield rest.split('\t');
}

const leer = (x) => (x === '\\N' || x === undefined ? '' : x);
const norm = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const heute = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
const jahrJetzt = Number(heute.slice(0, 4));

const alt = JSON.parse(readFileSync(DATEI, 'utf8'));

// 1. Bewertungen: nur Titel mit genug Stimmen
const bewertung = new Map();
for await (const [id, r, v] of zeilen('title.ratings')) if (Number(v) >= M) bewertung.set(id, { r: Number(r), v: Number(v) });
// 2. Kinofilme (keine Kurzfilme, kein Fernsehen, keine Dokus)
const filme = new Map();
for await (const [id, art, titel, original, , jahr, , laenge, genres] of zeilen('title.basics')) {
  if (art !== 'movie' || !bewertung.has(id)) continue;
  const g = leer(genres).split(',').filter(Boolean);
  if (g.includes('Documentary')) continue;
  filme.set(id, {
    id, titel, original, jahr: Number(leer(jahr)) || null, laenge: Number(leer(laenge)) || null, genre: g, ...bewertung.get(id),
  });
}
const rangliste = [...filme.values()].map((f) => ({ ...f, wr: (f.v / (f.v + M)) * f.r + (M / (f.v + M)) * C }))
  .sort((a, b) => b.wr - a.wr);
const rang = new Map(rangliste.map((f, i) => [f.id, i + 1]));
console.log(`IMDb: ${bewertung.size} Titel mit ≥ ${M} Stimmen, davon ${filme.size} Kinofilme`);

// 3. Die bisherige Liste zuordnen (ohne ID über Titel und Jahr)
const nachTitel = new Map();
for (const f of filme.values()) for (const t of [f.titel, f.original]) nachTitel.set(`${norm(t)}|${f.jahr}`, f.id);
// Ohne ID: gleicher Titel und Jahr (±1), sonst ein Titel, der den anderen enthält („Gekijô-ban …“).
function finde(x) {
  if (x.imdb) return x.imdb;
  const t = norm(x.original || x.titel);
  const genau = [0, -1, 1].map((d) => nachTitel.get(`${t}|${x.jahr + d}`)).find(Boolean);
  if (genau) return genau;
  const enthalten = [...filme.values()].filter((f) => Math.abs(f.jahr - x.jahr) <= 1
    && [f.titel, f.original].some((y) => norm(y).includes(t) || t.includes(norm(y)))).sort((a, b) => b.v - a.v);
  return enthalten.length ? enthalten[0].id : '';
}
const bisher = alt.filme.map((x) => ({ ...x, id: finde(x) }));
const raus = bisher.filter((x) => !x.id || !filme.has(x.id) || filme.get(x.id).r < BLEIBEN_AB);
let liste = bisher.filter((x) => !raus.includes(x));
// 4. Neue Filme an der Stelle ihres Rangs
const drin = new Set(liste.map((x) => x.id));
const neu = rangliste.filter((f) => !drin.has(f.id) && f.jahr >= jahrJetzt - 1 && rang.get(f.id) <= NEU_BIS);
for (const f of neu) liste.splice(Math.min(rang.get(f.id) - 1, liste.length), 0, { id: f.id, neu: true });
// 5. Freie Plätze mit den nächstbesten auffüllen, Überzählige hinten weg
for (const f of rangliste) {
  if (liste.length >= 250) break;
  if (!liste.some((x) => x.id === f.id)) liste.push({ id: f.id, neu: true });
}
const weg = liste.slice(250);
liste = liste.slice(0, 250);

// 5. Deutsche Titel und Regie für die Neuen
const neueIds = new Set(liste.filter((x) => x.neu).map((x) => x.id));
const deutsch = new Map();
const regieIds = new Map();
const namen = new Map();
if (neueIds.size) {
  for await (const [id, , titel, region, , typen, attribute] of zeilen('title.akas')) {
    if (!neueIds.has(id) || region !== 'DE' || /working|literal|alternative|short/i.test(leer(attribute))) continue;
    const gut = /imdbDisplay/.test(leer(typen));
    if (gut || !deutsch.has(id)) deutsch.set(id, titel);
  }
  for await (const [id, regie] of zeilen('title.crew')) if (neueIds.has(id)) regieIds.set(id, leer(regie).split(',').filter(Boolean).slice(0, 3));
  const gesucht = new Set([...regieIds.values()].flat());
  for await (const [nid, name] of zeilen('name.basics')) if (gesucht.has(nid)) namen.set(nid, name);
}

const ergebnis = liste.map((x, i) => {
  const f = filme.get(x.id);
  const roh = x.neu ? {
    titel: deutsch.get(x.id) || f.titel, original: f.original, jahr: f.jahr, laenge: f.laenge,
    genre: f.genre.map((g) => GENRE[g] || g), regie: (regieIds.get(x.id) || []).map((n) => namen.get(n)).filter(Boolean).join(', '), beschreibung: '',
  } : x;
  return JSON.parse(JSON.stringify({
    platz: i + 1,
    titel: roh.titel,
    original: roh.original || undefined,
    jahr: roh.jahr,
    laenge: roh.laenge || (f && f.laenge) || undefined,
    genre: roh.genre,
    regie: roh.regie || undefined,
    imdb: x.id,
    // Ohne ID war der Schlüssel der App „f:<original>-<jahr>“ – er bleibt, damit die Haken bleiben.
    schluessel: x.schluessel || (!x.neu && !x.imdb ? `f:${String(`${roh.original || roh.titel}-${roh.jahr}`).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)}` : undefined),
    wertung: f ? f.r : undefined,
    stimmen: f ? f.v : undefined,
    beschreibung: roh.beschreibung,
  }));
});

const daten = {
  version: 1,
  stand: heute,
  basis: alt.basis || alt.stand,
  quelle: `IMDb Top 250: Reihenfolge des offiziellen Charts vom ${alt.basis || alt.stand}, jede Woche mit IMDbs offiziellen Daten aufgefrischt (datasets.imdbws.com)`,
  filme: ergebnis,
};
const grund = (x) => (!x.id ? 'nicht gefunden' : (!filme.has(x.id) ? 'zu wenig Stimmen' : `Bewertung ${filme.get(x.id).r}`));
console.log(`raus (${raus.length + weg.length}): ${[...raus.map((x) => `${x.titel} (${grund(x)})`), ...weg.map((x) => `${x.titel || x.id} (über Platz 250)`)].join(', ') || '–'}`);
console.log(`neu (${ergebnis.filter((x) => !x.beschreibung).length}) – Beschreibung fehlt noch:`);
for (const x of ergebnis.filter((y) => !y.beschreibung)) console.log(`  ${x.platz}. ${x.titel} (${x.original || ''}, ${x.jahr}) ${x.imdb} – Regie: ${x.regie || '?'}`);
if (TROCKEN) console.log('(trocken – nichts geschrieben)');
else {
  writeFileSync(DATEI, `${JSON.stringify(daten, null, 1)}\n`);
  console.log(`geschrieben: ${DATEI} (Stand ${heute})`);
}
