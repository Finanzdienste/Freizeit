/*
 * Gemeinsam planen: Bock-Haken mit einer zweiten Person teilen.
 *
 * Ein Raum ist ein zufälliger Code (xxxx-xxxx-xxxx). Wer ihn kennt, sieht und
 * setzt Haken – der Server (Supabase, siehe supabase/gemeinsam.sql) speichert
 * nur einen Hash davon. Jede Person hat eine zufällige Kennung und einen Namen.
 *
 * Die eigenen Haken gelten sofort (speicher.js) und gehen über eine
 * Warteschlange zum Server; ohne Netz bleiben sie dort, bis es wieder geht.
 * Danach holt der Abgleich den ganzen Raum: Namen und die Haken aller. Für
 * die eigenen Haken ist dann der Server maßgeblich – so kommen auch Haken an,
 * die man auf einem zweiten Gerät gesetzt hat.
 *
 * Was von anderen kommt (Namen, Schnappschüsse), ist fremder Text: Er geht
 * beim Anzeigen durch esc(), Links durch sichererLink().
 */
import { SERVER } from './config.js';
import { aktuell, speichern } from './speicher.js';

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
const zufall = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => ALPHABET[b % 32]).join('');

/** Ein neuer Raumcode: 12 Zeichen ohne Verwechsler (kein l, o, 0, 1), etwa 60 Bit. */
export function neuerCode() {
  const z = zufall(12);
  return `${z.slice(0, 4)}-${z.slice(4, 8)}-${z.slice(8)}`;
}

/** Ein eingegebener Code in der Form, die der Server erwartet – sonst ''. */
export function codeLesen(text) {
  const z = String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return z.length === 12 ? `${z.slice(0, 4)}-${z.slice(4, 8)}-${z.slice(8)}` : '';
}

const neuePerson = () => `p${zufall(15)}`;

export class ServerFehler extends Error {
  constructor(meldung, status = 0) {
    super(meldung);
    this.status = status;
  }
}

async function rpc(name, params) {
  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), 10000);
  let res;
  try {
    res = await fetch(`${SERVER.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      signal: abbruch.signal,
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVER.key,
        // Alte anon-Schlüssel sind JWTs und gehören auch in Authorization;
        // die neuen sb_publishable_… nicht.
        ...(/^sb_/.test(SERVER.key) ? {} : { Authorization: `Bearer ${SERVER.key}` }),
      },
      body: JSON.stringify(params),
    });
  } finally {
    clearTimeout(uhr);
  }
  const text = await res.text();
  let j = null;
  try { j = JSON.parse(text); } catch { /* kein JSON */ }
  if (!res.ok) {
    if (res.status === 404 || /PGRST202|schema cache/i.test(text)) {
      throw new ServerFehler('Der Server ist noch nicht eingerichtet – der SQL-Block aus supabase/gemeinsam.sql fehlt.', res.status);
    }
    throw new ServerFehler((j && (j.message || j.msg || j.error)) || `HTTP ${res.status}`, res.status);
  }
  return j;
}

const normal = (s) => ({
  personen: Array.isArray(s && s.personen) ? s.personen : [],
  bock: Array.isArray(s && s.bock) ? s.bock : [],
});

let status = { laeuft: false, offline: false, fehler: '', zuletzt: '' };
/** Wie der letzte Abgleich lief – für die Zeile oben in „Wir“. */
export const syncStatus = () => status;

/** Alle eigenen Haken in die Warteschlange, die der Server noch nicht hat. */
function eigeneHakenEinreihen() {
  const st = aktuell();
  const g = st.gemeinsam;
  const schonDa = new Set(g.stand.bock.filter((b) => b.person === g.ich.id).map((b) => b.eintrag));
  for (const [eintrag, daten] of Object.entries(st.bock)) {
    if (!schonDa.has(eintrag) && !st.warteschlange.some((w) => w.eintrag === eintrag)) {
      st.warteschlange.push({ eintrag, bock: true, daten });
    }
  }
}

/** Einen neuen Raum anlegen und selbst als erste Person eintreten. */
export async function planStarten(name) {
  const st = aktuell();
  const code = neuerCode();
  const ich = { id: neuePerson(), name: String(name).trim() };
  const stand = normal(await rpc('freizeit_ich', { p_code: code, p_person: ich.id, p_name: ich.name }));
  st.gemeinsam = { code, ich, stand, abgeholt: new Date().toISOString() };
  st.einladung = '';
  eigeneHakenEinreihen();
  speichern();
  await abgleichen();
}

/**
 * Einem Raum beitreten. Gibt es dort schon jemanden mit diesem Namen, ist man
 * das selbst auf einem weiteren Gerät – dann gilt dieselbe Kennung.
 */
export async function beitreten(codeText, name) {
  const st = aktuell();
  const code = codeLesen(codeText);
  if (!code) throw new ServerFehler('Der Code hat 12 Zeichen, etwa abcd-efgh-jkmn.');
  const vorher = normal(await rpc('freizeit_lesen', { p_code: code }));
  if (!vorher.personen.length) throw new ServerFehler('Zu diesem Code gibt es keinen gemeinsamen Plan. Ist er richtig abgeschrieben?');
  const sauber = String(name).trim();
  const gleich = vorher.personen.find((p) => p.name.trim().toLowerCase() === sauber.toLowerCase());
  const ich = { id: gleich ? gleich.id : neuePerson(), name: sauber };
  const stand = normal(await rpc('freizeit_ich', { p_code: code, p_person: ich.id, p_name: ich.name }));
  st.gemeinsam = { code, ich, stand, abgeholt: new Date().toISOString() };
  st.einladung = '';
  eigeneHakenEinreihen();
  speichern();
  await abgleichen();
}

export async function umbenennen(name) {
  const g = aktuell().gemeinsam;
  if (!g) return;
  g.stand = normal(await rpc('freizeit_ich', { p_code: g.code, p_person: g.ich.id, p_name: String(name).trim() }));
  g.ich.name = String(name).trim();
  speichern();
}

/** Den Raum verlassen: Die eigenen Haken verschwinden beim Server, hier bleiben sie. */
export async function verlassen() {
  const st = aktuell();
  const g = st.gemeinsam;
  if (!g) return;
  await rpc('freizeit_weg', { p_code: g.code, p_person: g.ich.id });
  st.gemeinsam = null;
  st.warteschlange = [];
  speichern();
}

async function einmalAbgleichen() {
  const st = aktuell();
  const g = st.gemeinsam;
  if (!g) return;
  status = { ...status, laeuft: true };
  const abgelehnt = [];
  try {
    while (st.warteschlange.length && st.gemeinsam === g) {
      const w = st.warteschlange[0];
      try {
        g.stand = normal(await rpc('freizeit_bock', {
          p_code: g.code, p_person: g.ich.id, p_eintrag: w.eintrag, p_bock: w.bock, p_daten: w.bock ? w.daten : null,
        }));
      } catch (e) {
        if (e instanceof ServerFehler && /unbekannte Person/.test(e.message)) {
          // Aus dem Raum gefallen (etwa auf einem anderen Gerät verlassen): wieder eintreten.
          g.stand = normal(await rpc('freizeit_ich', { p_code: g.code, p_person: g.ich.id, p_name: g.ich.name }));
          continue;
        }
        if (e instanceof ServerFehler && e.status >= 400 && e.status < 500) {
          // Abgelehnt (zu groß, zu viele): Dieser Wunsch geht nie durch – weg damit, aber sagen.
          abgelehnt.push(e.message);
          st.warteschlange.shift();
          speichern();
          continue;
        }
        throw e;
      }
      st.warteschlange.shift();
      speichern();
    }
    if (st.gemeinsam !== g) return;
    g.stand = normal(await rpc('freizeit_lesen', { p_code: g.code }));
    if (!g.stand.personen.some((p) => p.id === g.ich.id)) {
      g.stand = normal(await rpc('freizeit_ich', { p_code: g.code, p_person: g.ich.id, p_name: g.ich.name }));
    }
    // Die Warteschlange ist leer: Für die eigenen Haken gilt jetzt der Server.
    const meine = {};
    for (const b of g.stand.bock.filter((x) => x.person === g.ich.id)) {
      meine[b.eintrag] = st.bock[b.eintrag] || { ...(b.daten || {}), gesetzt: b.geaendert };
    }
    st.bock = meine;
    g.abgeholt = new Date().toISOString();
    status = { laeuft: false, offline: false, fehler: abgelehnt.join(' · '), zuletzt: g.abgeholt };
  } catch (e) {
    status = {
      ...status,
      laeuft: false,
      offline: !(e instanceof ServerFehler),
      fehler: e instanceof ServerFehler ? e.message : '',
    };
  } finally {
    speichern();
  }
}

let laufend = null;
let nochmal = false;

/** Warteschlange senden und den Raum holen. Läuft schon einer, folgt genau ein weiterer. */
export function abgleichen() {
  if (laufend) {
    nochmal = true;
    return laufend;
  }
  laufend = (async () => {
    do {
      nochmal = false;
      await einmalAbgleichen();
    } while (nochmal);
  })().finally(() => { laufend = null; });
  return laufend;
}

// --- Was die Ansichten brauchen

let index = { ref: null, map: new Map() };
function bockIndex(g) {
  if (index.ref !== g.stand) {
    const map = new Map();
    for (const b of g.stand.bock) {
      if (!map.has(b.eintrag)) map.set(b.eintrag, []);
      map.get(b.eintrag).push(b);
    }
    index = { ref: g.stand, map };
  }
  return index.map;
}

/** Eine Person des Raums mit ihrer Nummer (für die Farbe), oder null. */
export function person(id) {
  const g = aktuell().gemeinsam;
  if (!g) return null;
  const nr = g.stand.personen.findIndex((p) => p.id === id);
  return nr < 0 ? null : { ...g.stand.personen[nr], nr, ich: id === g.ich.id };
}

/** Wer außer mir hat Bock auf diesen Eintrag? */
export function andere(schluessel) {
  const g = aktuell().gemeinsam;
  if (!g) return [];
  return (bockIndex(g).get(schluessel) || [])
    .filter((b) => b.person !== g.ich.id)
    .map((b) => person(b.person))
    .filter(Boolean);
}

/** Alle Haken der anderen: [{ eintrag, person, daten, geaendert }]. */
export function hakenDerAnderen() {
  const g = aktuell().gemeinsam;
  if (!g) return [];
  return g.stand.bock.filter((b) => b.person !== g.ich.id && person(b.person));
}

/** Wann zuletzt jemand anderes einen Haken gesetzt hat – für den Punkt an der Leiste. */
export function neuesterAndererHaken() {
  return hakenDerAnderen().map((b) => b.geaendert || '').sort().pop() || '';
}

/** Der Link, den man verschickt. Der Code steht hinter #, geht also nie an einen Server. */
export const einladungsLink = (code) => `${location.origin}${location.pathname}#einladung=${code}`;
