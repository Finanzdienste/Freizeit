/*
 * Die Edge Function freizeit-push (supabase/functions/freizeit-push), in Node
 * statt Deno: dieselben Dateien, nur fetch ist nachgebaut.
 *
 * Verschlüsselung und Ausweis prüft der Test von der Gegenseite her: ein
 * nachgebautes Gerät mit eigenem Schlüsselpaar entschlüsselt, was die
 * Function schickt (RFC 8291), und der Push-Dienst prüft die Unterschrift
 * unter dem VAPID-Token mit dem öffentlichen Schlüssel (RFC 8292). Dann die
 * Texte, und ein ganzer Durchlauf gegen einen nachgebauten Supabase.
 */
import { b64url, schluesselpaar, vapidKopf, verschluesseln, entschluesseln, senden } from '../supabase/functions/freizeit-push/webpush.js';
import { wann, einzeln, mitteilungen } from '../supabase/functions/freizeit-push/nachricht.js';
import { lauf, vapidHolen, SUBJECT } from '../supabase/functions/freizeit-push/lauf.js';

let oks = 0;
let fails = 0;
const check = (c, m) => {
  console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`);
  if (c) oks++; else fails++;
};
const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const enc = new TextEncoder();

/** Ein Gerät, wie der Browser es anlegt: ECDH-Paar und 16 Byte auth. */
async function geraet(nr) {
  const paar = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const oeffentlich = new Uint8Array(await crypto.subtle.exportKey('raw', paar.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return {
    privat: paar.privateKey, oeffentlich, auth,
    abo: { endpoint: `https://push.example.org/send/${nr}`, keys: { p256dh: b64url.zu(oeffentlich), auth: b64url.zu(auth) } },
  };
}

// ---------------------------------------------------------------- Schlüssel
const vapid = { ...(await schluesselpaar()), subject: 'mailto:test@example.org' };
check(b64url.von(vapid.oeffentlich).length === 65 && b64url.von(vapid.privat).length === 32 && !/[+/=]/.test(vapid.oeffentlich + vapid.privat),
  'schluesselpaar: 65 Byte öffentlich, 32 Byte privat, base64url ohne +, / und =');
check(gleich([...b64url.von(b64url.zu(new Uint8Array([0, 255, 62, 63, 1])))], [0, 255, 62, 63, 1]) && b64url.zu(new Uint8Array([251, 255])) === '-_8',
  'b64url: hin und zurück, mit - und _ statt + und /');

// -------------------------------------------------------------------- VAPID
const g1 = await geraet(1);
const kopf = await vapidKopf(g1.abo.endpoint, vapid, Date.parse('2026-11-02T07:00:00Z'));
const [, token, k] = kopf.match(/^vapid t=([^,]+), k=(\S+)$/) || [];
check(Boolean(token) && k === vapid.oeffentlich, 'Authorization: vapid t=<Token>, k=<öffentlicher Schlüssel>');
const [h, c, sig] = token.split('.');
const kopfJson = JSON.parse(new TextDecoder().decode(b64url.von(h)));
const inhalt = JSON.parse(new TextDecoder().decode(b64url.von(c)));
check(gleich(kopfJson, { typ: 'JWT', alg: 'ES256' }) && inhalt.aud === 'https://push.example.org' && inhalt.sub === vapid.subject
  && inhalt.exp === Math.floor(Date.parse('2026-11-02T07:00:00Z') / 1000) + 12 * 3600,
  'Token: ES256, aud ist der Ursprung des Endpunkts, sub der Betreiber, exp zwölf Stunden später');
const pub = b64url.von(vapid.oeffentlich);
const pruefKey = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: b64url.zu(pub.slice(1, 33)), y: b64url.zu(pub.slice(33)) },
  { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
check(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pruefKey, b64url.von(sig), enc.encode(`${h}.${c}`)) && b64url.von(sig).length === 64,
  'die Unterschrift (64 Byte, r‖s) stimmt zum öffentlichen Schlüssel');
check(!(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pruefKey, b64url.von(sig), enc.encode(`${h}.${c}x`))), '… und zu nichts anderem');
let kaputt = null;
try { await vapidKopf(g1.abo.endpoint, { ...vapid, oeffentlich: b64url.zu(new Uint8Array(64)) }); } catch (e) { kaputt = e.message; }
check(kaputt === 'VAPID: öffentlicher Schlüssel muss 65 Byte haben', 'ein falscher öffentlicher Schlüssel fliegt auf');

// --------------------------------------------------------- Verschlüsselung
const TEXT = JSON.stringify({ titel: 'Kim hat Bock – mit dir', text: 'Theater früh · Di 3.11., 19:00 Uhr', tag: 'freizeit:x:Kim', url: './#wir' });
const koerper = await verschluesseln(g1.abo, TEXT);
const auf = await entschluesseln(koerper, g1);
check(auf.text === TEXT && auf.rs === 4096 && auf.idlen === 65 && auf.rest.length === 0,
  'das Gerät entschlüsselt den Text wieder: Satzlänge 4096, 65 Byte Schlüssel, Trennzeichen 2 am Ende');
check(koerper.length === 16 + 4 + 1 + 65 + enc.encode(TEXT).length + 1 + 16, 'der Körper: Salz, Satzlänge, Schlüssel, Text + 1, 16 Byte Siegel');
const zweimal = await verschluesseln(g1.abo, TEXT);
check(!gleich([...zweimal.slice(0, 16)], [...koerper.slice(0, 16)]) && !gleich([...zweimal.slice(21, 86)], [...koerper.slice(21, 86)]),
  'jedes Mal frisches Salz und ein frisches Schlüsselpaar');
const g2 = await geraet(2);
let fremd = null;
try { await entschluesseln(koerper, g2); } catch (e) { fremd = e.name || 'Fehler'; }
check(fremd !== null, 'ein anderes Gerät kann es nicht lesen');
let zuLang = null;
try { await verschluesseln(g1.abo, 'x'.repeat(4080)); } catch (e) { zuLang = e.message; }
check(zuLang === 'Nachricht zu lang' && (await entschluesseln(await verschluesseln(g1.abo, 'ä€😀'), g1)).text === 'ä€😀', 'zu lang fliegt auf; Umlaute und Emoji kommen durch');
let kaputtesAbo = null;
try { await verschluesseln({ ...g1.abo, keys: { ...g1.abo.keys, auth: b64url.zu(new Uint8Array(12)) } }, TEXT); } catch (e) { kaputtesAbo = e.message; }
check(kaputtesAbo === 'Abo: p256dh muss 65, auth 16 Byte haben', 'ein kaputtes Abo fliegt auf, bevor etwas rausgeht');

// ------------------------------------------------------------------ senden
const anfragen = [];
const holen = async (url, init) => {
  anfragen.push({ url, init });
  const nr = url.split('/').pop();
  return { status: { 1: 201, 2: 410, 3: 500 }[nr] || 201, ok: true, text: async () => '', json: async () => null };
};
check(await senden(g1.abo, TEXT, vapid, { holen, topic: 'thema-1' }) === 201, 'senden: der Status des Push-Dienstes kommt zurück');
const a = anfragen[0];
check(a.url === g1.abo.endpoint && a.init.method === 'POST' && a.init.headers['Content-Encoding'] === 'aes128gcm'
  && a.init.headers['Content-Type'] === 'application/octet-stream' && a.init.headers.TTL === '86400' && a.init.headers.Urgency === 'normal'
  && a.init.headers.Topic === 'thema-1' && a.init.headers.Authorization.startsWith('vapid t=') && a.init.body instanceof Uint8Array,
  'POST an den Endpunkt mit aes128gcm, TTL ein Tag, Urgency normal, Topic und VAPID');
check((await entschluesseln(a.init.body, g1)).text === TEXT, 'der Körper ist der verschlüsselte Text');

// ------------------------------------------------------------------- Texte
const KINO = { titel: 'Kino lang', datum: '2026-11-04', zeit: '19:00', ort: 'Savoy' };
check(wann(KINO) === 'Mi 4.11., 19:00 Uhr' && wann({ datum: '2026-11-07' }) === 'Sa 7.11.' && wann({ zeit: 'abends' }) === '' && wann({ datum: '2026-11-07', zeit: 'Sa 10–18' }) === 'Sa 7.11., Sa 10–18' && wann(null) === '',
  'wann: Wochentag und Datum, Uhrzeit mit „Uhr“, sonst der Text; ohne Datum nichts');
check(gleich(einzeln({ art: 'neu', name: 'Kim' }), { titel: 'Kim ist dabei', text: 'Kim hat sich in deinen Plan eingetragen.' })
  && gleich(einzeln({ art: 'weg', name: 'Kim' }), { titel: 'Kim hat den Plan verlassen', text: 'Die Haken von Kim sind damit weg.' }),
  'neu und weg');
check(gleich(einzeln({ art: 'bock', name: 'Kim', daten: { ...KINO, mitwem: 'gastgeber' } }), { titel: 'Kim hat Bock – mit dir', text: 'Kino lang · Mi 4.11., 19:00 Uhr' })
  && gleich(einzeln({ art: 'bock', name: 'Kim', daten: { ...KINO, mitwem: 'andere' } }), { titel: 'Kim hat Bock – ohne dich', text: 'Kino lang · Mi 4.11., 19:00 Uhr' })
  && gleich(einzeln({ art: 'bock', name: 'Kim', daten: { titel: 'Sauna' } }), { titel: 'Kim hat Bock', text: 'Sauna' })
  && gleich(einzeln({ art: 'aus', name: 'Jo', daten: { ...KINO, mitwem: 'gastgeber' } }), { titel: 'Jo ist doch nicht dabei', text: 'Kino lang · Mi 4.11., 19:00 Uhr' }),
  'bock mit dir / ohne dich / ohne Angabe, aus');
check(gleich(einzeln({ art: 'bock', name: '', daten: null }), { titel: 'Jemand hat Bock', text: 'einen Eintrag' }) && einzeln({ art: '?', name: 'X' }).titel === 'X: Neuigkeit',
  'ohne Namen und ohne daten geht es trotzdem');
const ABOS = [g1.abo, g2.abo];
const liste = [
  { id: 1, raum: 'r1', art: 'neu', name: 'Kim', daten: null, abos: ABOS },
  { id: 2, raum: 'r1', art: 'bock', name: 'Jo', daten: { ...KINO, mitwem: 'gastgeber' }, abos: ABOS },
  { id: 3, raum: 'r1', art: 'bock', name: 'Jo', daten: { titel: 'Party', datum: '2026-11-07', zeit: '23:00', mitwem: 'gastgeber' }, abos: ABOS },
  { id: 4, raum: 'r2', art: 'bock', name: 'Kim', daten: { titel: 'Lesung', mitwem: 'andere' }, abos: [] },
  { id: 5, raum: 'r1', art: 'weg', name: 'Kim', daten: null, abos: ABOS },
];
const m = mitteilungen(liste);
check(m.length === 3 && gleich(m.map((x) => x.ids), [[1, 5], [2, 3], [4]]) && m.every((x) => x.url === './#wir'),
  'mitteilungen: je Raum und Name eine, in der Reihenfolge des ersten Auftretens, mit den ids');
check(gleich([m[0].titel, m[0].text], ['Kim: 2 Neuigkeiten', 'ist dabei\nhat den Plan verlassen']) && m[0].tag === 'freizeit:r1:Kim' && m[0].abos === ABOS,
  'Kim kommt und geht: zwei Zeilen unter einer Überschrift, Tag aus Raum und Name');
check(gleich([m[1].titel, m[1].text], ['Jo hat Bock auf 2 Sachen – mit dir', 'Bock: Kino lang · Mi 4.11., 19:00 Uhr (mit dir)\nBock: Party · Sa 7.11., 23:00 Uhr (mit dir)']),
  'zwei Haken „mit dir“ hintereinander: eine Mitteilung');
check(gleich([m[2].titel, m[2].text, m[2].abos], ['Kim hat Bock – ohne dich', 'Lesung', []]), 'eine einzelne Nachricht bekommt ihren eigenen Text');
const viele = mitteilungen(Array.from({ length: 7 }, (_, i) => ({ id: i, raum: 'r', art: 'bock', name: 'Jo', daten: { titel: `T${i}`, mitwem: i % 2 ? 'andere' : 'gastgeber' }, abos: [] })));
check(viele.length === 1 && viele[0].titel === 'Jo: 7 Neuigkeiten' && viele[0].text.split('\n').length === 5 && viele[0].text.endsWith('… und 3 weitere'),
  'sieben gemischte: Überschrift mit Zahl, vier Zeilen und „… und 3 weitere“');
check(gleich(mitteilungen(null), []) && gleich(mitteilungen([null, 'x']), []), 'Müll ergibt nichts');

// --------------------------------------------------------------- Durchlauf
const g3 = await geraet(3);
const offen = [
  { id: 11, raum: 'r1', art: 'neu', name: 'Kim', daten: null, abos: [g1.abo, g2.abo, g3.abo] },
  { id: 12, raum: 'r1', art: 'bock', name: 'Kim', daten: { ...KINO, mitwem: 'gastgeber' }, abos: [g1.abo, g2.abo, g3.abo] },
  { id: 13, raum: 'r1', art: 'bock', name: 'Jo', daten: { ...KINO, mitwem: 'andere' }, abos: [g1.abo, g2.abo, g3.abo] },
];
const supabase = [];
anfragen.length = 0;
// PostgREST, nachgebaut: jsonb kommt als Text, eine Funktion ohne Rückgabe als 204 mit leerem Körper –
// json() würde dann werfen, wie in Deno.
const postgrest = (wert) => (wert === undefined
  ? { ok: true, status: 204, text: async () => '', json: async () => { throw new SyntaxError('Unexpected end of JSON input'); } }
  : { ok: true, status: 200, text: async () => JSON.stringify(wert), json: async () => wert });
const holen2 = async (url, init) => {
  if (url.startsWith('https://db.example.org/rest/v1/rpc/')) {
    supabase.push({ name: url.split('/').pop(), init });
    return postgrest(url.endsWith('freizeit_push_offen') ? offen : undefined);
  }
  return holen(url, init);
};
const ergebnis = await lauf({ url: 'https://db.example.org', schluessel: 'dienst', vapid, holen: holen2 });
check(gleich(ergebnis, { nachrichten: 3, mitteilungen: 2, gesendet: 2, fehler: ['500 push.example.org', '500 push.example.org'], tot: 1,
  versuche: ['push.example.org 201', 'push.example.org 410', 'push.example.org 500', 'push.example.org 201', 'push.example.org 500'] }),
  `lauf: drei Nachrichten, zwei Mitteilungen, an Gerät 1 zweimal zugestellt, Gerät 2 tot, Gerät 3 kaputt – und jeder Versuch im Protokoll (${JSON.stringify(ergebnis)})`);
check(supabase[0].name === 'freizeit_push_offen' && supabase[0].init.headers.apikey === 'dienst' && supabase[0].init.headers.Authorization === 'Bearer dienst'
  && supabase[0].init.body === '{}' && supabase[0].init.method === 'POST',
  'erst freizeit_push_offen, mit dem Betreiber-Schlüssel als apikey und Bearer');
check(supabase.length === 2 && supabase[1].name === 'freizeit_push_fertig' && gleich(JSON.parse(supabase[1].init.body), { p_ids: [11, 12, 13], p_tot: [g2.abo.endpoint] }),
  'dann freizeit_push_fertig mit allen drei ids und dem toten Endpunkt');
const an1 = anfragen.filter((x) => x.url === g1.abo.endpoint);
check(an1.length === 2 && anfragen.filter((x) => x.url === g2.abo.endpoint).length === 1 && anfragen.filter((x) => x.url === g3.abo.endpoint).length === 2,
  'Gerät 1 und 3 bekommen beide Mitteilungen, das tote Gerät 2 nach der ersten nichts mehr');
const texte = [];
for (const x of an1) texte.push(JSON.parse((await entschluesseln(x.init.body, g1)).text));
check(gleich(texte.map((t) => t.titel), ['Kim: 2 Neuigkeiten', 'Jo hat Bock – ohne dich']) && texte.every((t) => t.url === './#wir' && t.tag.startsWith('freizeit:r1:')),
  'entschlüsselt: die beiden Mitteilungen als JSON mit titel, text, tag und url');
check(an1[0].init.headers.Topic !== an1[1].init.headers.Topic && /^[A-Za-z0-9_-]{32}$/.test(an1[0].init.headers.Topic), 'je Mitteilung ein eigenes Topic, 32 Zeichen base64url');
const leer = await lauf({ url: 'https://db.example.org', schluessel: 'dienst', holen: async (url, init) => (url.endsWith('freizeit_push_offen') ? postgrest([]) : (supabase.push({ name: 'falsch', init }), postgrest(null))) });
check(gleich(leer, { nachrichten: 0, mitteilungen: 0, gesendet: 0, fehler: [], tot: 0, versuche: [] }) && supabase.length === 2, 'nichts offen: nichts geschickt, kein fertig, kein Schlüssel geholt');

// --------------------------------------------------- Schlüssel aus der Datenbank
let abgelegt = null;
const db = async (url, init) => {
  if (!url.includes('/rest/v1/rpc/')) return holen(url, init);
  const name = url.split('/').pop();
  supabase.push({ name, init });
  if (name === 'freizeit_push_schluessel') return postgrest(abgelegt);
  if (name === 'freizeit_push_schluessel_setzen') {
    const b = JSON.parse(init.body);
    if (!abgelegt) abgelegt = { oeffentlich: b.p_oeffentlich, privat: b.p_privat };
    return postgrest(abgelegt);
  }
  if (name === 'freizeit_push_offen') return postgrest([offen[0]]);
  if (name === 'freizeit_push_fertig') return postgrest(undefined);
  return holen(url, init);
};
supabase.length = 0;
const v1 = await vapidHolen({ url: 'https://db.example.org', schluessel: 'dienst', holen: db });
check(/^[A-Za-z0-9_-]{87}$/.test(v1.oeffentlich) && /^[A-Za-z0-9_-]{43}$/.test(v1.privat) && v1.subject === SUBJECT
  && gleich(supabase.map((x) => x.name), ['freizeit_push_schluessel', 'freizeit_push_schluessel_setzen']) && gleich(abgelegt, { oeffentlich: v1.oeffentlich, privat: v1.privat }),
  'vapidHolen ohne Paar in der Datenbank: eins erzeugen (87 und 43 Zeichen) und ablegen, Subject ist die App');
supabase.length = 0;
const v2 = await vapidHolen({ url: 'https://db.example.org', schluessel: 'dienst', holen: db });
check(gleich(v2, v1) && gleich(supabase.map((x) => x.name), ['freizeit_push_schluessel']), 'beim nächsten Mal kommt dasselbe Paar, ohne neues abzulegen');
supabase.length = 0;
anfragen.length = 0;
const mitDb = await lauf({ url: 'https://db.example.org', schluessel: 'dienst', holen: db });
const ausweis = anfragen[0].init.headers.Authorization.match(/k=(\S+)$/)[1];
check(mitDb.gesendet === 1 && ausweis === v1.oeffentlich && gleich(supabase.map((x) => x.name), ['freizeit_push_offen', 'freizeit_push_schluessel', 'freizeit_push_fertig']),
  'lauf ohne vapid: holt das Paar aus der Datenbank und weist sich damit aus');
let ohnePaar = null;
try { await vapidHolen({ url: 'https://db.example.org', schluessel: 'dienst', holen: async () => postgrest({ oeffentlich: 'x' }) }); } catch (e) { ohnePaar = e.message; }
check(ohnePaar === 'kein VAPID-Schlüsselpaar', 'kommt kein brauchbares Paar zurück, bricht es ab');
let kaputterServer = null;
try { await lauf({ url: 'https://db.example.org', schluessel: 'dienst', vapid, holen: async () => ({ ok: false, status: 401, text: async () => 'Invalid API key', json: async () => null }) }); } catch (e) { kaputterServer = e.message; }
check(kaputterServer === 'freizeit_push_offen: 401 Invalid API key', 'antwortet Supabase mit Fehler, bricht der Lauf mit Status und Text ab');

console.log(fails ? `FEHLER: ${oks} von ${oks + fails} Prüfungen bestanden.` : `Alles gut: ${oks} von ${oks} Prüfungen bestanden.`);
process.exit(fails || !oks ? 1 : 0);
