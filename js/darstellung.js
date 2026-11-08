/*
 * Darstellung: hell, dunkel oder wie das Gerät (Einstellungen → Darstellung).
 *
 * Die Wahl gehört zum Gerät, nicht zum Plan – sie steht im localStorage unter
 * „freizeit.darstellung“ und wandert nicht mit dem Abgleich. index.html setzt
 * html[data-schema] schon im <head>, damit beim Start nichts hell aufblitzt;
 * styles.css hat die Farben für beide Schemata. „Automatisch“ heißt: kein
 * data-schema, das System entscheidet (prefers-color-scheme).
 */
const SCHLUESSEL = 'freizeit.darstellung';
/** Falls der Speicher nicht geht (privates Fenster): die Wahl dieser Sitzung. */
let sitzung = null;

export const DARSTELLUNGEN = [['auto', 'Automatisch'], ['hell', 'Hell'], ['dunkel', 'Dunkel']];

/** Die Farbe der Browserleiste je Schema – der Grund der Seite (styles.css, --bg). */
const LEISTE = { hell: '#e7ecf0', dunkel: '#0a1520' };

export function darstellung() {
  try {
    const w = localStorage.getItem(SCHLUESSEL);
    return w === 'hell' || w === 'dunkel' ? w : 'auto';
  } catch {
    return sitzung || 'auto';
  }
}

const systemDunkel = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;

/** Setzt das Schema auf der Seite und die Farbe der Browserleiste. */
export function darstellungAnwenden(wahl = darstellung()) {
  const html = document.documentElement;
  if (wahl === 'hell' || wahl === 'dunkel') html.dataset.schema = wahl;
  else delete html.dataset.schema;
  const dunkel = wahl === 'dunkel' || (wahl === 'auto' && systemDunkel());
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    // Bei „Automatisch“ gilt wieder das media-Attribut der beiden Zeilen in index.html.
    m.setAttribute('content', wahl === 'auto' ? LEISTE[m.media.includes('dark') ? 'dunkel' : 'hell'] : LEISTE[dunkel ? 'dunkel' : 'hell']);
  });
}

export function darstellungSetzen(wahl) {
  const w = DARSTELLUNGEN.some(([k]) => k === wahl) ? wahl : 'auto';
  sitzung = w;
  try {
    if (w === 'auto') localStorage.removeItem(SCHLUESSEL);
    else localStorage.setItem(SCHLUESSEL, w);
  } catch { /* privates Fenster: gilt dann bis zum Neuladen */ }
  darstellungAnwenden(w);
  return w;
}
