/*
 * Web Push ohne Bibliothek: eine Nachricht verschlüsseln (RFC 8291,
 * aes128gcm) und sich beim Push-Dienst ausweisen (RFC 8292, VAPID) – nur mit
 * WebCrypto, deshalb läuft dieselbe Datei in Deno (Edge Function) und in Node
 * (tests/test-push-senden.mjs entschlüsselt damit auch wieder).
 *
 * Ein Abo, wie der Browser es gibt:
 *   { endpoint: 'https://…', keys: { p256dh: '…', auth: '…' } }
 * p256dh ist der öffentliche Schlüssel des Geräts (65 Byte, base64url), auth
 * sein Geheimnis (16 Byte). Der Push-Dienst sieht nur den Schlüsselsalat.
 */
const enc = new TextEncoder();

/** base64url, wie Browser und Push-Dienste es erwarten – ohne Gleichheitszeichen. */
export const b64url = {
  zu(bytes) {
    let s = '';
    for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  von(text) {
    const t = String(text).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(t + '='.repeat((4 - (t.length % 4)) % 4)), (c) => c.charCodeAt(0));
  },
};

const zusammen = (...teile) => {
  const r = new Uint8Array(teile.reduce((n, t) => n + t.length, 0));
  let i = 0;
  for (const t of teile) { r.set(t, i); i += t.length; }
  return r;
};

/** HKDF-SHA-256 in einem Zug (Extract und Expand). */
export async function hkdf(salt, ikm, info, laenge) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, laenge * 8));
}

/**
 * Ein VAPID-Schlüsselpaar, wie es die Edge Function braucht: öffentlich die
 * 65 Byte des Punkts, privat die 32 Byte des Skalars, beides base64url. Es
 * liegt in der Datenbank (lauf.js, vapidHolen); den öffentlichen Teil gibt die
 * Function an die App heraus (js/push.js).
 */
export async function schluesselpaar() {
  const paar = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', paar.privateKey);
  return { oeffentlich: b64url.zu(await crypto.subtle.exportKey('raw', paar.publicKey)), privat: jwk.d };
}

/** Der Authorization-Kopf für einen Endpunkt: ein signiertes Token, zwölf Stunden gültig. */
export async function vapidKopf(endpoint, { oeffentlich, privat, subject }, jetzt = Date.now()) {
  const pub = b64url.von(oeffentlich);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error('VAPID: öffentlicher Schlüssel muss 65 Byte haben');
  const jwk = { kty: 'EC', crv: 'P-256', x: b64url.zu(pub.slice(1, 33)), y: b64url.zu(pub.slice(33, 65)), d: privat };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const kopf = b64url.zu(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const inhalt = b64url.zu(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin, exp: Math.floor(jetzt / 1000) + 12 * 3600, sub: subject,
  })));
  const unterschrift = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${kopf}.${inhalt}`));
  return `vapid t=${kopf}.${inhalt}.${b64url.zu(unterschrift)}, k=${oeffentlich}`;
}

/**
 * Den Text für ein Abo verschlüsseln. Zurück kommt der ganze Körper der
 * Anfrage: Kopf (Salz, Satzlänge, unser öffentlicher Schlüssel) und der
 * eine verschlüsselte Satz – der Text muss unter 4 KB bleiben.
 */
export async function verschluesseln(abo, text) {
  const uaPub = b64url.von(abo.keys.p256dh);
  const auth = b64url.von(abo.keys.auth);
  if (uaPub.length !== 65 || auth.length !== 16) throw new Error('Abo: p256dh muss 65, auth 16 Byte haben');
  const klartext = zusammen(enc.encode(text), new Uint8Array([2]));
  if (klartext.length > 4096 - 16) throw new Error('Nachricht zu lang');
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const geteilt = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(auth, geteilt, zusammen(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salz = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salz, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salz, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, klartext));
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return zusammen(salz, rs, new Uint8Array([asPub.length]), asPub, chiffre);
}

/**
 * Die Gegenseite, wie sie im Browser steckt – für den Test: mit dem privaten
 * Schlüssel des Geräts den Körper wieder zu Text machen.
 */
export async function entschluesseln(koerper, { privat, oeffentlich, auth }) {
  const salz = koerper.slice(0, 16);
  const rs = new DataView(koerper.buffer, koerper.byteOffset + 16, 4).getUint32(0);
  const idlen = koerper[20];
  const asPub = koerper.slice(21, 21 + idlen);
  const chiffre = koerper.slice(21 + idlen);
  const asKey = await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const geteilt = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, privat, 256));
  const ikm = await hkdf(auth, geteilt, zusammen(enc.encode('WebPush: info\0'), oeffentlich, asPub), 32);
  const cek = await hkdf(salz, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salz, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const klartext = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aes, chiffre));
  const ende = klartext.lastIndexOf(2);
  return { text: new TextDecoder().decode(klartext.slice(0, ende)), rs, idlen, rest: klartext.slice(ende + 1) };
}

/**
 * Eine Nachricht an ein Abo schicken. Zurück kommt der Status des
 * Push-Dienstes: 201 (oder 200) ist angekommen, 404 und 410 heißen, das Abo
 * gibt es nicht mehr. `fetch` lässt sich für Tests austauschen.
 */
export async function senden(abo, text, vapid, { ttl = 24 * 3600, topic = '', holen = fetch } = {}) {
  const koerper = await verschluesseln(abo, text);
  const headers = {
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: String(ttl),
    Urgency: 'normal',
    Authorization: await vapidKopf(abo.endpoint, vapid),
  };
  if (topic) headers.Topic = topic;
  const r = await holen(abo.endpoint, { method: 'POST', headers, body: koerper });
  return r.status;
}
