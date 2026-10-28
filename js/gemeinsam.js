/*
 * Gemeinsam planen: Du lädst deine Leute ein und siehst, worauf sie Bock
 * haben – mit dir oder ohne dich.
 *
 * Ein Plan ist ein Raum mit einem zufälligen Code (xxxx-xxxx-xxxx). Wer ihn
 * anlegt, ist der Gastgeber: Seine Geräte kennen einen Schlüssel, und er
 * sieht alle im Plan mit allen Haken. Wer über den Link dazukommt, sieht den
 * Gastgeber und sich selbst, sonst niemanden, und sagt bei jedem Haken, ob er
 * es mit dem Gastgeber machen will oder allein bzw. mit anderen – das steht
 * als mitwem im Schnappschuss des Hakens. Der Server (Supabase, siehe
 * supabase/gemeinsam.sql) speichert von Code und Schlüssel nur Hashes und
 * entscheidet selbst, wer was zu sehen bekommt.
 *
 * Die eigenen Haken gelten sofort (speicher.js) und gehen über eine
 * Warteschlange zum Server; ohne Netz bleiben sie dort, bis es wieder geht.
 * Danach holt der Abgleich, was man sehen darf. Für die eigenen Haken ist
 * dann der Server maßgeblich – so kommen auch Haken an, die man auf einem
 * weiteren Gerät gesetzt hat. Dorthin nimmt man sich mit einem Link mit
 * (#geraet=…), der Code, eigene Kennung und – beim Gastgeber – den Schlüssel
 * trägt.
 *
 * Fliegt man aus dem Plan (der Gastgeber nimmt einen heraus oder löst ihn
 * auf, oder auf diesem Gerät fehlt sein Schlüssel), merkt sich der Plan das
 * als „raus“ und sendet nichts mehr, bis man wieder beitritt oder ihn
 * vergisst. Von selbst tritt die App nirgends wieder ein.
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

/** Der Schlüssel des Gastgebers: 24 Zeichen, rund 120 Bit. */
const neuerSchluessel = () => zufall(24);

/** Ein eingegebener Code in der Form, die der Server erwartet – sonst ''. */
export function codeLesen(text) {
  const z = String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return z.length === 12 ? `${z.slice(0, 4)}-${z.slice(4, 8)}-${z.slice(8)}` : '';
}

/**
 * Der Zugang für ein weiteres Gerät – aus dem Link (…#geraet=…) oder seinem
 * Teil hinter „geraet=“: { code, person, schluessel } oder null.
 */
export function zugangLesen(text) {
  const t = String(text || '').trim();
  const m = t.match(/(?:^|geraet=)([a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4})\.([a-z0-9-]{8,40})(?:\.([a-z0-9]{20,64}))?$/i);
  if (!m || m[2].toLowerCase() === 'gastgeber') return null;
  return { code: m[1].toLowerCase(), person: m[2].toLowerCase(), schluessel: m[3] ? m[3].toLowerCase() : '' };
}

const neuePerson = () => `p${zufall(15)}`;

export class ServerFehler extends Error {
  constructor(meldung, status = 0, einrichtung = false) {
    super(meldung);
    this.status = status;
    // Der Server kennt die Funktionen (noch) nicht: Das geht vorbei – nichts verwerfen.
    this.einrichtung = einrichtung;
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
    if (res.status === 404 || /PGRST20[23]|schema cache/i.test(text)) {
      throw new ServerFehler('Der Server ist nicht auf dem Stand dieser App – der SQL-Block aus supabase/gemeinsam.sql muss (noch einmal) laufen.', res.status, true);
    }
    throw new ServerFehler((j && (j.message || j.msg || j.error)) || `HTTP ${res.status}`, res.status);
  }
  return j;
}

const normal = (s) => ({
  rolle: ['gastgeber', 'mitglied', 'gast'].includes(s && s.rolle) ? s.rolle : '',
  personen: Array.isArray(s && s.personen) ? s.personen : [],
  bock: Array.isArray(s && s.bock) ? s.bock : [],
});

/** Wer man im Plan ist – für jeden Aufruf. Den Schlüssel hat nur der Gastgeber. */
const ichImPlan = (g) => ({ p_code: g.code, p_person: g.ich.id, ...(g.schluessel ? { p_schluessel: g.schluessel } : {}) });

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

/** Den Plan übernehmen und gleich abgleichen. */
async function einrichten(g) {
  const st = aktuell();
  st.gemeinsam = { abgeholt: new Date().toISOString(), raus: '', ...g, gastgeber: gastgeberAus(g) };
  st.einladung = '';
  st.zugang = '';
  st.warteschlange = [];
  eigeneHakenEinreihen();
  speichern();
  await abgleichen();
}

/** Der Name des Gastgebers aus dem, was der Server zeigt. */
function gastgeberAus(g) {
  if (g.rolle === 'gastgeber') return g.ich.name;
  const p = g.stand.personen.find((x) => x.id === 'gastgeber');
  return p ? p.name : '';
}

/** Einen neuen Plan anlegen – man ist sein Gastgeber. */
export async function planStarten(name) {
  const code = neuerCode();
  const schluessel = neuerSchluessel();
  const ich = { id: neuePerson(), name: String(name).trim() };
  const stand = normal(await rpc('freizeit_ich', { p_code: code, p_person: ich.id, p_name: ich.name, p_schluessel: schluessel }));
  // Ein Code, den es schon gab, ist bei 60 Bit kaum denkbar – aber dann wäre man dort nur Gast.
  if (stand.rolle !== 'gastgeber') throw new ServerFehler('Das hat nicht geklappt – bitte noch einmal.');
  await einrichten({ code, ich, rolle: 'gastgeber', schluessel, stand });
}

/** Wer zu einem Code einlädt: { name, da } – da ist false, wenn es den Plan nicht gibt. */
export async function einladungAnsehen(code) {
  const s = normal(await rpc('freizeit_lesen', { p_code: code }));
  const g = s.personen.find((p) => p.id === 'gastgeber') || s.personen[0];
  return { name: g ? g.name : '', da: s.personen.length > 0 };
}

/**
 * Einem Plan beitreten – immer als neue Person. Wer schon dabei ist und ein
 * weiteres Gerät mitnehmen will, nimmt dafür den Link „Weiteres Gerät“.
 */
export async function beitreten(codeText, name) {
  const code = codeLesen(codeText);
  if (!code) throw new ServerFehler('Der Code hat 12 Zeichen, etwa abcd-efgh-jkmn.');
  const vorher = await einladungAnsehen(code);
  if (!vorher.da) throw new ServerFehler('Zu diesem Code gibt es keinen gemeinsamen Plan. Ist er richtig abgeschrieben?');
  const ich = { id: neuePerson(), name: String(name).trim() };
  const stand = normal(await rpc('freizeit_ich', { p_code: code, p_person: ich.id, p_name: ich.name }));
  await einrichten({ code, ich, rolle: stand.rolle === 'gastgeber' ? 'gastgeber' : 'mitglied', stand });
}

/** Mit dem Link „Weiteres Gerät“: hier dieselbe Person sein wie dort. */
export async function zugangUebernehmen(zugang) {
  const z = typeof zugang === 'string' ? zugangLesen(zugang) : zugang;
  if (!z) throw new ServerFehler('Dieser Link ist unvollständig – am besten noch einmal kopieren.');
  const g = { code: z.code, ich: { id: z.person, name: '' }, ...(z.schluessel ? { schluessel: z.schluessel } : {}) };
  const stand = normal(await rpc('freizeit_lesen', ichImPlan(g)));
  const ich = stand.personen.find((p) => p.id === z.person);
  if (stand.rolle === 'gast' || !ich) throw new ServerFehler('Mit diesem Link ist niemand mehr im Plan.');
  if (stand.rolle !== 'gastgeber') delete g.schluessel;
  await einrichten({ ...g, ich: { id: z.person, name: ich.name }, rolle: stand.rolle, stand });
}

/** Der Link „Weiteres Gerät“ – nur für einen selbst. */
export function zugangsLink(g = aktuell().gemeinsam) {
  return `${location.origin}${location.pathname}#geraet=${g.code}.${g.ich.id}${g.schluessel ? `.${g.schluessel}` : ''}`;
}

export async function umbenennen(name) {
  const g = aktuell().gemeinsam;
  if (!g) return;
  const sauber = String(name).trim();
  g.stand = normal(await rpc('freizeit_ich', { ...ichImPlan(g), p_name: sauber }));
  g.ich.name = sauber;
  g.gastgeber = gastgeberAus(g);
  speichern();
}

/**
 * Dieses Gerät beim Server für Push an- (an = true) oder abmelden – nur der
 * Gastgeber; das Abo ist das des Browsers (push.js). Zurück kommt
 * { push, geraete }.
 */
export async function pushMelden(abo, an) {
  const g = aktuell().gemeinsam;
  if (!g) throw new Error('Kein gemeinsamer Plan.');
  return rpc('freizeit_push', { ...ichImPlan(g), p_abo: abo, p_an: Boolean(an) });
}

/**
 * Gehen. Die eigenen Haken verschwinden beim Server, hier bleiben sie. Geht
 * der Gastgeber, ist der Plan für alle aufgelöst.
 */
export async function verlassen() {
  const st = aktuell();
  const g = st.gemeinsam;
  if (!g) return;
  if (!g.raus) await rpc('freizeit_weg', ichImPlan(g));
  vergessen();
}

/** Den Plan auf diesem Gerät vergessen, ohne den Server zu fragen (nach „raus“). */
export function vergessen() {
  const st = aktuell();
  st.gemeinsam = null;
  st.warteschlange = [];
  speichern();
}

/** Nach dem Herausnehmen wieder dabei sein – als dieselbe Person. */
export async function wiederBeitreten() {
  const g = aktuell().gemeinsam;
  if (!g) return;
  g.stand = normal(await rpc('freizeit_ich', { ...ichImPlan(g), p_name: g.ich.name }));
  g.raus = '';
  eigeneHakenEinreihen();
  speichern();
  await abgleichen();
}

/** Der Gastgeber nimmt jemanden aus dem Plan – mit allen seinen Haken. */
export async function entfernen(person) {
  const g = aktuell().gemeinsam;
  if (!g || g.rolle !== 'gastgeber') return;
  g.stand = normal(await rpc('freizeit_weg', { ...ichImPlan(g), p_wer: person }));
  speichern();
}

const istFehler = (e, text) => e instanceof ServerFehler && e.message === text;

async function einmalAbgleichen() {
  const st = aktuell();
  const g = st.gemeinsam;
  if (!g || g.raus) return;
  status = { ...status, laeuft: true };
  const abgelehnt = [];
  try {
    while (st.warteschlange.length && st.gemeinsam === g) {
      const w = st.warteschlange[0];
      try {
        g.stand = normal(await rpc('freizeit_bock', {
          ...ichImPlan(g), p_eintrag: w.eintrag, p_bock: w.bock, p_daten: w.bock ? w.daten : null,
        }));
      } catch (e) {
        // Nicht mehr im Plan: Was das heißt, sagt gleich freizeit_lesen.
        if (istFehler(e, 'unbekannte Person')) break;
        if (e instanceof ServerFehler && !e.einrichtung && e.status >= 400 && e.status < 500 && !istFehler(e, 'falscher Schlüssel')) {
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
    let s = normal(await rpc('freizeit_lesen', ichImPlan(g)));
    if (s.rolle === 'gast') {
      // Herausgenommen oder aufgelöst. Die Haken der anderen sind dann nicht mehr zu sehen.
      g.raus = s.personen.length ? 'weg' : 'aufgeloest';
      g.stand = s;
    } else {
      if (s.rolle === 'gastgeber' && !g.schluessel) {
        // Ein Plan aus der ersten Fassung (ohne Schlüssel), den man selbst
        // begonnen hat: Jetzt den Schlüssel hinterlegen.
        const schluessel = neuerSchluessel();
        s = normal(await rpc('freizeit_ich', { ...ichImPlan(g), p_name: g.ich.name, p_schluessel: schluessel }));
        if (s.rolle === 'gastgeber') g.schluessel = schluessel;
      }
      g.stand = s;
      g.rolle = s.rolle === 'gastgeber' ? 'gastgeber' : 'mitglied';
      g.gastgeber = gastgeberAus(g);
      if (!st.warteschlange.length) {
        // Die Warteschlange ist leer: Für die eigenen Haken gilt jetzt der Server.
        const meine = {};
        for (const b of s.bock.filter((x) => x.person === g.ich.id && !istSystemHaken(x.eintrag))) {
          const hier = st.bock[b.eintrag];
          const dort = b.daten || {};
          meine[b.eintrag] = hier ? { ...hier, ...(dort.mitwem ? { mitwem: dort.mitwem } : {}) } : { ...dort, gesetzt: b.geaendert };
        }
        st.bock = meine;
      }
    }
    g.abgeholt = new Date().toISOString();
    status = { laeuft: false, offline: false, fehler: abgelehnt.join(' · '), zuletzt: g.abgeholt };
  } catch (e) {
    if (istFehler(e, 'falscher Schlüssel')) {
      // Man ist der Gastgeber, aber auf diesem Gerät fehlt der Schlüssel dazu.
      g.raus = 'schluessel';
      g.stand = { rolle: 'gast', personen: [], bock: [] };
    }
    status = {
      ...status,
      laeuft: false,
      offline: !(e instanceof ServerFehler),
      fehler: e instanceof ServerFehler && !g.raus ? e.message : '',
    };
  } finally {
    speichern();
  }
}

let laufend = null;
let nochmal = false;

/** Warteschlange senden und holen, was man sehen darf. Läuft schon einer, folgt genau ein weiterer. */
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

/**
 * Die eigene Rolle im Plan: 'gastgeber', 'mitglied' – oder '' ohne Plan. Ein
 * Plan aus der ersten Fassung kennt sie erst nach dem ersten Abgleich; bis
 * dahin gilt als Gastgeber, wer vorn steht – wer ihn begonnen hat.
 */
export function rolle() {
  const g = aktuell().gemeinsam;
  if (!g) return '';
  if (g.rolle) return g.rolle;
  return g.stand.personen[0] && g.stand.personen[0].id === g.ich.id ? 'gastgeber' : 'mitglied';
}

/** Der Name des Gastgebers – beim Gastgeber der eigene. */
export function gastgeberName() {
  const g = aktuell().gemeinsam;
  if (!g) return '';
  if (rolle() === 'gastgeber') return g.ich.name;
  const p = g.stand.personen.find((x) => x.id === 'gastgeber') || (g.rolle ? null : g.stand.personen[0]);
  return p ? p.name : (g.gastgeber || '');
}

/** Mit wem ein Haken gemeint ist: 'gastgeber' (so auch alle ohne Angabe) oder 'andere'. */
export const mitWem = (daten) => (daten && daten.mitwem === 'andere' ? 'andere' : 'gastgeber');

/** Ein Haken eines anderen, der ausdrücklich ohne den Gastgeber gemeint ist. */
export const ohneGastgeber = (b) => Boolean(b && b.daten && b.daten.mitwem === 'andere');

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

/** Eine Person des Plans mit ihrer Nummer (für die Farbe), oder null. */
export function person(id) {
  const g = aktuell().gemeinsam;
  if (!g) return null;
  const nr = g.stand.personen.findIndex((p) => p.id === id);
  if (nr < 0) return null;
  const gastgeber = id === 'gastgeber' || (rolle() === 'gastgeber' && id === g.ich.id);
  return { ...g.stand.personen[nr], nr, ich: id === g.ich.id, gastgeber };
}

/** Wer außer mir hat Bock auf diesen Eintrag – und mit wem: [{ id, name, nr, mitwem }]. */
export function andere(schluessel) {
  const g = aktuell().gemeinsam;
  if (!g) return [];
  return (bockIndex(g).get(schluessel) || [])
    .filter((b) => b.person !== g.ich.id)
    .map((b) => {
      const p = person(b.person);
      return p && { ...p, mitwem: mitWem(b.daten) };
    })
    .filter(Boolean);
}

/**
 * Ein Treffer: Man hat selbst Bock, und es passt zusammen – beim Gastgeber
 * will jemand mit ihm, bei den anderen hat der Gastgeber Bock und man selbst
 * will mit ihm.
 */
export function treffer(schluessel) {
  const st = aktuell();
  if (!st.gemeinsam || !Object.hasOwn(st.bock, schluessel)) return false;
  const sie = andere(schluessel);
  if (rolle() === 'gastgeber') return sie.some((p) => p.mitwem === 'gastgeber');
  return sie.length > 0 && mitWem(st.bock[schluessel]) === 'gastgeber';
}

/**
 * Haken, die keine Einträge sind: z:<Montag> trägt die belegten Zeiten des
 * Gastgebers (zeiten.js). Sie stehen nirgends als Eintrag und zählen nicht als
 * neuer Haken.
 */
export const istSystemHaken = (eintrag) => String(eintrag).startsWith('z:');

/** Alle Haken der anderen: [{ eintrag, person, daten, geaendert }]. */
export function hakenDerAnderen() {
  const g = aktuell().gemeinsam;
  if (!g) return [];
  return g.stand.bock.filter((b) => b.person !== g.ich.id && !istSystemHaken(b.eintrag) && person(b.person));
}

/** Die Zeiten-Haken des Gastgebers – { quelle (zum Zwischenspeichern), liste }. */
export function zeitenMarken() {
  const g = aktuell().gemeinsam;
  if (!g || g.raus) return { quelle: null, liste: [] };
  const vomGastgeber = (b) => b.person === 'gastgeber' || (rolle() === 'gastgeber' && b.person === g.ich.id);
  return { quelle: g.stand, liste: g.stand.bock.filter((b) => istSystemHaken(b.eintrag) && vomGastgeber(b)) };
}

/** Wann zuletzt jemand anderes einen Haken gesetzt hat – für den Punkt an der Leiste. */
export function neuesterAndererHaken() {
  return hakenDerAnderen().map((b) => b.geaendert || '').sort().pop() || '';
}

/** Der Link, den man verschickt. Der Code steht hinter #, geht also nie an einen Server. */
export const einladungsLink = (code) => `${location.origin}${location.pathname}#einladung=${code}`;
