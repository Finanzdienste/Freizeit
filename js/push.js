/*
 * Push-Mitteilungen für den Gastgeber: „Kim ist dabei“, „Kim hat Bock – mit
 * dir“ – auch, wenn die App zu ist.
 *
 * Das Gerät holt sich beim Push-Dienst seines Browsers ein Abo (Adresse plus
 * zwei Schlüssel) und legt es über freizeit_push beim Server ab. Die Edge
 * Function freizeit-push (supabase/functions) schickt dann verschlüsselt, was
 * die Datenbank sammelt (supabase/gemeinsam.sql, PUSH); sw.js zeigt es an.
 *
 * Was hier gespeichert ist (speicher.js, push): für welchen Plan dieses Gerät
 * angemeldet ist. Ob das Abo noch gilt, weiß nur der Browser – beim
 * Einschalten wird es deshalb immer frisch beim Server abgelegt. Den
 * öffentlichen Schlüssel dafür gibt die Edge Function selbst heraus (GET).
 */
import { aktuell, speichern } from './speicher.js';
import { pushMelden } from './gemeinsam.js';
import { istApple } from './teilen.js';
import { SERVER } from './config.js';

/** Die Edge Function – GET gibt ihren öffentlichen Schlüssel: { oeffentlich }. */
export const FUNKTION = `${SERVER.url}/functions/v1/freizeit-push`;

/** Der öffentliche VAPID-Schlüssel der Edge Function; das Gegenstück kennt nur sie. */
async function oeffentlicherSchluessel() {
  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), 10000);
  try {
    const r = await fetch(FUNKTION, { signal: abbruch.signal });
    const j = r.ok ? await r.json() : null;
    if (!j || !/^[A-Za-z0-9_-]{87}$/.test(j.oeffentlich || '')) throw new Error('Der Server gibt keinen Schlüssel für Mitteilungen – die Edge Function freizeit-push fehlt noch.');
    return j.oeffentlich;
  } finally {
    clearTimeout(uhr);
  }
}

const alsApp = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

const bytes = (b64url) => {
  const t = b64url.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(t + '='.repeat((4 - (t.length % 4)) % 4)), (c) => c.charCodeAt(0));
};

/**
 * Was dem Push hier im Weg steht: { grund, text } mit grund '' (nichts),
 * 'iphone' (im Browser statt vom Home-Bildschirm), 'browser' (kann es
 * nicht) oder 'blockiert' (Erlaubnis verweigert).
 */
export function pushHindernis() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    if (istApple() && !alsApp()) {
      return { grund: 'iphone', text: 'Auf dem iPhone geht das erst, wenn die App auf dem Home-Bildschirm liegt (Teilen → „Zum Home-Bildschirm“).' };
    }
    return { grund: 'browser', text: 'Dieser Browser kann keine Mitteilungen.' };
  }
  if (Notification.permission === 'denied') {
    return { grund: 'blockiert', text: 'Mitteilungen sind für diese Seite im Browser blockiert – in den Seiteneinstellungen wieder erlauben.' };
  }
  return { grund: '', text: '' };
}

/** Ist dieses Gerät für den laufenden Plan angemeldet? */
export function pushAn() {
  const st = aktuell();
  return Boolean(st.gemeinsam && st.push && st.push.code === st.gemeinsam.code);
}

const gleicherSchluessel = (abo, oeffentlich) => {
  const k = abo.options && abo.options.applicationServerKey;
  if (!k) return true;
  const a = new Uint8Array(k);
  const b = bytes(oeffentlich);
  return a.length === b.length && a.every((x, i) => x === b[i]);
};

/** Anschalten: Erlaubnis holen, Abo holen, beim Server ablegen. Wirft mit einem Satz, wenn es nicht geht. */
export async function pushEinschalten() {
  const hindernis = pushHindernis();
  if (hindernis.grund) throw new Error(hindernis.text);
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Ohne Erlaubnis keine Mitteilungen.');
  const oeffentlich = await oeffentlicherSchluessel();
  const reg = await navigator.serviceWorker.ready;
  let abo = await reg.pushManager.getSubscription();
  if (abo && !gleicherSchluessel(abo, oeffentlich)) {
    await abo.unsubscribe();
    abo = null;
  }
  if (!abo) abo = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(oeffentlich) });
  const j = abo.toJSON();
  await pushMelden({ endpoint: j.endpoint, keys: j.keys }, true);
  const st = aktuell();
  st.push = { code: st.gemeinsam.code, endpunkt: j.endpoint };
  speichern();
}

/** Ausschalten: beim Server abmelden (wenn er erreichbar ist) und das Abo aufgeben. */
export async function pushAusschalten() {
  const st = aktuell();
  let abo = null;
  try {
    const reg = await navigator.serviceWorker.ready;
    abo = await reg.pushManager.getSubscription();
  } catch { /* kein Service Worker – dann gibt es auch kein Abo */ }
  if (abo) {
    const j = abo.toJSON();
    try {
      if (st.gemeinsam) await pushMelden({ endpoint: j.endpoint, keys: j.keys }, false);
    } catch { /* der Server räumt tote Abos selbst weg */ }
    await abo.unsubscribe();
  }
  st.push = null;
  speichern();
}
