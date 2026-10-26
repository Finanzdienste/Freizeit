/*
 * Ein Webserver für die Tests – klein genug, um ohne Abhängigkeit auszukommen.
 *
 * Zwei Aufgaben, die kein `python3 -m http.server` erfüllt:
 *
 *   * Er läuft überall dort, wo Node läuft, also auch im Ablauf bei GitHub.
 *   * Er kann eine *Haltbarkeit* mitschicken. Genau daran ist die
 *     Aktualisierung in der Workout-App einmal gescheitert: GitHub Pages gibt den
 *     Dateien zehn Minuten, und ein gewöhnliches fetch() im Service Worker
 *     bekam dann die alte Fassung aus dem Zwischenspeicher des Browsers. Wer
 *     das nachstellen will, braucht einen Server, der sich genauso verhält.
 *
 *     node tests/server.mjs 8099            # ohne Haltbarkeit
 *     node tests/server.mjs 8100 600        # wie GitHub Pages
 */
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Wurzel des Repositorys – eine Ebene über dieser Datei. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TYPEN = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

/** `wurzel`: ein anderes Verzeichnis als das Projekt. */
export function starte(port, maxAge = 0, wurzel = ROOT) {
  const server = createServer((req, res) => {
    // Der Anfrageteil hinter ? und # gehört nicht zum Dateinamen.
    let rel = decodeURIComponent(req.url.split(/[?#]/)[0]);
    if (rel.endsWith('/')) rel += 'index.html';
    // Niemals aus dem Projekt heraus ausliefern.
    const datei = path.join(wurzel, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
    if (!datei.startsWith(wurzel)) {
      res.writeHead(403).end('verboten');
      return;
    }
    let groesse;
    try {
      const s = statSync(datei);
      if (s.isDirectory()) throw new Error('Verzeichnis');
      groesse = s.size;
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('nicht da');
      return;
    }
    res.writeHead(200, {
      'content-type': TYPEN[path.extname(datei)] || 'application/octet-stream',
      'content-length': groesse,
      'cache-control': maxAge ? `max-age=${maxAge}` : 'no-store',
      // Der Service Worker darf von hier aus die ganze App bedienen.
      'service-worker-allowed': '/',
    });
    createReadStream(datei).pipe(res);
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}

// Direkt aufgerufen: laufen lassen, bis jemand abbricht.
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.argv[2] || 8099);
  const maxAge = Number(process.argv[3] || 0);
  await starte(port, maxAge);
  console.log(`läuft auf http://127.0.0.1:${port}/  (Haltbarkeit ${maxAge}s)`);
}
