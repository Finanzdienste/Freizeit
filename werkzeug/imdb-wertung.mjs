// IMDb-Wertung und Stimmen für Filme, die gerade im Kino laufen – aus IMDbs offiziellen Daten
// (datasets.imdbws.com, wie filme-aktualisieren.mjs; keine Seiten von imdb.com abrufen).
// Für „Kino der Woche“ (CLAUDE.md) und den Monatslauf: aufgenommen werden Filme ab 7,5 mit
// mindestens 2 000 Stimmen.
//
//   node werkzeug/imdb-wertung.mjs "Wildwood:2026" "Wild Horse Nine:2026" "Paris, Texas:1984"
//
// Je Argument Titel (Originaltitel oder internationaler Titel) und Jahr, auch „Titel:2025-2026“.
// Gibt je Titel die Treffer aus: tt-Kennung, Titel, Jahr, Laufzeit, Wertung, Stimmen. Lädt
// title.basics (gut 200 MB, gestreamt – nichts wird gespeichert) und title.ratings: 1–2 Minuten.
import { DecompressionStream, TextDecoderStream } from 'node:stream/web';

const QUELLE = 'https://datasets.imdbws.com';
const ARTEN = new Set(['movie', 'tvMovie', 'video', 'tvSpecial']);

/** Eine .tsv.gz-Datei von IMDb Zeile für Zeile lesen. */
async function* zeilen(name) {
  const res = await fetch(`${QUELLE}/${name}.tsv.gz`, { headers: { 'User-Agent': 'Freizeit-App/1.0 (github.com/Finanzdienste/Freizeit)' } });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const text = res.body.pipeThrough(new DecompressionStream('gzip')).pipeThrough(new TextDecoderStream());
  let rest = '';
  let erste = true;
  for await (const stueck of text) {
    const teile = (rest + stueck).split('\n');
    rest = teile.pop();
    for (const z of teile) {
      if (erste) erste = false;
      else yield z.split('\t');
    }
  }
  if (rest) yield rest.split('\t');
}

const norm = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');

const gesucht = process.argv.slice(2).map((arg) => {
  const m = arg.match(/^(.*):(\d{4})(?:-(\d{4}))?$/);
  if (!m) throw new Error(`„${arg}“: bitte als Titel:Jahr oder Titel:Jahr-Jahr`);
  return {
    arg, n: norm(m[1]), von: Number(m[2]), bis: Number(m[3] || m[2]), treffer: [],
  };
});
if (!gesucht.length) {
  console.error('Aufruf: node werkzeug/imdb-wertung.mjs "Titel:Jahr" …');
  process.exit(2);
}

for await (const [id, art, titel, original, , jahr, , laenge] of zeilen('title.basics')) {
  if (ARTEN.has(art)) {
    const j = Number(jahr);
    const a = norm(titel);
    const b = norm(original);
    for (const g of gesucht) {
      if ((a === g.n || b === g.n) && j >= g.von && j <= g.bis) {
        g.treffer.push({
          id, titel, original, jahr: j, laenge: laenge === '\\N' ? null : Number(laenge),
        });
      }
    }
  }
}
const nachId = new Map(gesucht.flatMap((g) => g.treffer.map((t) => [t.id, t])));
for await (const [id, r, v] of zeilen('title.ratings')) {
  if (nachId.has(id)) Object.assign(nachId.get(id), { wertung: Number(r), stimmen: Number(v) });
}
for (const g of gesucht) {
  const liste = g.treffer.sort((x, y) => (y.stimmen || 0) - (x.stimmen || 0));
  console.log(`${g.arg} → ${liste.length ? liste.map((t) => `${t.id} ${t.titel}${t.original !== t.titel ? ` (${t.original})` : ''}, ${t.jahr}, ${t.laenge ?? '?'} Min., ${t.wertung ?? '–'} (${t.stimmen ?? 0} Stimmen)`).join(' | ') : 'kein Treffer'}`);
}
