/*
 * Alle Tests der Reihe nach.
 *
 *     node tests/lauf.mjs                 # alles
 *     node tests/lauf.mjs woche daten     # nur test-woche und test-daten
 *
 * Nacheinander, nicht nebeneinander: Jeder Browsertest startet einen echten
 * Browser, und mehrere gleichzeitig machen die Wartezeiten unzuverlässig.
 *
 * Jeder Test ist ein eigenes Programm und meldet sein Ergebnis über den
 * Rückgabewert und seine OK-/FAIL-Zeilen – ohne Rahmenwerk, so wie die App
 * selbst ohne Bauschritt auskommt.
 */
import { readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { starte } from './server.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const wunsch = process.argv.slice(2);

const alle = readdirSync(HIER).filter((f) => f.startsWith('test-') && f.endsWith('.mjs')).sort();
const liste = wunsch.length
  ? alle.filter((f) => wunsch.some((w) => f === w || f === `test-${w}.mjs` || f.includes(w)))
  : alle;

if (!liste.length) {
  console.error(`Kein Test passt zu ${wunsch.join(', ')}.\nBekannt: ${alle.join(', ')}`);
  process.exit(2);
}

// Die Browsertests erwarten die App unter http://127.0.0.1:8099/ (hilfe.mjs).
const server = [await starte(8099, 0)];

const fuehreAus = (datei) => new Promise((fertig) => {
  const kind = spawn(process.execPath, [path.join(HIER, datei)], { cwd: HIER });
  let text = '';
  kind.stdout.on('data', (d) => { text += d; });
  kind.stderr.on('data', (d) => { text += d; });
  kind.on('close', (code) => fertig({ code, text }));
});

const ergebnis = [];
for (const datei of liste) {
  const start = Date.now();
  const { code, text } = await fuehreAus(datei);
  const dauer = ((Date.now() - start) / 1000).toFixed(0);
  const ok = (text.match(/^\s*OK\s/gm) || []).length;
  const fail = (text.match(/^\s*FAIL\s/gm) || []).length;
  // Ein Test ohne einzige Prüfung ist kein bestandener Test, sondern einer,
  // der nicht gelaufen ist.
  const gut = code === 0 && fail === 0 && ok > 0;
  ergebnis.push({ datei, gut, ok, fail, dauer, text });
  console.log(`${gut ? '  ok  ' : 'FEHLER'} ${datei.padEnd(24)} ${String(ok).padStart(3)} Prüfungen`
    + `${fail ? `, ${fail} gescheitert` : ''}  ${dauer}s`);
  if (!gut) console.log(text.split('\n').filter((z) => /FAIL|Error|error/.test(z)).slice(0, 12).join('\n'));
}

for (const s of server) s.close();

const kaputt = ergebnis.filter((e) => !e.gut);
const pruefungen = ergebnis.reduce((s, e) => s + e.ok, 0);
console.log(`\n${ergebnis.length} Dateien, ${pruefungen} Prüfungen, `
  + `${kaputt.length ? `${kaputt.length} Datei(en) gescheitert: ${kaputt.map((e) => e.datei).join(', ')}` : 'alles grün'}`);
process.exit(kaputt.length ? 1 : 0);
