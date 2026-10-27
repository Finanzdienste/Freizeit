/*
 * Service Worker der Freizeit-App – macht sie ohne Netz benutzbar.
 *
 * Sein Geltungsbereich ist /Freizeit/. Im selben Ursprung
 * (finanzdienste.github.io) liegt unter /Workout/ die Workout-App mit eigenem
 * Worker; die Bereiche überschneiden sich nicht. Bis v1 lag diese App in
 * /Workout/freizeit/ – Android hat sie dort der Workout-App zugerechnet und
 * nicht als eigene App installiert. Darum das eigene Repository.
 *
 * Drei Strategien:
 *
 *   Seitenaufrufe   erst Netz, bei Fehlschlag der Zwischenspeicher.
 *   daten/*.json    erst Netz, bei Fehlschlag der Zwischenspeicher – das
 *                   Programm ändert sich jede Woche, der Ideen-Katalog ab und
 *                   zu; eine alte Fassung darf nur ohne Netz kommen.
 *   Alles andere    sofort aus dem Zwischenspeicher, parallel erneuern.
 *
 * VERSION bei jeder Änderung an einer der unten gelisteten Dateien
 * hochzählen. Die Daten stehen bewusst nicht in SHELL: Sie ändern sich jede
 * Woche, und ein geplanter Lauf soll sie schreiben können, ohne an diese
 * Datei zu müssen.
 */

const VERSION = 'v7';
const CACHE = `freizeit-${VERSION}`;

const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/config.js',
  './js/zeit.js',
  './js/text.js',
  './js/daten.js',
  './js/filter.js',
  './js/speicher.js',
  './js/gemeinsam.js',
  './js/teilen.js',
  './js/karte.js',
  './js/ansicht-programm.js',
  './js/ansicht-kalender.js',
  './js/ansicht-landkarte.js',
  './js/ansicht-ideen.js',
  './js/ansicht-wir.js',
  './js/ideen.js',
  './vendor/leaflet/leaflet.js',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/leaflet.markercluster.js',
  './vendor/leaflet/MarkerCluster.css',
  './icon.svg',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './manifest.webmanifest',
];

/*
 * Am Zwischenspeicher des Browsers vorbei laden: GitHub Pages schickt die
 * Dateien mit zehn Minuten Haltbarkeit, ein gewöhnliches fetch() bekäme die
 * alte Fassung.
 */
const frisch = (eingabe) => fetch(new Request(eingabe, { cache: 'reload' }));

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(SHELL.map((url) => frisch(url)
        .then((res) => (res && res.ok ? cache.put(url, res) : null))
        .catch(() => null))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      // Nur die eigenen alten Fassungen – die Vorräte anderer Apps im selben
      // Ursprung (etwa der Workout-App) gehen diesen Worker nichts an.
      .then((keys) => Promise.all(keys
        .filter((k) => k.startsWith('freizeit-') && k !== CACHE)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const imVorrat = (req) => caches.open(CACHE).then((c) => c.match(req, { ignoreSearch: true }));
  const gut = (res) => res && res.ok && !res.redirected && res.type === 'basic';
  const ablegen = (req, res) => { const kopie = res.clone(); caches.open(CACHE).then((c) => c.put(req, kopie)); };

  const erstNetz = (fallback) => frisch(request)
    .then((res) => {
      if (gut(res)) { ablegen(request, res); return res; }
      return fallback().then((hit) => hit || res);
    })
    .catch(() => fallback().then((hit) => hit || Response.error()));

  if (request.mode === 'navigate') {
    event.respondWith(erstNetz(() => imVorrat(request).then((hit) => hit || imVorrat('./index.html'))));
    return;
  }
  if (url.pathname.startsWith(new URL('./daten/', self.location).pathname)) {
    event.respondWith(erstNetz(() => imVorrat(request)));
    return;
  }

  event.respondWith(
    imVorrat(request).then((hit) => {
      const erneuern = frisch(request)
        .then((res) => { if (gut(res)) ablegen(request, res); return res; })
        .catch(() => hit);
      return hit || erneuern;
    }),
  );
});
