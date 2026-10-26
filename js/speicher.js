/*
 * Was die App auf dem Gerät behält: Filter, die eigenen Bock-Haken, den
 * gemeinsamen Plan (Code, wer man selbst ist, zuletzt abgeholter Stand) und
 * was noch zum Server muss.
 *
 * Alles in einem Schlüssel im localStorage. Der kann fehlen (privates Fenster,
 * gelöschte Websitedaten) oder beim Schreiben scheitern (voller Speicher) –
 * dann läuft die App mit dem Stand im Speicher weiter, nur ohne Gedächtnis.
 *
 * Der Schlüssel heißt noch …v1; die Fassung steht im Inhalt. Ein Stand der
 * ersten Fassung (Merkliste) wird beim Laden übernommen: Was gemerkt war,
 * ist jetzt ein eigener Bock-Haken.
 */

export const SCHLUESSEL = 'freizeit.stand.v1';

export const LEERER_FILTER = () => ({
  region: '', kategorie: '', kostenlos: false, feierabend: false, drinnen: false, draussen: false, hohwacht: false, kuenstler: false,
});

const LEER = () => ({
  version: 2,
  filter: LEERER_FILTER(),
  // schluessel → Schnappschuss des Eintrags (siehe schnappschuss()) + gesetzt
  bock: {},
  // { code, ich: { id, name }, stand: { personen: [], bock: [] }, abgeholt } oder null
  gemeinsam: null,
  // Was noch zum Server muss: [{ eintrag, bock, daten }], in dieser Reihenfolge
  warteschlange: [],
  // Code aus einem Einladungslink, bis man beigetreten ist
  einladung: '',
  // Wann zuletzt in „Wir“ geschaut wurde – für den Punkt an der Leiste
  gesehen: { andere: '' },
  vergangeneTage: false,
  installHinweisWeg: false,
});

let stand = LEER();

function ausErsterFassung(roh) {
  const st = LEER();
  st.filter = { ...st.filter, ...(roh.filter || {}) };
  for (const m of Array.isArray(roh.merkliste) ? roh.merkliste : []) {
    if (m && m.schluessel && m.titel) st.bock[m.schluessel] = { ...schnappschuss(m), gesetzt: m.gemerktAm || '' };
  }
  st.vergangeneTage = Boolean(roh.vergangeneTage);
  return st;
}

export function laden() {
  try {
    const roh = JSON.parse(localStorage.getItem(SCHLUESSEL) || 'null');
    if (roh && roh.version === 1) {
      stand = ausErsterFassung(roh);
      speichern();
    } else if (roh && roh.version === 2) {
      const leer = LEER();
      stand = {
        ...leer,
        ...roh,
        filter: { ...leer.filter, ...(roh.filter || {}) },
        gesehen: { ...leer.gesehen, ...(roh.gesehen || {}) },
        bock: roh.bock && typeof roh.bock === 'object' ? roh.bock : {},
        warteschlange: Array.isArray(roh.warteschlange) ? roh.warteschlange : [],
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

/** Hat man selbst Bock auf diesen Eintrag? */
export const meinBock = (schluessel) => Object.hasOwn(stand.bock, schluessel);

const FELDER = ['quelle', 'titel', 'ort', 'datum', 'zeit', 'von', 'bis', 'ganztags', 'endeMin', 'link', 'kategorie',
  'region', 'kuenstler', 'preis', 'kostenlos', 'anreise', 'beschreibung', 'geo'];
const bytes = (o) => new TextEncoder().encode(JSON.stringify(o)).length;

/**
 * Was von einem Eintrag mit dem Haken mitgeht – damit er auch dann noch
 * vollständig dasteht, wenn er aus den Daten gefallen ist (vorbei, oder ein
 * neuer Montagslauf hat ihn umbenannt). Der Server nimmt höchstens 2000 Byte;
 * hier bleibt es unter 1800.
 */
export function schnappschuss(e) {
  const s = {};
  for (const k of FELDER) {
    const v = e[k];
    if (v !== undefined && v !== null && v !== '' && v !== false) s[k] = v;
  }
  if (s.beschreibung) s.beschreibung = String(s.beschreibung).slice(0, 200);
  for (const weg of ['beschreibung', 'anreise', 'preis', 'geo', 'region']) {
    if (bytes(s) <= 1800) break;
    delete s[weg];
  }
  if (bytes(s) > 1800) {
    s.titel = String(s.titel || '').slice(0, 100);
    s.ort = String(s.ort || '').slice(0, 80);
    s.link = String(s.link || '').slice(0, 400);
  }
  return s;
}

/**
 * Bock an oder aus. Im gemeinsamen Plan geht die Änderung zusätzlich in die
 * Warteschlange für den Server (siehe gemeinsam.js). Zurück: an oder aus.
 */
export function bockUmschalten(eintrag) {
  const an = !meinBock(eintrag.schluessel);
  if (an) stand.bock[eintrag.schluessel] = { ...schnappschuss(eintrag), gesetzt: new Date().toISOString() };
  else delete stand.bock[eintrag.schluessel];
  if (stand.gemeinsam) {
    // Ein früherer, noch nicht gesendeter Wunsch für denselben Eintrag ist überholt.
    stand.warteschlange = stand.warteschlange.filter((w) => w.eintrag !== eintrag.schluessel);
    stand.warteschlange.push({ eintrag: eintrag.schluessel, bock: an, daten: an ? stand.bock[eintrag.schluessel] : null });
  }
  speichern();
  return an;
}

/** Eigene Haken wegräumen, ohne Umweg über die Karte (Merkliste „Vorbei entfernen“). */
export function bockWeg(schluessel) {
  if (!meinBock(schluessel)) return;
  const roh = { schluessel };
  bockUmschalten(roh);
}
