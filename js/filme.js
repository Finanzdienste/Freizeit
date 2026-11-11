/*
 * IMDb Top 250 (daten/filme.json): Platz, deutscher Titel, Original, Jahr,
 * Länge, Genre, Regie und eine kurze Beschreibung – zum Stöbern unten bei
 * „Was immer geht“. Jeder sagt je Film, ob er Bock hat; Eingeladene sagen
 * „Mit Tobi gucken“ (Bock mit dem Gastgeber).
 *
 * Schlüssel: f:<IMDb-ID>, ohne ID f:<original>-<jahr>; steht in der Datei ein
 * „schluessel“, gilt der (so bleiben Haken, wenn ein Film später seine ID
 * bekommt). Bewertung und Stimmen frischt der Monatslauf jeden Monat auf
 * (werkzeug/filme-aktualisieren.mjs). Poster und Szenenbilder
 * stehen bewusst nicht in der App – darauf sind fast immer Schauspieler zu
 * sehen; Bilder gibt es über den Link zu IMDb.
 */
import { anzahl } from './text.js';

const text = (x) => (typeof x === 'string' ? x.trim() : '');
const slug = (s) => String(s).toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80);

/** Die Datei prüfen: nur Filme mit Platz, Titel und Jahr; der Rest wird leer. */
export function filmeBereinigen(roh, fehler = []) {
  if (!roh || typeof roh !== 'object') return null;
  if (!Array.isArray(roh.filme)) {
    fehler.push('filme.json: keine Liste „filme“');
    return null;
  }
  const filme = roh.filme
    .filter((f) => f && Number.isInteger(f.platz) && text(f.titel) && Number.isInteger(f.jahr))
    .map((f) => ({
      platz: f.platz,
      titel: text(f.titel),
      original: text(f.original),
      jahr: f.jahr,
      laenge: Number.isInteger(f.laenge) && f.laenge > 0 ? f.laenge : null,
      genre: Array.isArray(f.genre) ? f.genre.filter((g) => typeof g === 'string' && g) : [],
      regie: text(f.regie),
      imdb: /^tt\d{6,10}$/.test(f.imdb || '') ? f.imdb : '',
      schluessel: /^f:[a-z0-9-]{3,90}$/.test(f.schluessel || '') ? f.schluessel : '',
      wertung: typeof f.wertung === 'number' && f.wertung >= 1 && f.wertung <= 10 ? f.wertung : null,
      stimmen: Number.isInteger(f.stimmen) && f.stimmen > 0 ? f.stimmen : null,
      beschreibung: text(f.beschreibung),
    }))
    .sort((a, b) => a.platz - b.platz);
  return { stand: text(roh.stand), quelle: text(roh.quelle), filme };
}

/** Ein Film in der Form, mit der Karten, Bock und „Wir“ arbeiten. */
export function filmEintrag(f) {
  const suche = encodeURIComponent(`${f.original || f.titel} ${f.jahr}`);
  return {
    quelle: 'film',
    schluessel: f.schluessel || (f.imdb ? `f:${f.imdb}` : `f:${slug(`${f.original || f.titel}-${f.jahr}`)}`),
    titel: f.titel,
    original: f.original && f.original !== f.titel ? f.original : '',
    jahr: f.jahr,
    platz: f.platz,
    laenge: f.laenge,
    wertung: f.wertung,
    stimmen: f.stimmen,
    genre: f.genre,
    regie: f.regie,
    beschreibung: f.beschreibung,
    kategorie: 'Film',
    link: f.imdb ? `https://www.imdb.com/de/title/${f.imdb}/` : `https://www.imdb.com/find/?q=${suche}&s=tt&ttype=ft`,
    datum: null,
    zeit: '',
  };
}

export const filmEintraege = (d) => (d ? d.filme.map(filmEintrag) : []);

/** 9.3 → „★ 9,3“ */
export const wertungText = (w) => (w ? `★ ${w.toFixed(1).replace('.', ',')}` : '');

/** 142 → „2 Std. 22 Min.“ */
export function laengeText(min) {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h} Std.` : '', m ? `${m} Min.` : ''].filter(Boolean).join(' ');
}

/** Alle Genres der Liste, nach Häufigkeit. */
export function genres(filme) {
  const n = new Map();
  for (const f of filme) for (const g of f.genre) n.set(g, (n.get(g) || 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de')).map(([g]) => g);
}

const klein = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

/**
 * Was die Liste nach Suche, Genre und Auswahl zeigt.
 * @param {object} ui  { suche, genre, nur: 'alle' | 'bock' | 'andere' }
 * @param {function} bock    (schluessel) → ob ich Bock habe
 * @param {function} andere  (schluessel) → ob jemand anders Bock hat
 */
export function filmeFiltern(filme, ui, bock, andere) {
  const q = klein(ui.suche || '').trim();
  return filme.filter((f) => {
    if (ui.genre && !f.genre.includes(ui.genre)) return false;
    if (ui.nur === 'bock' && !bock(f.schluessel)) return false;
    if (ui.nur === 'andere' && !andere(f.schluessel)) return false;
    if (!q) return true;
    return [f.titel, f.original, f.regie, String(f.jahr), ...f.genre].some((t) => klein(t).includes(q));
  });
}

export const filmeZahl = (n) => anzahl(n, 'Film', 'Filme');
