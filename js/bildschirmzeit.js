/*
 * Bildschirmzeit – wie lange diese App heute sichtbar offen war, für das
 * Widget auf Tobis Startbildschirm.
 *
 * Quelle: Finanzdienste/Bildschirmzeit, web/bildschirmzeit.js. Boxenstopp,
 * Freizeit, Workout und die Bewerbungszentrale haben je eine wortgleiche Kopie
 * als js/bildschirmzeit.js – geändert wird dort, dann in alle vier kopiert.
 *
 * Warum es das gibt: Android zählt die vier Web-Apps als „Chrome“. Die
 * Widget-App liest Androids Nutzungsdaten, holt sich von Supabase, wie lange
 * jede der vier heute offen war, zieht das von Chrome ab und zeigt die vier
 * unter eigenem Namen.
 *
 * Verbunden wird nur über den Link aus der Widget-App:
 *
 *     https://finanzdienste.github.io/<App>/#bildschirmzeit=<Kennung>
 *
 * Ohne ihn bleibt diese Datei still: Sie misst nichts, schickt nichts und
 * zeigt nichts. Wer die App ohne das Widget benutzt, merkt von ihr nichts.
 *
 * Gemessen wird, solange die Seite sichtbar ist (visibilityState), in
 * Schritten von höchstens LUECKE_MS: Schlief das Gerät, ohne dass die Seite es
 * erfuhr, zählt die Lücke nicht. Über Mitternacht wird geteilt.
 *
 * Geschickt wird der Tagesstand, kein Zuwachs – beim Wegschalten mit
 * keepalive, sonst alle fünf Minuten und beim Zurückkommen. Der Server nimmt
 * je Tag den größeren Wert; doppelt schicken schadet also nicht. Antwortet er
 * false, kennt er die Kennung nicht mehr (die Widget-App hat ihre Daten
 * gelöscht) – dann trennt sich die App von selbst.
 *
 * Gespeichert wird im localStorage unter „bildschirmzeit.<app>“. Alle vier
 * Apps liegen auf finanzdienste.github.io und teilen sich deshalb den
 * Speicher; der Name trennt sie.
 */

export const BZ_SERVER = {
  url: 'https://vjyohppohmvhhxgwouti.supabase.co',
  // Öffentlich: Damit erreicht man nur die vier bildschirmzeit_-Funktionen,
  // und jede will die Kennung (supabase/bildschirmzeit.sql im Repo Bildschirmzeit).
  key: 'sb_publishable_wTUNShIKMFjCOmZzQuuN-A_vFHPkKUI',
};
export const BZ_APPS = ['boxenstopp', 'freizeit', 'workout', 'bewerbungszentrale'];
/** Ereignis auf window, wenn sich der Stand ändert (verbunden, getrennt, gemeldet). */
export const BZ_EREIGNIS = 'bildschirmzeit';

const TAKT_MS = 15 * 1000;
const LUECKE_MS = 60 * 1000;
const SENDE_MS = 5 * 60 * 1000;
const NICHT_OEFTER_MS = 10 * 1000;
const ANTWORT_MS = 10 * 1000;
const TAGE = 8;
const KENNUNG = /^[A-Za-z0-9_-]{32,128}$/;
const LINK = /[#&]bildschirmzeit=([A-Za-z0-9_-]{32,128})(?=&|$)/;

let app = '';
let letzter = 0; // Zeitpunkt des letzten Messpunkts; 0 = misst gerade nicht
let uhr = 0;
let zuletztGesendet = 0;
let letzteNutzlast = '';
let anfrageNr = 0; // nur die jüngste Anfrage schreibt den Fehler
let meldung = null;

const speicherName = (a) => `bildschirmzeit.${a}`;

/** Der Kalendertag auf dem Gerät: 'JJJJ-MM-TT'. */
export function tagVon(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Die Zeit von `von` bis `bis` (ms), an Mitternacht geteilt: { tag: sekunden }. */
export function verteilen(von, bis) {
  const aus = {};
  let a = von;
  while (a < bis) {
    const d = new Date(a);
    const mitternacht = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    const e = Math.min(bis, mitternacht);
    const t = tagVon(a);
    aus[t] = (aus[t] || 0) + (e - a) / 1000;
    a = e;
  }
  return aus;
}

/** Die Kennung aus dem Teil hinter #, sonst ''. */
export function kennungAus(hash) {
  const m = LINK.exec(hash || '');
  return m ? m[1] : '';
}

/** „1 Std. 5 Min.“, „12 Min.“, „unter 1 Min.“ – wie das Widget. */
export function dauerText(sekunden) {
  const min = Math.floor((Number(sekunden) || 0) / 60);
  if (min < 1) return 'unter 1 Min.';
  const std = Math.floor(min / 60);
  const rest = min % 60;
  if (!std) return `${rest} Min.`;
  return rest ? `${std} Std. ${rest} Min.` : `${std} Std.`;
}

function lesen() {
  if (!app) return null;
  try {
    const s = JSON.parse(localStorage.getItem(speicherName(app)) || 'null');
    if (!s || typeof s !== 'object' || !KENNUNG.test(s.kennung || '')) return null;
    if (!s.tage || typeof s.tage !== 'object') s.tage = {};
    if (!s.gemeldet || typeof s.gemeldet !== 'object') s.gemeldet = {};
    return s;
  } catch {
    return null;
  }
}

function schreiben(s) {
  try {
    localStorage.setItem(speicherName(app), JSON.stringify(s));
  } catch {
    // Speicher voll oder gesperrt: dann eben nicht.
  }
}

/** Alte Tage weg – mehr als TAGE braucht niemand, und der Server nähme sie nicht. */
function aufraeumen(s, jetzt) {
  const grenze = tagVon(jetzt - (TAGE - 1) * 86400000);
  for (const t of Object.keys(s.tage)) if (t < grenze || !(Number(s.tage[t]) >= 0)) delete s.tage[t];
  for (const t of Object.keys(s.gemeldet)) if (!(t in s.tage)) delete s.gemeldet[t];
}

/** Liest, ändert, schreibt sofort – mehrere Fenster derselben App teilen sich den Speicher. */
function aendern(f) {
  const s = lesen();
  if (!s) return null;
  f(s);
  aufraeumen(s, Date.now());
  schreiben(s);
  return s;
}

function bescheid() {
  try {
    window.dispatchEvent(new globalThis.CustomEvent(BZ_EREIGNIS, { detail: bildschirmzeitStand() }));
  } catch {
    // ohne window (Node) gibt es niemanden, dem man Bescheid sagt
  }
}

/** Die Zeit seit dem letzten Messpunkt gutschreiben. */
function messpunkt() {
  if (!letzter) return;
  const jetzt = Date.now();
  const d = jetzt - letzter;
  letzter = jetzt;
  if (!(d > 0)) return; // Uhr zurückgestellt
  const teile = verteilen(jetzt - Math.min(d, LUECKE_MS), jetzt);
  aendern((s) => {
    for (const [t, sek] of Object.entries(teile)) s.tage[t] = (Number(s.tage[t]) || 0) + sek;
  });
}

function messen() {
  if (!lesen()) {
    anhalten();
    return;
  }
  if (!letzter) letzter = Date.now();
  if (!uhr) uhr = setInterval(takt, TAKT_MS);
}

function anhalten() {
  messpunkt();
  letzter = 0;
  if (uhr) {
    globalThis.clearInterval(uhr);
    uhr = 0;
  }
}

function takt() {
  if (document.visibilityState !== 'visible') {
    anhalten();
    return;
  }
  messpunkt();
  if (Date.now() - zuletztGesendet >= SENDE_MS) bildschirmzeitSenden();
}

function vermerken(nr, fehler) {
  if (nr !== anfrageNr) return;
  aendern((s) => {
    s.fehler = fehler;
  });
  bescheid();
}

/**
 * Den Stand an Supabase schicken – nur Tage, die mehr haben als zuletzt
 * bestätigt, oder die noch nie bestätigt wurden (auch mit 0: Gleich nach dem
 * Verbinden soll die Widget-App sehen, dass die Verbindung steht).
 * `keepalive` beim Wegschalten: Dann trägt der Browser die Anfrage zu Ende,
 * auch wenn die Seite gleich einfriert. Dieselbe Anfrage zweimal kurz
 * hintereinander (visibilitychange und pagehide kommen oft zusammen) geht nur
 * einmal. Gibt { ok, grund } zurück und wirft nie.
 */
export async function bildschirmzeitSenden({ keepalive = false } = {}) {
  const s = lesen();
  if (!s) return { ok: false, grund: 'nicht verbunden' };
  const jetzt = Date.now();
  if (!keepalive && jetzt - zuletztGesendet < NICHT_OEFTER_MS) return { ok: false, grund: 'gerade erst' };
  const tage = {};
  for (const [t, sek] of Object.entries(s.tage)) {
    const r = Math.min(86400, Math.round(Number(sek) || 0));
    if (!(t in s.gemeldet) || r > (Number(s.gemeldet[t]) || 0)) tage[t] = r;
  }
  if (!Object.keys(tage).length) return { ok: true, grund: 'nichts Neues' };
  const nutzlast = JSON.stringify({ p_kennung: s.kennung, p_app: app, p_tage: tage });
  if (nutzlast === letzteNutzlast && jetzt - zuletztGesendet < NICHT_OEFTER_MS) return { ok: false, grund: 'gerade erst' };
  zuletztGesendet = jetzt;
  letzteNutzlast = nutzlast;
  const nr = ++anfrageNr;

  const abbruch = keepalive || typeof AbortController === 'undefined' ? null : new AbortController();
  const wecker = abbruch ? setTimeout(() => abbruch.abort(), ANTWORT_MS) : 0;
  let res;
  try {
    res = await fetch(`${BZ_SERVER.url}/rest/v1/rpc/bildschirmzeit_melden`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: BZ_SERVER.key },
      body: nutzlast,
      ...(keepalive ? { keepalive: true } : {}),
      ...(abbruch ? { signal: abbruch.signal } : {}),
    });
  } catch {
    if (wecker) clearTimeout(wecker);
    vermerken(nr, 'kein Netz');
    return { ok: false, grund: 'kein Netz' };
  }
  if (wecker) clearTimeout(wecker);
  if (!res.ok) {
    const grund = `Fehler ${res.status}`;
    vermerken(nr, grund);
    return { ok: false, grund };
  }
  let antwort = null;
  try {
    antwort = await res.json();
  } catch {
    // Antwort unlesbar – als gemeldet zählt es dann nicht.
  }
  if (antwort === false) {
    bildschirmzeitTrennen();
    if (meldung) meldung('Bildschirmzeit getrennt: Die Widget-App kennt diese Verbindung nicht mehr.');
    return { ok: false, grund: 'unbekannt' };
  }
  if (antwort !== true) {
    vermerken(nr, 'Antwort unklar');
    return { ok: false, grund: 'Antwort unklar' };
  }
  aendern((st) => {
    for (const [t, r] of Object.entries(tage)) st.gemeldet[t] = Math.max(Number(st.gemeldet[t]) || 0, r);
    st.zuletzt = new Date().toISOString();
    if (nr === anfrageNr) st.fehler = '';
  });
  bescheid();
  return { ok: true, grund: '' };
}

/** Beim Wegschalten: messen, anhalten, mit keepalive schicken. */
export function bildschirmzeitVerstecken() {
  if (!lesen()) return;
  anhalten();
  bildschirmzeitSenden({ keepalive: true });
}

/** Steht ein Link aus der Widget-App in der Adresse? Dann verbinden. */
function linkNehmen() {
  const k = kennungAus(location.hash);
  if (!k) return false;
  try {
    history.replaceState(history.state, '', location.pathname + location.search);
  } catch {
    // dann bleibt der Link eben stehen
  }
  const alt = lesen();
  const heute = tagVon(Date.now());
  if (alt && alt.kennung === k) {
    // Schon so verbunden – heute noch einmal bestätigen lassen.
    aendern((s) => {
      if (!(heute in s.tage)) s.tage[heute] = 0;
      delete s.gemeldet[heute];
    });
  } else {
    anhalten();
    // Was diese App vorher schon gemessen hat, gehört zum selben Tag – aber
    // dem neuen Gerät muss es erst noch gemeldet werden.
    const tage = alt ? alt.tage : {};
    if (!(heute in tage)) tage[heute] = 0;
    schreiben({
      v: 1, kennung: k, seit: new Date().toISOString(), tage, gemeldet: {}, zuletzt: '', fehler: '',
    });
  }
  if (document.visibilityState === 'visible') messen();
  zuletztGesendet = 0;
  letzteNutzlast = '';
  bildschirmzeitSenden();
  bescheid();
  if (meldung) {
    const m = meldung;
    setTimeout(() => m('Bildschirmzeit verbunden: Diese App meldet ab jetzt ihre Minuten an dein Widget.'), 0);
  }
  return true;
}

/**
 * Einmal beim Start aufrufen, bevor die App selbst location.hash liest – die
 * Datei nimmt dann ihren Link heraus und hört auf hashchange, bevor die App es
 * tut. `name` ist einer aus BZ_APPS (etwa 'workout'). `optionen.meldung`
 * (text) zeigt einen kurzen Hinweis an (Toast o. Ä.); sie kommt frühestens im
 * nächsten Takt. `optionen.verstecken: false`, wenn die App
 * bildschirmzeitVerstecken() selbst aus ihrem eigenen visibilitychange-Handler
 * aufrufen will (etwa um Reihenfolge und keepalive-Budget zu steuern).
 *
 * Gibt true zurück, wenn gerade ein Link aus der Widget-App verbunden hat.
 */
export function bildschirmzeitStarten(name, optionen = {}) {
  if (!BZ_APPS.includes(name)) throw new Error(`Bildschirmzeit: unbekannte App ${name}`);
  const erstes = !app;
  app = name;
  meldung = typeof optionen.meldung === 'function' ? optionen.meldung : null;
  if (erstes) {
    window.addEventListener('hashchange', linkNehmen);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        messen();
        bildschirmzeitSenden();
      } else if (optionen.verstecken !== false) {
        bildschirmzeitVerstecken();
      } else {
        anhalten();
      }
    });
    window.addEventListener('pagehide', () => {
      if (optionen.verstecken !== false) bildschirmzeitVerstecken();
      else anhalten();
    });
    window.addEventListener('pageshow', () => {
      if (document.visibilityState === 'visible') messen();
    });
  }
  const verbunden = linkNehmen();
  if (!verbunden && lesen()) {
    if (document.visibilityState === 'visible') messen();
    bildschirmzeitSenden();
  }
  return verbunden;
}

/**
 * Für die Einstellungen: null, wenn nicht verbunden – sonst
 * { seit, heute, gemeldet, zuletzt, fehler } (Sekunden, ISO-Zeiten).
 */
export function bildschirmzeitStand() {
  const s = lesen();
  if (!s) return null;
  if (letzter) messpunkt();
  const t = tagVon(Date.now());
  const frisch = lesen() || s;
  return {
    seit: frisch.seit || '',
    heute: Math.round(Number(frisch.tage[t]) || 0),
    gemeldet: Number(frisch.gemeldet[t]) || 0,
    zuletzt: frisch.zuletzt || '',
    fehler: frisch.fehler || '',
  };
}

/** Trennen: nichts mehr messen, nichts mehr schicken. Die Zahlen bei Supabase bleiben. */
export function bildschirmzeitTrennen() {
  anhalten();
  try {
    localStorage.removeItem(speicherName(app));
  } catch {
    // nichts zu tun
  }
  bescheid();
}
