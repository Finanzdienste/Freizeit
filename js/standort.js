/*
 * Wo bin ich – und wie weit ist es bis dorthin?
 *
 * Der Bezugspunkt ist entweder der Standort des Geräts (Browser fragt um
 * Erlaubnis) oder eine Adresse, die man eintippt. Er liegt nur hier auf dem
 * Gerät (speicher.js, standort) und geht nie an den Server des gemeinsamen
 * Plans. Eine eingetippte Adresse geht zum Suchen an OpenStreetMap
 * (Nominatim) – nur sie, kein Standort.
 *
 * Entfernungen sind Luftlinie. Damit zeigen die Karten, wie weit es ist,
 * der Umkreis-Filter blendet Fernes aus (filter.js), und die Liste sortiert
 * auf Wunsch je Tag nach Nähe.
 */
/** Die Wahl im Umkreis: 0 heißt alle. */
export const UMKREISE = [0, 2, 5, 10, 25, 50];

const ERDE_KM = 6371.0088;
const rad = (g) => (g * Math.PI) / 180;

/** Ist das ein brauchbarer Punkt [Breite, Länge]? */
export const punktOk = (g) => Array.isArray(g) && g.length === 2
  && Number.isFinite(g[0]) && Number.isFinite(g[1]) && Math.abs(g[0]) <= 90 && Math.abs(g[1]) <= 180;

/** Luftlinie zwischen zwei Punkten in km (Haversine). */
export function kmZwischen(a, b) {
  const d = Math.sin(rad(b[0] - a[0]) / 2) ** 2
    + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2;
  return 2 * ERDE_KM * Math.asin(Math.min(1, Math.sqrt(d)));
}

/** „800 m“, „3,2 km“, „12 km“ – unter einem Kilometer auf 100 m genau. */
export function entfernungText(km) {
  if (!Number.isFinite(km)) return '';
  if (km < 0.95) return `${Math.max(100, Math.round(km * 10) * 100)} m`;
  if (km < 9.95) return `${(Math.round(km * 10) / 10).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
  return `${Math.round(km).toLocaleString('de-DE')} km`;
}

/** Der Bezugspunkt eines Stands (speicher.js) – oder null. */
export const bezugVon = (st) => (st && st.standort && punktOk(st.standort.geo) ? st.standort.geo : null);

/** Wie weit es vom Bezugspunkt bis zu einem Punkt ist (km) – fehlt einer der beiden, null. */
export const entfernung = (von, geo) => (punktOk(von) && punktOk(geo) ? kmZwischen(von, geo) : null);

/** Ein Name, der in einen Knopf passt. */
export const kurzName = (name, max = 22) => {
  const s = String(name || '').trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
};

/** Für Knopf, Karte und Hinweise nur der erste Teil des Namens („Wandsbek Markt“ statt „Wandsbek Markt, Wandsbek“), gekürzt. */
export const knopfName = (name, max = 18) => kurzName(String(name || '').split(',')[0], max);

/** Ein gespeicherter Bezugspunkt, geprüft – oder null (alte oder kaputte Stände). */
export function standortPruefen(s) {
  if (!s || typeof s !== 'object' || !punktOk(s.geo) || !['geraet', 'adresse'].includes(s.art)) return null;
  return {
    art: s.art,
    name: String(s.name || (s.art === 'geraet' ? 'Dein Standort' : 'Adresse')).slice(0, 120),
    geo: [Number(s.geo[0].toFixed(5)), Number(s.geo[1].toFixed(5))],
    zeit: typeof s.zeit === 'string' ? s.zeit : '',
  };
}

/**
 * Was das Standort-Feld im Programm gerade zeigt – nur für die Sitzung:
 * läuft etwas (geraet, suche), eine Meldung, Treffer zur Auswahl, was im
 * Adressfeld stand.
 */
export const standortUi = { laeuft: '', fehler: '', treffer: [], eingabe: '' };

/** Der Standort des Geräts – oder ein Fehler mit einem Satz, was zu tun ist. */
export function geraetStandort() {
  return new Promise((fertig, fehl) => {
    if (!('geolocation' in navigator) || (typeof window.isSecureContext === 'boolean' && !window.isSecureContext)) {
      fehl(new Error('Dieser Browser gibt keinen Standort heraus – tipp stattdessen eine Adresse ein.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => fertig([Number(pos.coords.latitude.toFixed(5)), Number(pos.coords.longitude.toFixed(5))]),
      (e) => {
        const text = {
          1: 'Den Standort hast du nicht freigegeben. Erlauben kannst du ihn in den Einstellungen des Browsers für diese Seite – oder du tippst eine Adresse ein.',
          2: 'Der Standort lässt sich gerade nicht bestimmen. Tipp stattdessen eine Adresse ein.',
          3: 'Das Bestimmen des Standorts hat zu lange gedauert. Noch einmal versuchen – oder eine Adresse eintippen.',
        }[e && e.code] || 'Der Standort lässt sich gerade nicht bestimmen. Tipp stattdessen eine Adresse ein.';
        fehl(new Error(text));
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 5 * 60 * 1000 },
    );
  });
}

/** Aus einem Treffer von Nominatim ein kurzer Name: „Wandsbeker Marktstraße 1, Wandsbek“, „Elbphilharmonie, HafenCity“. */
function trefferName(t) {
  const a = t.address || {};
  const strasse = [a.road || a.pedestrian || a.footway || a.square, a.house_number].filter(Boolean).join(' ');
  const viertel = a.suburb || a.city_district || a.quarter || a.neighbourhood || '';
  const stadt = a.city || a.town || a.village || a.municipality || '';
  const kopf = t.name && t.name !== a.road ? t.name : (strasse || t.name || '');
  const teile = [kopf, viertel && viertel !== kopf ? viertel : '', stadt && stadt !== 'Hamburg' && stadt !== kopf ? stadt : ''].filter(Boolean);
  return teile.length ? teile.slice(0, 2).join(', ') : String(t.display_name || '').split(',').slice(0, 2).join(',').trim();
}

/** Wo die Suche fragt – mit Vorliebe für Hamburg und Umgebung (viewbox, nicht begrenzt). */
export const SUCHE = 'https://nominatim.openstreetmap.org/search';

/**
 * Eine Adresse oder einen Ort suchen. Zurück: bis zu fünf Treffer
 * [{ name, geo }], doppelte (gleicher Name) zusammengefasst. Wirft mit
 * einem Satz, wenn die Suche nicht geht.
 */
export async function adresseSuchen(text) {
  const q = String(text || '').trim().slice(0, 200);
  if (!q) return [];
  const url = `${SUCHE}?${new URLSearchParams({
    format: 'jsonv2', countrycodes: 'de', limit: '5', 'accept-language': 'de', addressdetails: '1',
    viewbox: '9.4,54.1,10.8,53.2', bounded: '0', q,
  })}`;
  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), 10000);
  let r;
  try {
    r = await fetch(url, { signal: abbruch.signal, headers: { Accept: 'application/json' } });
  } catch {
    throw new Error('Die Adresssuche braucht Netz – gerade kommt sie nicht durch.');
  } finally {
    clearTimeout(uhr);
  }
  if (!r.ok) throw new Error('Die Adresssuche antwortet gerade nicht. Gleich noch einmal versuchen.');
  let liste;
  try { liste = await r.json(); } catch { liste = []; }
  const gesehen = new Set();
  const treffer = [];
  for (const t of Array.isArray(liste) ? liste : []) {
    const geo = [Number(t.lat), Number(t.lon)];
    if (!punktOk(geo)) continue;
    const name = trefferName(t) || q;
    if (gesehen.has(name)) continue;
    gesehen.add(name);
    treffer.push({ name, geo: [Number(geo[0].toFixed(5)), Number(geo[1].toFixed(5))] });
  }
  return treffer.slice(0, 5);
}
