/*
 * Ein Durchlauf: offene Nachrichten holen, Mitteilungen daraus machen, an
 * alle Geräte des Raums schicken, erledigt melden. Ohne Deno-Besonderheiten,
 * damit tests/test-push-senden.mjs denselben Code in Node laufen lässt – mit
 * eigenem `holen` statt fetch.
 *
 * Den Ausweis (VAPID) holt sie sich aus der Datenbank, siehe vapidHolen.
 *
 * Zugestellt ist, was einmal versucht wurde: Lieber eine Mitteilung
 * verlieren, wenn ein Push-Dienst gerade hakt, als dieselbe nach jedem
 * Anstoß noch einmal brummen zu lassen. Ein Abo, das der Dienst nicht mehr
 * kennt (404, 410), fliegt raus.
 */
import { mitteilungen } from './nachricht.js';
import { senden, b64url, schluesselpaar } from './webpush.js';

/** Wen ein Push-Dienst anschreiben kann, wenn etwas klemmt (RFC 8292, sub). */
export const SUBJECT = 'https://finanzdienste.github.io/Freizeit/';

/** Die Funktionen bei Supabase, die nur der Betreiber-Schlüssel aufrufen darf. */
async function rpc(url, schluessel, name, body, holen) {
  const r = await holen(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: schluessel, Authorization: `Bearer ${schluessel}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${name}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

/**
 * Das VAPID-Schlüsselpaar aus der Datenbank – beim allerersten Lauf erzeugt
 * die Function eins und legt es ab; laufen zwei zugleich, gilt das erste.
 * @returns {{ oeffentlich, privat, subject }}
 */
export async function vapidHolen({ url, schluessel, holen = fetch }) {
  let paar = await rpc(url, schluessel, 'freizeit_push_schluessel', {}, holen);
  if (!paar) {
    const neu = await schluesselpaar();
    paar = await rpc(url, schluessel, 'freizeit_push_schluessel_setzen', { p_oeffentlich: neu.oeffentlich, p_privat: neu.privat }, holen);
  }
  if (!paar || typeof paar.oeffentlich !== 'string' || typeof paar.privat !== 'string') throw new Error('kein VAPID-Schlüsselpaar');
  return { oeffentlich: paar.oeffentlich, privat: paar.privat, subject: SUBJECT };
}

/** Ein Thema je Mitteilung (höchstens 32 Zeichen base64url): Der Push-Dienst ersetzt damit, was das Gerät noch nicht abgeholt hat. */
async function thema(tag) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(tag));
  return b64url.zu(h).slice(0, 32);
}

/**
 * @param {object} o
 * @param {string} o.url         Supabase-URL des Projekts
 * @param {string} o.schluessel  service_role
 * @param {object} [o.vapid]     { oeffentlich, privat, subject } – sonst aus der Datenbank
 * @param {Function} [o.holen]   fetch
 * @returns {{ nachrichten, mitteilungen, gesendet, fehler, tot }}
 */
export async function lauf({ url, schluessel, vapid = null, holen = fetch }) {
  const liste = await rpc(url, schluessel, 'freizeit_push_offen', {}, holen);
  if (!liste.length) return { nachrichten: 0, mitteilungen: 0, gesendet: 0, fehler: [], tot: 0 };
  if (!vapid) vapid = await vapidHolen({ url, schluessel, holen });
  const alle = mitteilungen(liste);
  const tot = new Set();
  let gesendet = 0;
  const fehler = [];
  for (const m of alle) {
    const text = JSON.stringify({ titel: m.titel, text: m.text, tag: m.tag, url: m.url });
    const topic = await thema(m.tag);
    for (const abo of m.abos) {
      if (!abo || typeof abo.endpoint !== 'string' || tot.has(abo.endpoint)) continue;
      try {
        const status = await senden(abo, text, vapid, { topic, holen });
        if (status === 201 || status === 200) gesendet++;
        else if (status === 404 || status === 410) tot.add(abo.endpoint);
        else fehler.push(`${status} ${new URL(abo.endpoint).host}`);
      } catch (e) {
        fehler.push(String(e && e.message ? e.message : e).slice(0, 120));
      }
    }
  }
  const ids = liste.map((n) => n.id).filter((id) => Number.isInteger(id));
  if (ids.length || tot.size) {
    await rpc(url, schluessel, 'freizeit_push_fertig', { p_ids: ids, p_tot: [...tot] }, holen);
  }
  return { nachrichten: liste.length, mitteilungen: alle.length, gesendet, fehler, tot: tot.size };
}
