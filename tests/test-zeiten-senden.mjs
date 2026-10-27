/*
 * werkzeug/zeiten-senden.mjs gegen einen kleinen nachgebauten Server: Es
 * schreibt je Woche einen Haken z:<Montag> (auch leere Wochen), nimmt alte
 * Wochen weg, verweigert einen Zugang ohne Gastgeber-Rolle und rechnet mit
 * --trocken nur. Ohne Browser, ohne Netz.
 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { berlin, montagVon } from '../js/zeiten-rechnen.js';

const SKRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'werkzeug', 'zeiten-senden.mjs');
let fails = 0;
let oks = 0;
const check = (c, m) => {
  console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`);
  if (c) oks++; else fails++;
};
const T = 24 * 60;
const plus = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const CODE = 'abcd-efgh-jkmn';
const PERSON = 'ptobitobitobitob';
const SCHLUESSEL = 'a'.repeat(24);
const ZUGANG = `https://finanzdienste.github.io/Freizeit/#geraet=${CODE}.${PERSON}.${SCHLUESSEL}`;
const von = montagVon(berlin(new Date().toISOString()).tag);

// Der nachgebaute Server: nur, was das Skript braucht.
const marken = new Map([[`z:${plus(von, -7)}`, { z: [[0, 60]] }], ['t:konzert:2026-11-03', { titel: 'bleibt' }]]);
const aufrufe = [];
let rolle = 'gastgeber';
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (d) => { body += d; });
  req.on('end', () => {
    const name = req.url.split('/rpc/')[1];
    const p = JSON.parse(body || '{}');
    aufrufe.push({ name, p });
    const antwort = (status, j) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(j)); };
    if (p.p_code !== CODE || p.p_person !== PERSON || p.p_schluessel !== SCHLUESSEL) return antwort(400, { message: 'falscher Schlüssel' });
    if (name === 'freizeit_bock') {
      if (p.p_bock) marken.set(p.p_eintrag, p.p_daten);
      else marken.delete(p.p_eintrag);
    }
    return antwort(200, { rolle, personen: [], bock: [...marken].map(([eintrag, daten]) => ({ person: PERSON, eintrag, daten })) });
  });
});
await new Promise((f) => server.listen(0, '127.0.0.1', f));
const URL_ = `http://127.0.0.1:${server.address().port}`;

const lauf = (...a) => new Promise((fertig) => {
  const kind = spawn(process.execPath, [SKRIPT, ...a]);
  let aus = '';
  kind.stdout.on('data', (d) => { aus += d; });
  kind.stderr.on('data', (d) => { aus += d; });
  kind.on('close', (code) => fertig({ code, aus }));
});

const ordner = mkdtempSync(path.join(tmpdir(), 'zeiten-'));
const datei = path.join(ordner, 'termine.json');
writeFileSync(datei, JSON.stringify([
  { start: plus(von, 2), ende: plus(von, 3), ganztags: true },
  { start: `${plus(von, 8)}T17:00:00Z`, ende: `${plus(von, 8)}T19:00:00Z` },
]));
const zweiter = berlin(`${plus(von, 8)}T17:00:00Z`);

const t = await lauf('--trocken', '--termine', datei);
const j = JSON.parse(t.aus);
check(t.code === 0 && j.von === von && Object.keys(j.wochen).length === 5 && aufrufe.length === 0, '--trocken: rechnet fünf Wochen ab diesem Montag, ohne den Server zu fragen');

const q = await lauf('--sql', '--termine', datei);
check(q.code === 0 && q.aus.startsWith('insert into freizeit_bock') && q.aus.split("('z:").length === 6 && q.aus.includes(`b.eintrag < 'z:${von}'`)
  && q.aus.includes('from freizeit_gastgeber g') && aufrufe.length === 0, '--sql: eine Anweisung für die Zeile des Gastgebers, fünf Wochen, Altes weg – ohne Server');

const r = await lauf('--zugang', ZUGANG, '--termine', datei, '--server', URL_);
check(r.code === 0 && /Zeiten gesendet: 5 Wochen/.test(r.aus), `senden: läuft durch (${r.aus.trim()})`);
const gesetzt = aufrufe.filter((a) => a.name === 'freizeit_bock' && a.p.p_bock).map((a) => a.p.p_eintrag);
check(JSON.stringify(gesetzt) === JSON.stringify([0, 1, 2, 3, 4].map((w) => `z:${plus(von, 7 * w)}`)), 'je Woche ein Haken z:<Montag>, auch für leere Wochen');
check(JSON.stringify(marken.get(`z:${von}`).z) === JSON.stringify([[2 * T, 3 * T]]), 'diese Woche: der ganze Mittwoch belegt');
check(JSON.stringify(marken.get(`z:${plus(von, 7)}`).z) === JSON.stringify([[T + zweiter.minute, T + zweiter.minute + 120]]), 'nächste Woche: Di zwei Stunden, in Berliner Zeit');
check(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(marken.get(`z:${von}`).stand), 'mit Stand');
check(!marken.has(`z:${plus(von, -7)}`) && marken.has('t:konzert:2026-11-03'), 'die Woche davor ist weg, andere Haken bleiben');

rolle = 'mitglied';
const m = await lauf('--zugang', ZUGANG, '--termine', datei, '--server', URL_);
check(m.code === 1 && /nicht der des Gastgebers/.test(m.aus), 'ohne Gastgeber-Rolle: Abbruch mit Meldung');
const ohne = await lauf('--zugang', `#geraet=${CODE}.${PERSON}`, '--termine', datei, '--server', URL_);
check(ohne.code === 1 && /mit Schlüssel/.test(ohne.aus), 'ein Link ohne Schlüssel reicht nicht');

server.close();
console.log(`${fails ? 'FEHLER' : 'Alles gut'}: ${oks} von ${oks + fails} Prüfungen bestanden.`);
process.exit(fails || !oks ? 1 : 0);
