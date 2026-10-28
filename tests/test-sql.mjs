/*
 * Freizeit: Tut supabase/gemeinsam.sql, was die App von ihm erwartet?
 *
 *     node tests/test-sql.mjs
 *
 * Ohne Supabase und ohne Netz: PGlite ist ein echtes Postgres, als
 * WebAssembly im selben Prozess. Damit der Test etwas beweist, bekommt es
 * vorher, was Supabase mitbringt – die Rollen anon, authenticated und
 * service_role und die Voreinstellung, dass jede neue Tabelle und Funktion im
 * Schema public gleich alle Rechte für sie hat. Ohne die bewiese das Wegnehmen
 * der Rechte in der Datei nichts.
 *
 * Zuerst läuft die erste Fassung (tests/alt/gemeinsam-v2.sql, jeder sah
 * alles) und bekommt einen Raum mit Häkchen – so steht es bei Supabase, wenn
 * der Betreiber den neuen Block einspielt. Dann die Datei, wie im SQL Editor
 * als ein Block, und zwar als Rolle „besitzer“: ohne Superuser-Rechte, wie
 * dort die Rolle postgres. Danach ruft der Test die Funktionen als anon auf,
 * so wie die App mit dem öffentlichen Schlüssel, und wie PostgREST mit Namen
 * – was fehlt, lässt er weg. In die Tabellen greift er nur als Superuser: um
 * eine Grenze schnell zu erreichen, ein Häkchen altern zu lassen oder
 * nachzusehen, was wirklich gespeichert ist.
 *
 * `notify pgrst` am Ende der Datei läuft in PGlite einfach mit (es hört nur
 * niemand zu), weggelassen wird deshalb nichts. PGlite hat genau eine
 * Verbindung: `set role` und `reset role` um jeden Aufruf genügen, solange
 * alles streng nacheinander läuft – hier also kein Promise.all.
 */
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual as gleich } from 'node:util';
import { PGlite } from '@electric-sql/pglite';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const DATEI = path.resolve(HIER, '..', 'supabase', 'gemeinsam.sql');
const ALT = path.resolve(HIER, 'alt', 'gemeinsam-v2.sql');

let fails = 0;
let oks = 0;
const check = (c, m) => {
  console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`);
  if (c) oks++; else fails++;
};

// Die fünf Funktionen, wie die App sie aufruft. Die Namen der Parameter
// zählen mit: PostgREST ruft mit Namen auf und lässt weg, was einen
// Vorgabewert hat.
const SIGNATUR = {
  freizeit_ich: 'p_code text, p_person text, p_name text, p_schluessel text DEFAULT NULL::text',
  freizeit_lesen: 'p_code text, p_person text DEFAULT NULL::text, p_schluessel text DEFAULT NULL::text',
  freizeit_bock: 'p_code text, p_person text, p_eintrag text, p_bock boolean, p_daten jsonb, p_schluessel text DEFAULT NULL::text',
  freizeit_weg: 'p_code text, p_person text, p_schluessel text DEFAULT NULL::text, p_wer text DEFAULT NULL::text',
  freizeit_push: 'p_code text, p_person text, p_schluessel text, p_abo jsonb, p_an boolean',
};
const FUENF = Object.keys(SIGNATUR).sort();
// Die zwei für die Edge Function – nur mit dem Schlüssel des Betreibers (service_role).
const DIENST = {
  freizeit_push_offen: '', freizeit_push_fertig: 'p_ids bigint[], p_tot text[]',
  freizeit_push_schluessel: '', freizeit_push_schluessel_setzen: 'p_oeffentlich text, p_privat text',
};
const HELFER = ['freizeit_raum', 'freizeit_kennung', 'freizeit_hash', 'freizeit_gastgeber_von', 'freizeit_rolle', 'freizeit_stand', 'freizeit_melden'];
const AUSLOESER = 'freizeit_push_anstossen';
const TABELLEN = ['freizeit_person', 'freizeit_bock', 'freizeit_gastgeber', 'freizeit_push', 'freizeit_nachricht', 'freizeit_einstellung'];
const TYP = {
  p_code: 'text', p_person: 'text', p_name: 'text', p_eintrag: 'text', p_bock: 'boolean', p_daten: 'jsonb', p_schluessel: 'text', p_wer: 'text',
  p_abo: 'jsonb', p_an: 'boolean', p_ids: 'bigint[]', p_tot: 'text[]', p_oeffentlich: 'text', p_privat: 'text',
};

const A = 'abcd-efgh-jkmn';
const B = 'wxyz-2345-6789';
const C = 'pqrs-tuvw-xyz2';
const L = 'lege-alte-zeit'; // der Raum aus der ersten Fassung
const TOBI = 'tobi-0001-aaaa';
const KIM = 'kim-0002-bbbb';
const JO = 'jo-0003-cccc';
const NIEMAND = 'nie-da-0000';
const SCHLUESSEL = 'tobischluessel0000000001';
const ANDERER = 'irgendwerschluessel00002';
const LEER = { rolle: 'gast', personen: [], bock: [] };
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
/** Was in der Spalte raum stehen muss: SHA-256 über "freizeit:" + Code, klein, als Hex. */
const raumVon = (code) => sha(`freizeit:${code.toLowerCase()}`);
/** Was in freizeit_gastgeber.schluessel stehen muss. */
const hashVon = (schluessel) => sha(`freizeit-gast:${schluessel}`);
/** Ein Push-Abo, wie der Browser es gibt – Endpunkt je Gerät verschieden. */
const ABO = (geraet, mehr = {}) => ({
  endpoint: `https://push.example.org/send/${geraet}`,
  keys: { p256dh: `BP${'k'.repeat(85)}`, auth: 'a'.repeat(22) },
  ...mehr,
});

const db = await PGlite.create();
const SQL = readFileSync(DATEI, 'utf8');

/** Eine Abfrage als die Rolle `rolle` – ohne Rolle als Superuser. */
async function als(rolle, sql, werte = []) {
  if (rolle) await db.exec(`set role ${rolle}`);
  try {
    return (await db.query(sql, werte)).rows;
  } finally {
    if (rolle) await db.exec('reset role');
  }
}
const su = (sql, werte) => als(null, sql, werte);

/** Eine ganze Datei als ein Block, wie im SQL Editor – als Besitzer. */
async function einspielen(text = SQL) {
  await db.exec('set role besitzer');
  try {
    await db.exec(text);
  } finally {
    await db.exec('reset role');
  }
}

/**
 * Ruft eine Funktion auf, wie die App es über PostgREST tut: als anon, mit
 * Namen, und was undefined ist, fehlt ganz. Ein jsonb-Wert geht als
 * JSON-Text hinüber – ein Objekt wird dafür zu JSON, eine Zeichenkette ist
 * schon JSON ('null', '[1]', '"x"'), null bleibt SQL-null.
 */
async function rufe(name, params, rolle = 'anon') {
  const namen = Object.keys(params).filter((k) => params[k] !== undefined);
  const platz = namen.map((k, i) => `${k} => $${i + 1}::${TYP[k] === 'jsonb' ? 'text::jsonb' : TYP[k]}`);
  const roh = namen.map((k) => (TYP[k] === 'jsonb' && params[k] !== null && typeof params[k] !== 'string' ? JSON.stringify(params[k]) : params[k]));
  const [zeile] = await als(rolle, `select ${name}(${platz.join(', ')}) as stand`, roh);
  return zeile.stand;
}
const lesen = (code, person, schluessel) => rufe('freizeit_lesen', { p_code: code, p_person: person, p_schluessel: schluessel });
const ich = (code, person, name, schluessel) => rufe('freizeit_ich', { p_code: code, p_person: person, p_name: name, p_schluessel: schluessel });
const bock = (code, person, eintrag, an, daten = null, schluessel = undefined) => rufe('freizeit_bock', {
  p_code: code, p_person: person, p_eintrag: eintrag, p_bock: an, p_daten: daten, p_schluessel: schluessel,
});
const weg = (code, person, schluessel, wer) => rufe('freizeit_weg', { p_code: code, p_person: person, p_schluessel: schluessel, p_wer: wer });
const push = (code, person, schluessel, abo, an) => rufe('freizeit_push', { p_code: code, p_person: person, p_schluessel: schluessel, p_abo: abo, p_an: an });
/** Was Tobi als Gastgeber von Raum A sieht. */
const alles = (code = A) => lesen(code, TOBI, SCHLUESSEL);

/** Der Fehler eines Aufrufs – oder null, wenn er durchging. */
async function fehler(aufruf) {
  try {
    await aufruf;
    return null;
  } catch (e) {
    return e;
  }
}
const meldung = async (aufruf) => (await fehler(aufruf))?.message ?? null;
/** Postgres: permission denied. */
const verweigert = (e) => e?.code === '42501';

/** Jeder der Werte muss dieselbe Meldung bringen – genannt werden die, bei denen nicht. */
async function jeder(werte, aufruf, erwartet, m) {
  const anders = [];
  for (const w of werte) {
    const ist = await meldung(aufruf(w));
    if (ist !== erwartet) anders.push(`${JSON.stringify(w).slice(0, 50)} → ${ist}`);
  }
  check(!anders.length, `${m} → „${erwartet}“${anders.length ? ` – nicht bei ${anders.join('; ')}` : ''}`);
}

const reihe = (stand) => stand.bock.map((b) => `${b.person}/${b.eintrag}`);
const leute = (stand) => stand.personen.map((p) => `${p.id}:${p.name}`);
const zaehle = async (sql, werte) => (await su(`select (${sql})::int as n`, werte))[0].n;
/** Kommt diese Kennung oder dieser Name irgendwo in der Antwort vor? */
const kennt = (stand, ...was) => was.some((w) => JSON.stringify(stand).includes(w));

/** Wer was darf – nach jedem Lauf der Datei dasselbe. */
async function rechtePruefen(wann) {
  const f = await su(`select p.proname as name,
        has_function_privilege('anon', p.oid, 'execute') as anon,
        has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
        has_function_privilege('fremd', p.oid, 'execute') as fremd,
        has_function_privilege('service_role', p.oid, 'execute') as dienst
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'freizeit%'`);
  const anon = f.filter((x) => x.anon).map((x) => x.name).sort();
  check(gleich(anon, FUENF), `${wann}: anon darf genau die fünf Funktionen ausführen (${anon.join(', ')})`);
  const sonst = f.filter((x) => x.authenticated || x.fremd).map((x) => x.name);
  check(!sonst.length, `${wann}: authenticated und public dürfen keine der ${f.length} freizeit-Funktionen ausführen`
    + `${sonst.length ? ` – doch: ${sonst.join(', ')}` : ''}`);
  const dienst = f.filter((x) => x.dienst).map((x) => x.name).sort();
  check(gleich(dienst, Object.keys(DIENST).sort()), `${wann}: service_role darf genau die vier für die Edge Function ausführen (${dienst.join(', ')})`);

  const RECHTE = 'select, insert, update, delete, truncate, references, trigger';
  const t = await su(`select t.name,
        has_table_privilege('anon', t.name, '${RECHTE}')
        or has_table_privilege('authenticated', t.name, '${RECHTE}')
        or has_table_privilege('service_role', t.name, '${RECHTE}')
        or has_table_privilege('fremd', t.name, '${RECHTE}') as irgendwer
      from unnest($1::text[]) as t(name)`, [TABELLEN]);
  check(t.length === 6 && t.every((x) => !x.irgendwer), `${wann}: auf die sechs Tabellen hat weder anon noch authenticated noch service_role noch public ein Recht`);
  const lesbar = [];
  for (const tabelle of TABELLEN) if (!verweigert(await fehler(als('anon', `select * from ${tabelle}`)))) lesbar.push(tabelle);
  check(!lesbar.length, `${wann}: anon – select * auf jede Tabelle → permission denied${lesbar.length ? ` – nicht bei ${lesbar.join(', ')}` : ''}`);
  const schreiben = [
    "insert into freizeit_person (raum, person, name) values ('x', 'eindringling', 'x')",
    'update freizeit_bock set daten = null',
    "update freizeit_gastgeber set schluessel = 'x'",
    'delete from freizeit_person',
    "insert into freizeit_push (raum, person, endpunkt, abo) values ('x', 'x', 'https://x', '{}')",
    'delete from freizeit_nachricht',
    'select wert from freizeit_einstellung',
  ];
  const durch = [];
  for (const sql of schreiben) if (!verweigert(await fehler(als('anon', sql)))) durch.push(sql.split(' ').slice(0, 3).join(' '));
  check(!durch.length, `${wann}: anon kann auch nicht hineinschreiben${durch.length ? ` – doch: ${durch.join(', ')}` : ''}`);

  const beispiel = {
    freizeit_ich: { p_code: A, p_person: TOBI, p_name: 'Tobi' },
    freizeit_lesen: { p_code: A },
    freizeit_bock: { p_code: A, p_person: TOBI, p_eintrag: 'konzert-1', p_bock: false, p_daten: null },
    freizeit_weg: { p_code: A, p_person: NIEMAND },
    freizeit_push: { p_code: A, p_person: TOBI, p_schluessel: SCHLUESSEL, p_abo: ABO('x'), p_an: false },
  };
  const auth = [];
  for (const name of FUENF) if (!verweigert(await fehler(rufe(name, beispiel[name], 'authenticated')))) auth.push(name);
  check(!auth.length, `${wann}: authenticated darf keine der fünf aufrufen${auth.length ? ` – doch: ${auth.join(', ')}` : ''}`);
  const dienstFalsch = [];
  for (const name of FUENF) if (!verweigert(await fehler(rufe(name, beispiel[name], 'service_role')))) dienstFalsch.push(name);
  const dienstBeispiel = { freizeit_push_offen: {}, freizeit_push_fertig: { p_ids: [1], p_tot: ['x'] }, freizeit_push_schluessel: {}, freizeit_push_schluessel_setzen: { p_oeffentlich: 'x', p_privat: 'y' } };
  for (const name of Object.keys(DIENST)) {
    for (const rolle of ['anon', 'authenticated']) {
      if (!verweigert(await fehler(rufe(name, dienstBeispiel[name], rolle)))) dienstFalsch.push(`${name} als ${rolle}`);
    }
  }
  check(!dienstFalsch.length, `${wann}: service_role darf die fünf nicht, anon und authenticated nicht die vier der Edge Function${dienstFalsch.length ? ` – doch: ${dienstFalsch.join(', ')}` : ''}`);
  const helfer = [];
  const probe = {
    freizeit_raum: ['$1::text', [A]],
    freizeit_kennung: ['$1::text', [TOBI]],
    freizeit_hash: ['$1::text', [SCHLUESSEL]],
    freizeit_gastgeber_von: ['$1::text', [raumVon(A)]],
    freizeit_rolle: ['$1::text, $2::text, $3::text', [raumVon(A), TOBI, null]],
    freizeit_stand: ['$1::text, $2::text, $3::text', [raumVon(A), TOBI, 'gastgeber']],
    freizeit_melden: ['$1::text, $2::text, $3::text, $4::jsonb', [raumVon(A), 'neu', 'Niemand', null]],
  };
  for (const name of HELFER) {
    if (!verweigert(await fehler(als('anon', `select ${name}(${probe[name][0]})`, probe[name][1])))) helfer.push(name);
  }
  check(!helfer.length, `${wann}: anon kommt an keinen der sieben Helfer heran${helfer.length ? ` – doch: ${helfer.join(', ')}` : ''}`);
}

async function pruefen() {
  // ------------------------------------------------- Supabase, nachgebaut
  await db.exec(`
    -- Die Rollen, als die PostgREST in Supabase Anfragen ausführt.
    create role anon nologin noinherit;
    create role authenticated nologin noinherit;
    create role service_role nologin noinherit bypassrls;
    -- Der Besitzer, als der der SQL Editor läuft. In Supabase heißt er
    -- postgres und ist kein Superuser – hier auch nicht.
    create role besitzer nologin;
    -- Einer ohne eigene Rechte: Was er darf, darf jeder (public).
    create role fremd nologin;
    grant usage, create on schema public to besitzer;
    grant usage on schema public to anon, authenticated, service_role;
    -- Was der Besitzer in public anlegt, dürfen von sich aus alle drei.
    alter default privileges for role besitzer in schema public
      grant all on tables to anon, authenticated, service_role;
    alter default privileges for role besitzer in schema public
      grant all on functions to anon, authenticated, service_role;
    alter default privileges for role besitzer in schema public
      grant all on sequences to anon, authenticated, service_role;
  `);
  await db.exec(`set role besitzer;
    create table gegenprobe (x int);
    create function gegenprobe() returns int language sql as 'select 1';
    reset role;`);
  const [g] = await su(`select has_table_privilege('anon', 'gegenprobe', 'select') as tabelle,
      has_function_privilege('authenticated', 'gegenprobe()', 'execute') as funktion,
      has_function_privilege('fremd', 'gegenprobe()', 'execute') as alle`);
  check(g.tabelle && g.funktion && g.alle, 'Gegenprobe: an Neues dürfen anon, authenticated und public heran wie in Supabase – bis die Datei es ihnen nimmt');
  await db.exec('drop table gegenprobe; drop function gegenprobe();');

  // --------------------------------------- die erste Fassung, mit einem Raum
  const KONZERT = {
    titel: 'Konzert „Schöne Aussicht“', tag: '2026-11-02', zeit: '19:30',
    ort: { name: 'Övelgönne', region: 'HH' }, merkmale: ['draußen', 'kostenlos'], preis: 0, ganztags: false,
  };
  const KINO = { titel: 'Kino lang', tag: '2026-11-04', zeit: '19:00' };
  const alt = await fehler(einspielen(readFileSync(ALT, 'utf8')));
  check(!alt, `die erste Fassung (tests/alt/gemeinsam-v2.sql) läuft durch${alt ? ` – ${alt.message}` : ''}`);
  if (alt) return;
  await rufe('freizeit_ich', { p_code: L, p_person: TOBI, p_name: 'Tobi' });
  await rufe('freizeit_ich', { p_code: L, p_person: KIM, p_name: 'Kim' });
  await rufe('freizeit_bock', { p_code: L, p_person: TOBI, p_eintrag: 'konzert-1', p_bock: true, p_daten: KONZERT });
  await rufe('freizeit_bock', { p_code: L, p_person: KIM, p_eintrag: 'kino-2', p_bock: true, p_daten: KINO });
  // Wer zuerst da war, soll nicht an der Uhr hängen.
  await su("update freizeit_person set angelegt = now() - interval '1 day' where person = $1", [TOBI]);
  const vorher = await rufe('freizeit_lesen', { p_code: L });
  check(vorher.personen.length === 2 && vorher.bock.length === 2 && !('rolle' in vorher), 'in der ersten Fassung sieht jeder alles – ohne Rolle');

  // ------------------------------------------------------------ einspielen
  const erster = await fehler(einspielen());
  check(!erster, `gemeinsam.sql läuft darüber als Besitzer ohne Superuser-Rechte durch${erster ? ` – ${erster.message}` : ''}`);
  if (erster) return;

  // ----------------------------------------------------------------- Aufbau
  const tabellen = await su(`select c.relname as name, c.relrowsecurity as rls from pg_class c
     where c.relkind = 'r' and c.relname = any($1::text[])`, [TABELLEN]);
  check(tabellen.length === 6 && tabellen.every((t) => t.rls), 'alle sechs Tabellen da, Row Level Security an');
  check(await zaehle('select count(*) from pg_policies where tablename = any($1::text[])', [TABELLEN]) === 0,
    'keine einzige Regel (Policy) – herein kommt man nur über die Funktionen');
  const funktionen = await su(`select p.proname as name, pg_get_function_arguments(p.oid) as args,
        p.prorettype::regtype::text as rueckgabe, l.lanname as sprache, p.prosecdef as definer, p.proconfig as config
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_language l on l.oid = p.prolang
     where n.nspname = 'public' and p.proname like 'freizeit%'`);
  for (const [name, args] of Object.entries(SIGNATUR)) {
    const f = funktionen.filter((x) => x.name === name);
    check(f.length === 1 && f[0].args === args && f[0].rueckgabe === 'jsonb' && f[0].sprache === 'plpgsql'
      && f[0].definer && (f[0].config || []).includes('search_path=public, pg_temp'),
    `${name}(${args}) returns jsonb – genau eine, plpgsql, security definer, search_path = public, pg_temp${f.length > 1 ? ` (es gibt ${f.length})` : ''}`);
  }
  for (const [name, args] of Object.entries(DIENST)) {
    const f = funktionen.filter((x) => x.name === name);
    check(f.length === 1 && f[0].args === args && f[0].sprache === 'plpgsql' && f[0].definer && (f[0].config || []).includes('search_path=public, pg_temp'),
      `${name}(${args}) – genau eine, plpgsql, security definer, search_path = public, pg_temp`);
  }
  const uebrig = funktionen.map((f) => f.name).filter((n) => !FUENF.includes(n) && !HELFER.includes(n) && !(n in DIENST) && n !== AUSLOESER);
  const helferDa = HELFER.filter((h) => funktionen.filter((f) => f.name === h).length === 1);
  check(!uebrig.length && helferDa.length === HELFER.length && funktionen.some((f) => f.name === AUSLOESER && f.rueckgabe === 'trigger') && funktionen.length === 17,
    `sonst nur die sieben Helfer und der Auslöser für pg_net, je einmal – von der ersten Fassung ist keine Funktion übrig${uebrig.length ? ` – doch: ${uebrig.join(', ')}` : ''}`);
  await rechtePruefen('nach dem ersten Lauf');

  // ------------------------------------------ der Raum aus der ersten Fassung
  check(await zaehle('select count(*) from freizeit_person where raum = $1', [raumVon(L)]) === 2
    && await zaehle('select count(*) from freizeit_bock where raum = $1', [raumVon(L)]) === 2,
  'Personen und Häkchen der ersten Fassung sind noch da');
  check(gleich(await lesen(L), { rolle: 'gast', personen: [{ id: 'gastgeber', name: 'Tobi' }], bock: [] }),
    'ohne Person: nur der Name dessen, der am längsten drin ist – er gilt als Gastgeber');
  let s = await lesen(L, KIM);
  check(s.rolle === 'mitglied' && gleich(leute(s), ['gastgeber:Tobi', `${KIM}:Kim`]) && gleich(reihe(s), ['gastgeber/konzert-1', `${KIM}/kino-2`])
    && !kennt(s, TOBI), 'Kim sieht Tobi unter der Kennung „gastgeber“, nicht mehr unter seiner');
  s = await lesen(L, TOBI);
  check(s.rolle === 'gastgeber' && gleich(leute(s), [`${TOBI}:Tobi`, `${KIM}:Kim`]) && gleich(reihe(s), [`${TOBI}/konzert-1`, `${KIM}/kino-2`]),
    'Tobi sieht alles – ohne Schlüssel, solange er keinen hinterlegt hat');
  s = await ich(L, KIM, 'Kim', ANDERER);
  check(s.rolle === 'mitglied' && await zaehle('select count(*) from freizeit_gastgeber where raum = $1', [raumVon(L)]) === 0,
    'schickt Kim einen Schlüssel mit, bleibt er ohne Wirkung');
  s = await ich(L, TOBI, 'Tobi', SCHLUESSEL);
  const [gast] = await su('select person, schluessel from freizeit_gastgeber where raum = $1', [raumVon(L)]);
  check(s.rolle === 'gastgeber' && gast?.person === TOBI && gast?.schluessel === hashVon(SCHLUESSEL),
    'Tobi hinterlegt seinen Schlüssel mit freizeit_ich – gespeichert wird nur der Hash');
  check(await meldung(lesen(L, TOBI)) === 'falscher Schlüssel', 'danach sieht Tobi ohne Schlüssel nichts mehr – „falscher Schlüssel“');
  check(await meldung(ich(L, TOBI, 'Tobi', ANDERER)) === 'falscher Schlüssel', 'und kein zweiter Schlüssel ersetzt den ersten');
  check(await meldung(bock(L, TOBI, 'kino-2', true, {}, ANDERER)) === 'falscher Schlüssel',
    'Kim kennt Tobis Kennung noch aus der ersten Fassung – ein Häkchen in seinem Namen setzt sie trotzdem nicht');
  s = await lesen(L, TOBI, SCHLUESSEL);
  check(s.rolle === 'gastgeber' && gleich(reihe(s), [`${TOBI}/konzert-1`, `${KIM}/kino-2`]), 'mit dem Schlüssel: alles wie zuvor');

  // -------------------------------------------------------------- Eintreten
  check(gleich(await lesen(A), LEER), 'lesen: ein Raum, in dem noch niemand ist, ist leer – kein Fehler');
  s = await ich(A, TOBI, 'Tobi', SCHLUESSEL);
  check(gleich(s, { rolle: 'gastgeber', personen: [{ id: TOBI, name: 'Tobi' }], bock: [] }), 'ich mit Schlüssel: Tobi legt Raum A an und ist sein Gastgeber');
  check(gleich(await su('select person, schluessel from freizeit_gastgeber where raum = $1', [raumVon(A)]), [{ person: TOBI, schluessel: hashVon(SCHLUESSEL) }]),
    'in freizeit_gastgeber: Tobi und der Hash seines Schlüssels');
  s = await ich(A, KIM, '  Kim ');
  check(gleich(s, { rolle: 'mitglied', personen: [{ id: 'gastgeber', name: 'Tobi' }, { id: KIM, name: 'Kim' }], bock: [] }),
    'ich: Kim tritt ein (aus „  Kim “ wird „Kim“) – sie sieht Tobi als Gastgeber und sich');
  s = await ich(A, JO, 'Jo', ANDERER);
  check(gleich(leute(s), ['gastgeber:Tobi', `${JO}:Jo`]) && s.rolle === 'mitglied' && !kennt(s, KIM, 'Kim'),
    'Jo tritt ein (sein Schlüssel macht ihn nicht zum Gastgeber) – von Kim sieht er nichts');
  s = await alles();
  check(gleich(s, { rolle: 'gastgeber', personen: [{ id: TOBI, name: 'Tobi' }, { id: KIM, name: 'Kim' }, { id: JO, name: 'Jo' }], bock: [] }),
    'Tobi sieht alle drei mit ihren Kennungen, in der Reihenfolge des Eintretens');
  check(gleich(await lesen(A), { rolle: 'gast', personen: [{ id: 'gastgeber', name: 'Tobi' }], bock: [] })
    && gleich(await lesen(A, NIEMAND), await lesen(A)), 'wer nicht drin ist, sieht nur den Namen des Gastgebers');
  s = await ich(A, TOBI, 'Tobias', SCHLUESSEL);
  check(gleich(leute(s), [`${TOBI}:Tobias`, `${KIM}:Kim`, `${JO}:Jo`]), 'ich: Umbenennen – aus Tobi wird Tobias, er bleibt vorn');
  check(gleich(leute(await lesen(A, KIM)), ['gastgeber:Tobias', `${KIM}:Kim`]), 'Kim sieht den neuen Namen');
  check(await zaehle('select count(*) from freizeit_person where raum = $1', [raumVon(A)]) === 3
    && await zaehle('select count(*) from freizeit_gastgeber where raum = $1', [raumVon(A)]) === 1, 'Umbenennen legt niemanden doppelt an');
  check(await meldung(ich(A, TOBI, 'Tobi')) === 'falscher Schlüssel' && await meldung(lesen(A, TOBI, ANDERER)) === 'falscher Schlüssel',
    'Tobis Kennung ohne seinen Schlüssel → „falscher Schlüssel“');
  check(gleich(await lesen('ABCD-EFGH-JKMN', KIM), await lesen(A, KIM)), 'Großbuchstaben: ABCD-EFGH-JKMN ist derselbe Raum wie abcd-efgh-jkmn');
  s = await ich('AbCd-EfGh-JkMn', KIM, 'Kim');
  check(gleich(leute(s), ['gastgeber:Tobias', `${KIM}:Kim`]) && (await alles()).personen.length === 3, 'ich in gemischter Schreibweise: Kim ist schon da, niemand kommt dazu');
  check(gleich(await lesen('abcdefghjkmn'), LEER), 'ohne Bindestriche ist es ein anderer Raum – die Bindestriche gehen mit in den Hash');
  check(gleich(await lesen(B), LEER), 'ein anderer Code sieht vom ersten Raum nichts');
  const JUERGEN = randomUUID();
  s = await ich(B, JUERGEN, 'Jürgen 🎸');
  check(gleich(s, { rolle: 'gastgeber', personen: [{ id: JUERGEN, name: 'Jürgen 🎸' }], bock: [] }),
    'Raum B ohne Schlüssel: eine UUID als Person, Umlaut und Emoji im Namen – Gastgeber, wer zuerst da ist');
  check(await zaehle('select count(*) from freizeit_gastgeber where raum = $1', [raumVon(B)]) === 0, '… ohne Schlüssel steht in freizeit_gastgeber nichts');
  check((await alles()).personen.length === 3, 'Raum A bleibt davon unberührt');
  const GUELTIG = ['abcd-efgh-jkmn-pqrs-tuvw', 'abcdefghjkmnpqrstuvw', 'abcd-efgh-jkmn-pqrs', '0000-0000-0000', 'abcdefgh-jkmn'];
  const abgelehnt = [];
  for (const c of GUELTIG) if (!gleich(await lesen(c).catch((e) => e.message), LEER)) abgelehnt.push(c);
  check(!abgelehnt.length, `auch gültig: drei bis fünf Vierergruppen, Bindestriche nach Belieben${abgelehnt.length ? ` – abgelehnt: ${abgelehnt.join(', ')}` : ''}`);

  // ---------------------------------------------------------------- Häkchen
  s = await bock(A, TOBI, 'konzert-1', true, KONZERT, SCHLUESSEL);
  check(s.rolle === 'gastgeber' && s.bock.length === 1 && s.bock[0].person === TOBI && s.bock[0].eintrag === 'konzert-1' && gleich(s.bock[0].daten, KONZERT),
    'bock: Tobi setzt ein Häkchen, daten kommen unverändert zurück');
  check(gleich(Object.keys(s.bock[0]).sort(), ['daten', 'eintrag', 'geaendert', 'person']), 'ein Häkchen hat genau person, eintrag, daten, geaendert');
  const zeit = s.bock[0].geaendert;
  check(ISO.test(zeit) && Math.abs(Date.parse(zeit) - Date.now()) < 60000, `geaendert ist ISO-Text in UTC wie toISOString() (${zeit})`);
  await db.exec("set timezone = 'Pacific/Kiritimati'");
  const zeitKiritimati = (await alles()).bock[0].geaendert;
  await db.exec("set timezone = 'America/Los_Angeles'");
  const zeitLosAngeles = (await alles()).bock[0].geaendert;
  await db.exec('reset timezone');
  check(zeitKiritimati === zeit && zeitLosAngeles === zeit, 'geaendert hängt nicht von der Zeitzone der Sitzung ab');
  check(await meldung(bock(A, TOBI, 'kino-2', true, KINO)) === 'falscher Schlüssel', 'Tobi ohne Schlüssel setzt kein Häkchen');

  const MIT = { ...KONZERT, mitwem: 'gastgeber' };
  s = await bock(A, KIM, 'konzert-1', true, MIT);
  check(s.rolle === 'mitglied' && gleich(reihe(s), ['gastgeber/konzert-1', `${KIM}/konzert-1`]) && gleich(s.bock[1].daten, MIT) && !kennt(s, TOBI),
    'Kim hakt dasselbe an – sie sieht ihr Häkchen und Tobis, unter „gastgeber“');
  s = await bock(A, JO, 'kino-2', true, { ...KINO, mitwem: 'andere' });
  check(gleich(reihe(s), ['gastgeber/konzert-1', `${JO}/kino-2`]) && !kennt(s, KIM, 'Kim'), 'Jo hakt etwas anderes an – Kims Häkchen sieht er nicht');
  s = await bock(A, TOBI, 'kino-2', true, KINO, SCHLUESSEL);
  check(gleich(reihe(s), [`${TOBI}/konzert-1`, `${KIM}/konzert-1`, `${JO}/kino-2`, `${TOBI}/kino-2`]), 'Tobi sieht alle Häkchen – Reihenfolge nach geaendert');
  check(gleich(reihe(await lesen(A, KIM)), ['gastgeber/konzert-1', `${KIM}/konzert-1`, 'gastgeber/kino-2']), 'Kim sieht Tobis neues Häkchen beim nächsten Lesen');
  check(gleich(await alles(), s), 'lesen zeigt Tobi genau das');
  const [{ t: davor }] = await su("select geaendert::text as t from freizeit_bock where raum = $1 and person = $2 and eintrag = 'konzert-1'", [raumVon(A), TOBI]);
  const SPAETER = { ...KONZERT, zeit: '20:00' };
  s = await bock(A, TOBI, 'konzert-1', true, SPAETER, SCHLUESSEL);
  const [{ neuer }] = await su("select geaendert > $3::timestamptz as neuer from freizeit_bock where raum = $1 and person = $2 and eintrag = 'konzert-1'",
    [raumVon(A), TOBI, davor]);
  check(s.bock.length === 4 && gleich(s.bock.find((b) => b.person === TOBI && b.eintrag === 'konzert-1')?.daten, SPAETER) && neuer,
    'nochmal setzen ersetzt daten und erneuert geaendert – ein zweites Häkchen gibt es nicht');
  check(gleich(reihe(s), [`${KIM}/konzert-1`, `${JO}/kino-2`, `${TOBI}/kino-2`, `${TOBI}/konzert-1`]), 'das erneuerte Häkchen rückt ans Ende');
  s = await bock(A, TOBI, 'kino-2', false, null, SCHLUESSEL);
  check(gleich(reihe(s), [`${KIM}/konzert-1`, `${JO}/kino-2`, `${TOBI}/konzert-1`]), 'bock mit false: das Häkchen ist weg');
  check(gleich(await bock(A, TOBI, 'kino-2', false, null, SCHLUESSEL), s), 'ein Häkchen wegnehmen, das es nicht gibt, ist kein Fehler');
  await bock(A, KIM, 'nur-kurz', true, {});
  s = await bock(A, KIM, 'nur-kurz', null);
  check(!reihe(s).includes(`${KIM}/nur-kurz`), 'bock mit null nimmt weg wie false');
  s = await bock(A, KIM, 'ohne-daten', true, null);
  check(s.bock.find((b) => b.eintrag === 'ohne-daten')?.daten === null, 'daten dürfen fehlen – dann steht dort null');
  s = await bock(A, KIM, 'json-null', true, 'null');
  check(s.bock.find((b) => b.eintrag === 'json-null')?.daten === null
    && await zaehle("select count(*) from freizeit_bock where eintrag = 'json-null' and daten is null") === 1,
  'JSON-null als daten zählt wie fehlende daten');
  await bock(A, KIM, 'ohne-daten', false);
  await bock(A, KIM, 'json-null', false);
  check(await meldung(bock(A, NIEMAND, 'konzert-1', true, KONZERT)) === 'unbekannte Person', 'bock für jemanden, der nicht im Raum ist → „unbekannte Person“');
  check(await meldung(bock(A, NIEMAND, 'konzert-1', false)) === 'unbekannte Person', 'auch beim Wegnehmen → „unbekannte Person“');
  check(await meldung(bock(B, KIM, 'konzert-1', true, KONZERT)) === 'unbekannte Person', 'Kim ist in Raum B unbekannt → „unbekannte Person“');
  check(gleich(await lesen(B, JUERGEN), { rolle: 'gastgeber', personen: [{ id: JUERGEN, name: 'Jürgen 🎸' }], bock: [] }), 'Raum B sieht keins der Häkchen aus Raum A');

  // -------------------------------------------------------------- Prüfungen
  const FALSCHE_CODES = [null, '', 'abcd', 'abcd-efgh', 'abcdefgh', 'abcd-efgh-jkm', 'abcd-efgh-jkmnp', 'abc-defgh-jkmn',
    'abcd-efgh-jkmn-pqrs-tuvw-xyz2', 'abcdefghjkmnpqrstuvwxyz2', 'abcd--efgh-jkmn', '-abcd-efgh-jkmn', 'abcd-efgh-jkmn-',
    ' abcd-efgh-jkmn', 'abcd-efgh-jkmn ', 'abcd-efgh-jkmn\n', 'abcd_efgh_jkmn', 'abcd efgh jkmn', 'äbcd-efgh-jkmn', 'abcd-efgh-jkmñ'];
  await jeder(FALSCHE_CODES, (c) => lesen(c), 'ungültiger Code', `lesen: ${FALSCHE_CODES.length} falsche Codes`);
  await jeder([null, 'abcd'], (c) => ich(c, TOBI, 'Tobi'), 'ungültiger Code', 'ich: falscher Code');
  await jeder([null, 'abcd'], (c) => bock(c, TOBI, 'konzert-1', true, {}), 'ungültiger Code', 'bock: falscher Code');
  await jeder([null, 'abcd'], (c) => weg(c, TOBI), 'ungültiger Code', 'weg: falscher Code');

  const FALSCHE_PERSONEN = ['', 'kurz-12', 'x'.repeat(41), 'Tobi-0001-aaaa', 'tobi_0001_aaaa', 'tobi 0001 aaaa',
    'tobi-0001-aaaa\n', 'tobi-0001-äaaa', 'gastgeber'];
  await jeder([null, ...FALSCHE_PERSONEN], (p) => ich(C, p, 'Wer'), 'ungültige Person', `ich: ${FALSCHE_PERSONEN.length + 1} falsche Personen, auch „gastgeber“`);
  await jeder([null, ...FALSCHE_PERSONEN], (p) => bock(A, p, 'konzert-1', true, {}), 'ungültige Person', 'bock: dieselben falschen Personen');
  await jeder([null, ...FALSCHE_PERSONEN], (p) => weg(A, p), 'ungültige Person', 'weg: dieselben falschen Personen');
  await jeder(FALSCHE_PERSONEN, (p) => lesen(A, p), 'ungültige Person', 'lesen: dieselben, nur null heißt hier „ohne Person“');
  await jeder(FALSCHE_PERSONEN, (p) => weg(A, TOBI, SCHLUESSEL, p), 'ungültige Person', 'weg: dieselben als p_wer');
  const ACHT = 'acht-123';
  const VIERZIG = '4'.repeat(40);
  await ich(C, ACHT, 'Acht');
  s = await ich(C, VIERZIG, 'Vierzig');
  check(gleich(leute(s), ['gastgeber:Acht', `${VIERZIG}:Vierzig`]), 'Personen mit 8 und mit 40 Zeichen gehen');

  const FALSCHE_SCHLUESSEL = ['', 'kurz', 'a'.repeat(19), 'a'.repeat(65), 'Tobischluessel0000000001', 'tobi-schluessel-00000001', 'tobischlüssel00000000001', ' tobischluessel000000001'];
  await jeder(FALSCHE_SCHLUESSEL, (k) => lesen(A, TOBI, k), 'ungültiger Schlüssel', `lesen: ${FALSCHE_SCHLUESSEL.length} falsche Schlüssel`);
  await jeder(FALSCHE_SCHLUESSEL.slice(0, 2), (k) => ich(A, KIM, 'Kim', k), 'ungültiger Schlüssel', 'ich: falsche Schlüssel – auch von einem, der keinen braucht');
  await jeder(FALSCHE_SCHLUESSEL.slice(0, 2), (k) => bock(A, KIM, 'konzert-1', true, {}, k), 'ungültiger Schlüssel', 'bock: falsche Schlüssel');
  await jeder(FALSCHE_SCHLUESSEL.slice(0, 2), (k) => weg(A, KIM, k), 'ungültiger Schlüssel', 'weg: falsche Schlüssel');
  check(await meldung(lesen(A, TOBI, 'a'.repeat(64))) === 'falscher Schlüssel', 'ein Schlüssel mit 64 Zeichen hat die richtige Form – nur eben nicht Tobis');
  s = await ich(C, 'neu-mit-20', 'Zwanzig', 'z'.repeat(20));
  check(s.rolle === 'mitglied', 'ein Schlüssel mit 20 Zeichen ist gültig (und in Raum C ohne Wirkung)');
  await weg(C, 'neu-mit-20');

  const FALSCHE_NAMEN = [null, '', '   ', 'x'.repeat(31), `  ${'x'.repeat(31)}  `, 'ä'.repeat(31)];
  await jeder(FALSCHE_NAMEN, (n) => ich(C, ACHT, n), 'Name fehlt oder ist zu lang', `ich: ${FALSCHE_NAMEN.length} falsche Namen`);
  check((await lesen(C)).personen[0].name === 'Acht', 'ein abgelehnter Name ändert nichts');
  s = await ich(C, ACHT, `  ${'ä'.repeat(30)}  `);
  check(s.personen[0].name === 'ä'.repeat(30), 'ein Name mit 30 Zeichen geht – gezählt ohne die Leerzeichen am Rand');

  await jeder([null, '', 'e'.repeat(201)], (e) => bock(A, KIM, e, true, {}), 'ungültiger Eintrag', 'bock: Eintrag null, leer oder mit 201 Zeichen');
  s = await bock(A, KIM, 'e'.repeat(200), true, {});
  check(reihe(s).includes(`${KIM}/${'e'.repeat(200)}`), 'ein Eintrag mit 200 Zeichen geht');
  await bock(A, KIM, 'e'.repeat(200), false);

  // {"x": "aaa…"} – neun Zeichen drumherum, so schreibt Postgres jsonb als Text.
  const mitLaenge = (n, zeichen = 'a') => ({ x: zeichen.repeat(n - 9) });
  const laenge = await zaehle('select length($1::text::jsonb::text)', [JSON.stringify(mitLaenge(2000))]);
  await jeder(['[1, 2]', '"Konzert"', '5', 'true', mitLaenge(2001)], (d) => bock(A, KIM, 'gross', true, d), 'Eintrag zu groß',
    'bock: daten als Liste, Text, Zahl, true oder mit 2001 Zeichen');
  s = await bock(A, KIM, 'gross', true, mitLaenge(2000));
  check(laenge === 2000 && gleich(s.bock.find((b) => b.eintrag === 'gross')?.daten, mitLaenge(2000)), 'daten mit genau 2000 Zeichen gehen');
  // Gezählt wird in Bytes: Ein Umlaut sind in UTF-8 zwei. mitLaenge(1004, 'ä')
  // sind 9 Zeichen Rahmen plus 995 Umlaute = 1999 Byte, eins mehr wären 2001.
  s = await bock(A, KIM, 'gross', true, mitLaenge(1004, 'ä'));
  check(gleich(s.bock.find((b) => b.eintrag === 'gross')?.daten, mitLaenge(1004, 'ä')),
    'gezählt wird in Bytes: 995 Umlaute (1999 Byte) gehen');
  await jeder([mitLaenge(1005, 'ä'), mitLaenge(2000, 'ä')], (d) => bock(A, KIM, 'gross', true, d), 'Eintrag zu groß',
    'bock: daten über 2000 Byte, auch wenn es weniger als 2000 Zeichen sind');
  await jeder(['ü'.repeat(101)], (e) => bock(A, KIM, e, true, {}), 'ungültiger Eintrag', 'bock: Eintrag mit 202 Byte (101 Umlaute)');
  s = await bock(A, KIM, 'ü'.repeat(100), true, {});
  check(reihe(s).includes(`${KIM}/${'ü'.repeat(100)}`), 'ein Eintrag mit genau 200 Byte (100 Umlaute) geht');
  await bock(A, KIM, 'ü'.repeat(100), false);
  await bock(A, KIM, 'gross', false);

  // ---------------------------------------------------------------- Grenzen
  const GAESTE = Array.from({ length: 27 }, (_, i) => `gast-${String(i + 4).padStart(4, '0')}`);
  for (const gast of GAESTE) s = await ich(A, gast, `Gast ${gast.slice(5)}`);
  check((await alles()).personen.length === 30 && gleich(leute(s), ['gastgeber:Tobias', `${GAESTE.at(-1)}:Gast ${GAESTE.at(-1).slice(5)}`]),
    '30 Personen passen in einen Raum – und jeder Gast sieht nur Tobi und sich');
  check(await meldung(ich(A, 'gast-0031', 'Einunddreißig')) === 'Raum ist voll', 'die 31. → „Raum ist voll“');
  s = await ich(A, GAESTE[0], 'Umbenannt');
  check(s.personen.find((p) => p.id === GAESTE[0])?.name === 'Umbenannt' && (await alles()).personen.length === 30, 'Umbenennen geht auch im vollen Raum');
  check((await ich(A, TOBI, 'Tobias', SCHLUESSEL)).personen.length === 30, 'und wer schon drin ist, kommt wieder herein');
  for (const gast of GAESTE) s = await weg(A, gast);
  check(gleich(leute(await alles()), [`${TOBI}:Tobias`, `${KIM}:Kim`, `${JO}:Jo`]), 'die Gäste gehen wieder');

  const vorhanden = (await alles()).bock.length;
  await su("insert into freizeit_bock (raum, person, eintrag) select $1, $2, 'fuell-' || i from generate_series(1, $3::int) as i",
    [raumVon(A), TOBI, 5999 - vorhanden]);
  s = await bock(A, KIM, 'nr-6000', true, {});
  check((await alles()).bock.length === 6000, 'das 6000. Häkchen im Raum geht noch');
  check(await meldung(bock(A, KIM, 'nr-6001', true, {})) === 'zu viele Häkchen', 'das 6001. → „zu viele Häkchen“');
  check(await meldung(bock(A, JO, 'nr-6001', true, {})) === 'zu viele Häkchen', 'die Grenze gilt für den Raum, nicht je Person');
  s = await bock(A, KIM, 'nr-6000', true, { neu: true });
  check(gleich(s.bock.find((b) => b.eintrag === 'nr-6000')?.daten, { neu: true }) && (await alles()).bock.length === 6000,
    'ein vorhandenes Häkchen neu setzen geht auch an der Grenze');
  check(s.bock.length === 6000 - 1 && !kennt(s, JO), `… und Kim bekommt dabei ihre und Tobis Häkchen zurück, nur Jos eines nicht (${s.bock.length})`);
  await bock(A, KIM, 'nr-6000', false);
  await bock(A, KIM, 'nr-6001', true, {});
  check((await alles()).bock.length === 6000, 'nach dem Wegnehmen ist wieder Platz');
  await su("delete from freizeit_bock where eintrag like 'fuell-%' or eintrag = 'nr-6001'");

  // Die Grenze für den ganzen Server. Aufgefüllt wird als Superuser in zehn
  // Füllräumen mit je höchstens 3000 Häkchen.
  const alleHaekchen = () => zaehle('select count(*) from freizeit_bock');
  const vorDerFuellung = await alleHaekchen();
  await su(`insert into freizeit_person (raum, person, name)
      select encode(sha256(convert_to('fuell-h:' || r, 'UTF8')), 'hex'), 'fuell-person', 'Füllung' from generate_series(1, 10) as r`);
  await su(`insert into freizeit_bock (raum, person, eintrag)
      select encode(sha256(convert_to('fuell-h:' || (1 + i % 10), 'UTF8')), 'hex'), 'fuell-person', 'fuell-' || i
        from generate_series(1, $1::int) as i`, [29999 - vorDerFuellung]);
  s = await bock(A, KIM, 'nr-30000', true, KINO);
  check(s.bock.some((b) => b.eintrag === 'nr-30000') && await alleHaekchen() === 30000, 'das 30000. Häkchen auf dem Server geht noch');
  check(await meldung(bock(A, KIM, 'nr-30001', true, {})) === 'Server voll', 'das 30001. → „Server voll“');
  check(await meldung(bock(B, JUERGEN, 'nr-30001', true, {})) === 'Server voll', 'die Grenze gilt für alle Räume zusammen – auch in Raum B');
  s = await bock(A, KIM, 'nr-30000', true, KONZERT);
  check(gleich(s.bock.find((b) => b.eintrag === 'nr-30000')?.daten, KONZERT) && await alleHaekchen() === 30000,
    'ein vorhandenes Häkchen neu setzen geht auch auf dem vollen Server');
  s = await bock(A, KIM, 'nr-30000', false);
  check(!s.bock.some((b) => b.eintrag === 'nr-30000') && await alleHaekchen() === 29999, 'Wegnehmen geht auch auf dem vollen Server');
  s = await bock(B, JUERGEN, 'nr-30001', true, {});
  check(s.bock.some((b) => b.eintrag === 'nr-30001'), 'danach ist wieder Platz – für jeden Raum');
  await bock(B, JUERGEN, 'nr-30001', false);
  await su("delete from freizeit_person where person = 'fuell-person'");
  check(await alleHaekchen() === vorDerFuellung, 'mit den Füllpersonen sind auch ihre Häkchen weg (Fremdschlüssel)');

  const raeume = () => zaehle('select count(distinct raum) from freizeit_person');
  await su(`insert into freizeit_person (raum, person, name)
      select encode(sha256(convert_to('fuell:' || i, 'UTF8')), 'hex'), 'fuell-person', 'Füllung' from generate_series(1, $1::int) as i`,
  [99 - await raeume()]);
  const R100 = 'raum-0100-voll';
  const R101 = 'raum-0101-mehr';
  s = await ich(R100, TOBI, 'Tobi', SCHLUESSEL);
  check(s.personen.length === 1 && await raeume() === 100, 'der 100. Raum geht noch');
  check(await meldung(ich(R101, TOBI, 'Tobi', SCHLUESSEL)) === 'zu viele Räume', 'der 101. → „zu viele Räume“');
  check(await raeume() === 100 && await zaehle('select count(*) from freizeit_gastgeber where raum = $1', [raumVon(R101)]) === 0,
    'der abgelehnte Raum ist auch nicht halb angelegt – auch kein Gastgeber');
  s = await ich(B, 'neu-in-b-0001', 'Neu');
  check(s.personen.length === 2, 'in einen Raum, den es schon gibt, kommt man trotzdem');
  check(gleich(await lesen(R101), LEER), 'lesen geht auch dann – und legt keinen Raum an');
  await weg(B, 'neu-in-b-0001');
  await weg(R100, TOBI, SCHLUESSEL);
  await su("delete from freizeit_person where person = 'fuell-person'");

  // --------------------------------------------------------------- 400 Tage
  await bock(A, TOBI, 'alt-399', true, {}, SCHLUESSEL);
  await bock(A, KIM, 'alt-401', true, {});
  await bock(B, JUERGEN, 'alt-500', true, {});
  await su("update freizeit_bock set geaendert = now() - interval '399 days' where eintrag = 'alt-399'");
  await su("update freizeit_bock set geaendert = now() - interval '401 days' where eintrag = 'alt-401'");
  await su("update freizeit_bock set geaendert = now() - interval '500 days' where eintrag = 'alt-500'");
  const gibt = (eintrag) => zaehle('select count(*) from freizeit_bock where eintrag = $1', [eintrag]);
  s = await bock(A, JO, 'frisch', true, {});
  check(await gibt('alt-401') === 0, 'nach 401 Tagen löscht der nächste bock im Raum das Häkchen – auch das eines anderen');
  check(s.bock.some((b) => b.eintrag === 'alt-399') && s.bock.some((b) => b.eintrag === 'frisch'), 'nach 399 Tagen bleibt es noch');
  check(await gibt('alt-500') === 1, 'aufgeräumt wird nur der eigene Raum');
  s = await bock(B, JUERGEN, 'gibt-es-nicht', false);
  check(!s.bock.length && await gibt('alt-500') === 0, 'aufgeräumt wird auch beim Wegnehmen');
  await bock(A, TOBI, 'alt-399', false, null, SCHLUESSEL);
  await bock(A, JO, 'frisch', false);

  // ------------------------------------------------------------------ Gehen
  s = await alles();
  const ohneJo = s.bock.filter((b) => b.person !== JO);
  check(s.bock.some((b) => b.person === JO) && s.bock.some((b) => b.person === KIM) && s.bock.some((b) => b.person === TOBI),
    'vor dem Gehen haben alle drei Häkchen');
  s = await weg(A, JO);
  check(gleich(s, { rolle: 'gast', personen: [{ id: 'gastgeber', name: 'Tobias' }], bock: [] }), 'weg: Jo geht – zurück kommt, was ein Gast sieht');
  s = await alles();
  check(gleich(leute(s), [`${TOBI}:Tobias`, `${KIM}:Kim`]) && gleich(s.bock, ohneJo), 'Jo und seine Häkchen sind weg, die der anderen bleiben, wie sie waren');
  check(await zaehle('select (select count(*) from freizeit_person where person = $1) + (select count(*) from freizeit_bock where person = $1)', [JO]) === 0,
    'von Jo steht nichts mehr in den Tabellen');
  check(gleich(await weg(A, JO), await lesen(A)), 'nochmal gehen ist kein Fehler');
  check(gleich(await weg(A, NIEMAND), await lesen(A)), 'wer nie da war, kann auch gehen – kein Fehler');

  await ich(A, JO, 'Jo');
  await bock(A, JO, 'kino-2', true, KINO);
  check(await meldung(weg(A, KIM, undefined, JO)) === 'nur der Gastgeber', 'Kim kann Jo nicht herausnehmen → „nur der Gastgeber“');
  check(await meldung(weg(A, KIM, ANDERER, TOBI)) === 'nur der Gastgeber', 'Tobi schon gar nicht – auch nicht mit irgendeinem Schlüssel');
  check(await meldung(weg(A, TOBI, undefined, JO)) === 'falscher Schlüssel', 'Tobi ohne Schlüssel auch nicht');
  s = await weg(A, TOBI, SCHLUESSEL, JO);
  check(s.rolle === 'gastgeber' && gleich(leute(s), [`${TOBI}:Tobias`, `${KIM}:Kim`]) && !reihe(s).some((r) => r.startsWith(JO)),
    'Tobi nimmt Jo heraus – mit allen seinen Häkchen');
  check(gleich(await weg(A, TOBI, SCHLUESSEL, NIEMAND), s), 'wer nicht drin ist, lässt sich ohne Fehler „herausnehmen“');
  check(await meldung(weg(B, JUERGEN, undefined, NIEMAND)) === 'nur der Gastgeber', 'in einem Raum ohne Schlüssel nimmt niemand jemanden heraus');

  const E = 'leer-wird-raum';
  await ich(E, TOBI, 'Tobi', SCHLUESSEL);
  await ich(E, KIM, 'Kim');
  await bock(E, TOBI, 'konzert-1', true, KONZERT, SCHLUESSEL);
  await bock(E, KIM, 'konzert-1', true, MIT);
  check(await meldung(weg(E, TOBI)) === 'falscher Schlüssel', 'ohne Schlüssel löst Tobi nichts auf');
  s = await weg(E, TOBI, SCHLUESSEL);
  const inE = 'select (select count(*) from freizeit_person where raum = $1) + (select count(*) from freizeit_bock where raum = $1) + (select count(*) from freizeit_gastgeber where raum = $1)';
  check(gleich(s, LEER) && await zaehle(inE, [raumVon(E)]) === 0, 'geht der Gastgeber, ist der Raum aufgelöst – mit Kim und allen Häkchen');
  check(gleich(await lesen(E, KIM), LEER), 'Kim ist dann Gast in einem leeren Raum');

  // In einem Raum ohne Schlüssel geht nur, wer geht; dann ist der Nächste vorn.
  const O = 'ohne-schl-raum';
  await ich(O, TOBI, 'Tobi');
  await ich(O, KIM, 'Kim');
  await su("update freizeit_person set angelegt = now() - interval '1 hour' where raum = $1 and person = $2", [raumVon(O), TOBI]);
  s = await weg(O, TOBI);
  check(gleich(s, { rolle: 'gast', personen: [{ id: 'gastgeber', name: 'Kim' }], bock: [] }),
    'ohne Schlüssel: geht der Erste, bleibt der Raum – Kim ist jetzt am längsten drin');
  check((await lesen(O, KIM)).rolle === 'gastgeber', '… und sieht als Gastgeberin alles');
  s = await weg(O, KIM);
  check(gleich(s, LEER) && await zaehle(inE, [raumVon(O)]) === 0, 'geht die letzte Person, ist der Raum ganz weg');

  // ------------------------------------------------------------------- Push
  const offen = () => rufe('freizeit_push_offen', {}, 'service_role');
  const fertig = (ids, tot) => rufe('freizeit_push_fertig', { p_ids: ids, p_tot: tot }, 'service_role');
  const nachrichten = (code = A) => su('select art, name, daten, gesendet is not null as gesendet from freizeit_nachricht where raum = $1 order by id', [raumVon(code)]);
  const abos = (code = A) => su('select person, endpunkt, abo from freizeit_push where raum = $1 order by angelegt, endpunkt', [raumVon(code)]);
  const kurz = (liste) => liste.map((n) => `${n.art}:${n.name}${n.daten ? `:${n.daten.eintrag}:${n.daten.mitwem || '-'}` : ''}`);
  // Jo tritt ein und hakt an, Kim wechselt – ohne Abo im Raum bleibt davon nichts liegen.
  await ich(A, JO, 'Jo');
  await bock(A, JO, 'kino-2', true, { ...KINO, mitwem: 'gastgeber' });
  check(!(await nachrichten()).length, 'ohne Abo im Raum sammelt die Datenbank keine Nachrichten');
  // Anmelden: nur der Gastgeber mit Schlüssel, nur mit einem brauchbaren Abo.
  await jeder([[A, KIM, null], [A, KIM, ANDERER], [B, JUERGEN, null], [A, NIEMAND, SCHLUESSEL]],
    ([code, wer, schluessel]) => push(code, wer, schluessel, ABO('x'), true), 'nur der Gastgeber',
    'push: Kim nicht, Jürgen im Raum ohne Schlüssel nicht, ein Fremder mit Tobis Schlüssel nicht');
  await jeder([null, ANDERER], (schluessel) => push(A, TOBI, schluessel, ABO('x'), true), 'falscher Schlüssel', 'push: Tobi ohne oder mit falschem Schlüssel');
  await jeder([null, '"x"', [], {}, { endpoint: 'http://unsicher.example.org/x', keys: ABO('x').keys }, { endpoint: ABO('x').endpoint },
    { endpoint: ABO('x').endpoint, keys: { p256dh: 'kurz', auth: 'a'.repeat(22) } }, { endpoint: ABO('x').endpoint, keys: { p256dh: ABO('x').keys.p256dh, auth: 'a'.repeat(50) } },
    ABO('x', { zusatz: 'z'.repeat(2000) })],
  (abo) => push(A, TOBI, SCHLUESSEL, abo, true), 'ungültiges Abo', 'push: kein Objekt, ohne Endpunkt, ohne https, kaputte Schlüssel, zu groß');
  let r = await push(A, TOBI, SCHLUESSEL, ABO('handy'), true);
  check(gleich(r, { push: true, geraete: 1 }) && (await abos()).length === 1 && gleich((await abos())[0].abo, ABO('handy')),
    'Tobi meldet sein Handy an – das Abo liegt vollständig in freizeit_push');
  r = await push(A, TOBI, SCHLUESSEL, ABO('handy', { keys: { p256dh: `BQ${'k'.repeat(85)}`, auth: 'b'.repeat(22) } }), true);
  check(gleich(r, { push: true, geraete: 1 }) && (await abos())[0].abo.keys.auth === 'b'.repeat(22), 'dasselbe Gerät nochmal: ersetzt, nicht doppelt');
  await push(A, TOBI, SCHLUESSEL, ABO('laptop'), true);
  for (const g of ['g3', 'g4', 'g5']) await push(A, TOBI, SCHLUESSEL, ABO(g), true);
  check(await meldung(push(A, TOBI, SCHLUESSEL, ABO('g6'), true)) === 'zu viele Geräte' && (await push(A, TOBI, SCHLUESSEL, ABO('g5'), true)).geraete === 5,
    'höchstens fünf Geräte je Raum – ein bekanntes darf sich trotzdem erneuern');
  for (const g of ['g3', 'g4', 'g5']) await push(A, TOBI, SCHLUESSEL, ABO(g), false);
  check(gleich(await push(A, TOBI, SCHLUESSEL, ABO('g5'), false), { push: false, geraete: 2 }), 'abmelden, auch doppelt: zwei Geräte bleiben');
  // Was gemeldet wird: eintreten, anhaken, „mit wem“ wechseln, „mit dir“ zurücknehmen, gehen – nichts vom Gastgeber selbst, nichts doppelt.
  await bock(A, TOBI, 'kino-2', true, KINO, SCHLUESSEL);
  await bock(A, TOBI, 'kino-2', false, null, SCHLUESSEL);
  await ich(A, KIM, 'Kim');
  check(!(await nachrichten()).length, 'Tobis eigene Häkchen und ein Umbenennen melden nichts');
  const GAST = 'gast-neu-0009';
  await ich(A, GAST, '  Neue Person ');
  await bock(A, KIM, 'kino-2', true, { ...KINO, mitwem: 'gastgeber' });
  await bock(A, KIM, 'kino-2', true, { ...KINO, mitwem: 'gastgeber' });
  await bock(A, KIM, 'kino-2', true, { ...KINO, mitwem: 'andere' });
  await bock(A, KIM, 'kino-2', false);
  await bock(A, KIM, 'konzert-1', true, { ...KONZERT, mitwem: 'andere' });
  await bock(A, KIM, 'konzert-1', false);
  await bock(A, JO, 'kino-2', false);
  await weg(A, GAST);
  let n = await nachrichten();
  check(gleich(kurz(n), ['neu:Neue Person', 'bock:Kim:kino-2:gastgeber', 'bock:Kim:kino-2:andere', 'bock:Kim:konzert-1:andere', 'aus:Jo:kino-2:gastgeber', 'weg:Neue Person']),
    `gemeldet: eintreten (Name wie gespeichert), anhaken, Wechsel zu „andere“, ein zurückgenommenes „mit dir“, gehen – nicht dasselbe nochmal, nicht ein zurückgenommenes „ohne dich“ (${kurz(n).join(' | ')})`);
  check(n.every((x) => !x.gesendet) && gleich(n[1].daten, { ...KINO, mitwem: 'gastgeber', eintrag: 'kino-2' }) && n[0].daten === null,
    'die Nachrichten sind offen; bei bock liegt der Schnappschuss samt eintrag und mitwem dabei, bei neu nichts');
  // Die Edge Function holt ab, nur mit dem Schlüssel des Betreibers.
  let liste = await offen();
  check(liste.length === 6 && liste.every((x) => Number.isInteger(x.id) && x.raum === raumVon(A) && ISO.test(x.angelegt) && x.abos.length === 2 && x.abos[0].endpoint === ABO('handy').endpoint)
    && liste[0].art === 'neu' && liste[5].art === 'weg' && gleich(liste[1].daten, n[1].daten),
    'push_offen: die sechs, mit id, Raum, Zeitpunkt und den beiden Abos des Raums, in der Reihenfolge des Entstehens');
  check(gleich(await offen(), []), 'gleich noch einmal: nichts – was geholt ist, gilt zwei Minuten als in Arbeit');
  await su("update freizeit_nachricht set geholt = geholt - interval '3 minutes' where raum = $1", [raumVon(A)]);
  check((await offen()).length === 6, 'nach zwei Minuten ohne Rückmeldung kommt es wieder');
  await fertig(liste.slice(0, 4).map((x) => x.id), [ABO('laptop').endpoint, 'https://push.example.org/send/unbekannt']);
  n = await nachrichten();
  check(n.slice(0, 4).every((x) => x.gesendet) && !n[4].gesendet && !n[5].gesendet && gleich((await abos()).map((x) => x.endpunkt), [ABO('handy').endpoint]),
    'push_fertig: vier zugestellt, zwei noch offen; ein totes Abo ist weg, ein unbekanntes stört nicht');
  await su("update freizeit_nachricht set angelegt = angelegt - interval '2 days', geholt = null where raum = $1 and gesendet is null", [raumVon(A)]);
  check(gleich(await offen(), []) && (await nachrichten()).every((x) => x.gesendet), 'älter als ein Tag: nicht mehr zuzustellen, gilt als erledigt');
  await su("update freizeit_nachricht set gesendet = gesendet - interval '8 days' where raum = $1", [raumVon(A)]);
  await ich(A, GAST, 'Gast');
  check(gleich(kurz(await nachrichten()), ['neu:Gast']), 'Zugestelltes älter als sieben Tage räumt die nächste Meldung weg');
  await su("update freizeit_nachricht set gesendet = null where raum = $1", [raumVon(A)]);
  for (let i = 0; i < 200; i++) await su('insert into freizeit_nachricht (raum, art, name) values ($1, $2, $3)', [raumVon(A), 'neu', `Stapel ${i}`]);
  await weg(A, GAST);
  check(await zaehle('select count(*) from freizeit_nachricht where raum = $1', [raumVon(A)]) === 201, 'bei 200 offenen Nachrichten im Raum wird nichts mehr gestapelt');
  await su('delete from freizeit_nachricht where raum = $1', [raumVon(A)]);
  await weg(A, JO);
  check(gleich(kurz(await nachrichten()), ['weg:Jo']), 'danach geht es weiter');
  await su('delete from freizeit_nachricht where raum = $1', [raumVon(A)]);
  // Löst der Gastgeber auf, sind Abos und Nachrichten mit weg.
  const P = 'push-raum-0001';
  await ich(P, TOBI, 'Tobi', SCHLUESSEL);
  await push(P, TOBI, SCHLUESSEL, ABO('p'), true);
  await ich(P, KIM, 'Kim');
  check((await nachrichten(P)).length === 1 && (await abos(P)).length === 1, 'ein zweiter Raum mit Abo sammelt für sich');
  await weg(P, TOBI, SCHLUESSEL);
  check(!(await abos(P)).length && !(await nachrichten(P)).length, 'aufgelöst: Abo und Nachrichten des Raums sind weg');
  check(gleich(await lesen(P, KIM), LEER), '… und Kim ist Gast in einem leeren Raum');
  // Das Schlüsselpaar der Edge Function: erst keins, dann das erste, das bleibt.
  const OEFF = `B${'o'.repeat(86)}`;
  const PRIV = 'p'.repeat(43);
  const paar = (o, pr) => rufe('freizeit_push_schluessel_setzen', { p_oeffentlich: o, p_privat: pr }, 'service_role');
  check((await rufe('freizeit_push_schluessel', {}, 'service_role')) === null, 'push_schluessel: anfangs keins');
  await jeder([['kurz', PRIV], [OEFF, 'kurz'], [`${OEFF}+`, PRIV], [OEFF, `${PRIV}=`]], ([o, pr]) => paar(o, pr), 'ungültiges Schlüsselpaar', 'setzen: nur 87 und 43 Zeichen base64url');
  check(gleich(await paar(OEFF, PRIV), { oeffentlich: OEFF, privat: PRIV }) && gleich(await rufe('freizeit_push_schluessel', {}, 'service_role'), { oeffentlich: OEFF, privat: PRIV }),
    'das erste Paar wird abgelegt und kommt zurück');
  check(gleich(await paar(`C${'x'.repeat(86)}`, 'q'.repeat(43)), { oeffentlich: OEFF, privat: PRIV }), 'ein zweites ersetzt es nicht – es gilt das erste');

  // ---------------------------------------------- der Code und der Schlüssel
  const gespeichert = (await su('select raum from freizeit_person union select raum from freizeit_bock union select raum from freizeit_gastgeber union select raum from freizeit_push union select raum from freizeit_nachricht'))
    .map((z) => z.raum).sort();
  check(gleich(gespeichert, [A, B, C, L].map(raumVon).sort()), 'in der Spalte raum steht SHA-256 über "freizeit:" + Code, klein, als Hex');
  const gefunden = [];
  for (const form of [A, B, C, L].flatMap((c) => [c, c.replaceAll('-', '')]).concat([SCHLUESSEL, ANDERER])) {
    const n = await zaehle(`select (select count(*) from freizeit_person t where strpos(lower(t::text), $1) > 0)
        + (select count(*) from freizeit_bock t where strpos(lower(t::text), $1) > 0)
        + (select count(*) from freizeit_gastgeber t where strpos(lower(t::text), $1) > 0)
        + (select count(*) from freizeit_push t where strpos(lower(t::text), $1) > 0)
        + (select count(*) from freizeit_nachricht t where strpos(lower(t::text), $1) > 0)`, [form]);
    if (n) gefunden.push(form);
  }
  check(!gefunden.length, `weder ein Code noch ein Schlüssel steht in einer Tabelle${gefunden.length ? ` – doch: ${gefunden.join(', ')}` : ''}`);

  // ----------------------------------------------------------- zweiter Lauf
  const zeilen = 'select (select count(*) from freizeit_person) + (select count(*) from freizeit_bock) + (select count(*) from freizeit_gastgeber)';
  const sichten = async () => [await alles(), await lesen(A, KIM), await lesen(B, JUERGEN), await lesen(C), await lesen(L, TOBI, SCHLUESSEL)];
  const vorDemLauf = await sichten();
  const zeilenVorher = await zaehle(zeilen);
  const zweiter = await fehler(einspielen());
  check(!zweiter, `die ganze Datei ein zweites Mal: läuft durch${zweiter ? ` – ${zweiter.message}` : ''}`);
  check(gleich(await sichten(), vorDemLauf) && await zaehle(zeilen) === zeilenVorher,
    'und alle Personen, Häkchen und Gastgeber sind noch da, unverändert');
  await rechtePruefen('nach dem zweiten Lauf');
  const PROBE = 'probe-0001';
  const F = 'frei-raum-0001';
  const hakt = [];
  try {
    if ((await ich(F, PROBE, 'Probe', SCHLUESSEL)).rolle !== 'gastgeber') hakt.push('ich');
    if ((await bock(F, PROBE, 'konzert-1', true, KONZERT, SCHLUESSEL)).bock.length !== 1) hakt.push('bock');
    if ((await lesen(F, PROBE, SCHLUESSEL)).bock.length !== 1) hakt.push('lesen');
    if (!gleich(await weg(F, PROBE, SCHLUESSEL), LEER)) hakt.push('weg');
  } catch (e) {
    hakt.push(e.message);
  }
  check(!hakt.length, `nach dem zweiten Lauf: anon kann alle vier aufrufen – ich, bock, lesen, weg${hakt.length ? ` – nicht: ${hakt.join(', ')}` : ''}`);
}

try {
  await pruefen();
} catch (e) {
  check(false, `unerwarteter Fehler: ${e.stack || e.message}`);
}
await db.close();
console.log(`${fails ? 'FEHLER' : 'Alles gut'}: ${oks} von ${oks + fails} Prüfungen bestanden.`);
process.exit(fails || !oks ? 1 : 0);
