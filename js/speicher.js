/*
 * Was die App auf dem Gerät behält: Filter, Merkliste, zuletzt gesehener Stand.
 *
 * Alles in einem Schlüssel im localStorage. Der kann fehlen (privates Fenster,
 * gelöschte Websitedaten) oder beim Schreiben scheitern (voller Speicher) –
 * dann läuft die App mit dem Stand im Speicher weiter, nur ohne Gedächtnis.
 */

export const SCHLUESSEL = 'freizeit.stand.v1';

const LEER = () => ({
  version: 1,
  filter: { region: '', kategorie: '', kostenlos: false, feierabend: false, drinnen: false, draussen: false, hohwacht: false },
  merkliste: [],
  gesehen: { woche: '', konzerte: '' },
  vergangeneTage: false,
});

let stand = LEER();

export function laden() {
  try {
    const roh = JSON.parse(localStorage.getItem(SCHLUESSEL) || 'null');
    if (roh && roh.version === 1) {
      const leer = LEER();
      stand = {
        ...leer,
        ...roh,
        filter: { ...leer.filter, ...(roh.filter || {}) },
        gesehen: { ...leer.gesehen, ...(roh.gesehen || {}) },
        merkliste: Array.isArray(roh.merkliste) ? roh.merkliste : [],
      };
    }
  } catch { /* ohne Gedächtnis weiter */ }
  return stand;
}

export function speichern() {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(stand));
    return true;
  } catch {
    return false;
  }
}

export const aktuell = () => stand;

/** Gemerkt ist ein Eintrag über seinen Schlüssel aus Quelle, Kennung und Tag. */
export const gemerkt = (schluessel) => stand.merkliste.some((m) => m.schluessel === schluessel);

export function merken(eintrag) {
  if (gemerkt(eintrag.schluessel)) {
    stand.merkliste = stand.merkliste.filter((m) => m.schluessel !== eintrag.schluessel);
  } else {
    stand.merkliste.push({ ...eintrag, gemerktAm: new Date().toISOString() });
  }
  speichern();
  return gemerkt(eintrag.schluessel);
}

export function entfernen(schluessel) {
  stand.merkliste = stand.merkliste.filter((m) => m.schluessel !== schluessel);
  speichern();
}
