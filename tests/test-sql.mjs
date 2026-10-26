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
 * Die Datei läuft dann wie im SQL Editor als ein Block, und zwar als Rolle
 * „besitzer“: ohne Superuser-Rechte, wie dort die Rolle postgres. Danach ruft
 * der Test die Funktionen als anon auf, so wie die App mit dem öffentlichen
 * Schlüssel. In die Tabellen greift er nur als Superuser – um eine Grenze
 * schnell zu erreichen, ein Häkchen altern zu lassen oder nachzusehen, was
 * wirklich gespeichert ist.
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

const DATEI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'gemeinsam.sql');

let fails = 0;
let oks = 0;
const check = (c, m) => {
  console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`);
  if (c) oks++; else fails++;
};

// Die vier Funktionen, wie die App sie aufruft. Die Namen der Parameter
// zählen mit: PostgREST ruft mit Namen auf.
const SIGNATUR = {
  freizeit_ich: 'p_code text, p_person text, p_name text',
  freizeit_lesen: 'p_code text',
  freizeit_bock: 'p_code text, p_person text, p_eintrag text, p_bock boolean, p_daten jsonb',
  freizeit_weg: 'p_code text, p_person text',
};
const VIER = Object.keys(SIGNATUR).sort();
const typen = (name) => SIGNATUR[name].split(', ').map((p) => p.split(' ')[1]);

const A = 'abcd-efgh-jkmn';
const B = 'wxyz-2345-6789';
const C = 'pqrs-tuvw-xyz2';
const TOBI = 'tobi-0001-aaaa';
const AMY = 'amy-0002-bbbb';
const NIEMAND = 'nie-da-0000';
const LEER = { personen: [], bock: [] };
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
/** Was in der Spalte raum stehen muss: SHA-256 über "freizeit:" + Code, klein, als Hex. */
const raumVon = (code) => createHash('sha256').update(`freizeit:${code.toLowerCase()}`, 'utf8').digest('hex');

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

/** Die ganze Datei als ein Block, wie im SQL Editor – als Besitzer. */
async function einspielen() {
  await db.exec('set role besitzer');
  try {
    await db.exec(SQL);
  } finally {
    await db.exec('reset role');
  }
}

/**
 * Ruft eine der vier Funktionen auf, wie die App es tut: als anon. Ein
 * jsonb-Wert geht als JSON-Text hinüber – ein Objekt wird dafür zu JSON, eine
 * Zeichenkette ist schon JSON ('null', '[1]', '"x"'), null bleibt SQL-null.
 */
async function rufe(name, werte, rolle = 'anon') {
  const t = typen(name);
  const platz = t.map((typ, i) => `$${i + 1}::${typ === 'jsonb' ? 'text::jsonb' : typ}`);
  const roh = werte.map((w, i) => (t[i] === 'jsonb' && w !== null && typeof w !== 'string' ? JSON.stringify(w) : w));
  const [zeile] = await als(rolle, `select ${name}(${platz.join(', ')}) as stand`, roh);
  return zeile.stand;
}
const ich = (code, person, name) => rufe('freizeit_ich', [code, person, name]);
const lesen = (code) => rufe('freizeit_lesen', [code]);
const bock = (code, person, eintrag, an, daten = null) => rufe('freizeit_bock', [code, person, eintrag, an, daten]);
const weg = (code, person) => rufe('freizeit_weg', [code, person]);

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
const zaehle = async (sql, werte) => (await su(`select (${sql})::int as n`, werte))[0].n;

/** Wer was darf – nach jedem Lauf der Datei dasselbe. */
async function rechtePruefen(wann) {
  const f = await su(`select p.proname as name,
        has_function_privilege('anon', p.oid, 'execute') as anon,
        has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
        has_function_privilege('fremd', p.oid, 'execute') as fremd
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'freizeit%'`);
  const anon = f.filter((x) => x.anon).map((x) => x.name).sort();
  check(gleich(anon, VIER), `${wann}: anon darf genau die vier Funktionen ausführen (${anon.join(', ')})`);
  const sonst = f.filter((x) => x.authenticated || x.fremd).map((x) => x.name);
  check(!sonst.length, `${wann}: authenticated und public dürfen keine der ${f.length} freizeit-Funktionen ausführen`
    + `${sonst.length ? ` – doch: ${sonst.join(', ')}` : ''}`);

  const RECHTE = 'select, insert, update, delete, truncate, references, trigger';
  const t = await su(`select t.name,
        has_table_privilege('anon', t.name, '${RECHTE}')
        or has_table_privilege('authenticated', t.name, '${RECHTE}')
        or has_table_privilege('fremd', t.name, '${RECHTE}') as irgendwer
      from unnest(array['freizeit_person', 'freizeit_bock']) as t(name)`);
  check(t.length === 2 && t.every((x) => !x.irgendwer), `${wann}: auf die Tabellen hat weder anon noch authenticated noch public ein Recht`);
  for (const tabelle of ['freizeit_person', 'freizeit_bock']) {
    const e = await fehler(als('anon', `select * from ${tabelle}`));
    check(verweigert(e), `${wann}: anon – select * from ${tabelle} → ${e ? e.message : 'ging durch'}`);
  }
  const schreiben = [
    "insert into freizeit_person (raum, person, name) values ('x', 'eindringling', 'x')",
    'update freizeit_bock set daten = null',
    'delete from freizeit_person',
  ];
  const durch = [];
  for (const sql of schreiben) if (!verweigert(await fehler(als('anon', sql)))) durch.push(sql.split(' ')[0]);
  check(!durch.length, `${wann}: anon kann auch nicht hineinschreiben${durch.length ? ` – doch: ${durch.join(', ')}` : ''}`);

  const beispiel = {
    freizeit_ich: [A, TOBI, 'Tobi'],
    freizeit_lesen: [A],
    freizeit_bock: [A, TOBI, 'konzert-1', false, null],
    freizeit_weg: [A, NIEMAND],
  };
  const auth = [];
  for (const name of VIER) if (!verweigert(await fehler(rufe(name, beispiel[name], 'authenticated')))) auth.push(name);
  check(!auth.length, `${wann}: authenticated darf keine der vier aufrufen${auth.length ? ` – doch: ${auth.join(', ')}` : ''}`);
  const helfer = [];
  for (const name of ['freizeit_raum', 'freizeit_stand']) {
    if (!verweigert(await fehler(als('anon', `select ${name}($1::text)`, [A])))) helfer.push(name);
  }
  check(!helfer.length, `${wann}: anon kommt an die Helfer freizeit_raum und freizeit_stand nicht heran`
    + `${helfer.length ? ` – doch: ${helfer.join(', ')}` : ''}`);
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

  // ------------------------------------------------------------ einspielen
  const erster = await fehler(einspielen());
  check(!erster, `gemeinsam.sql läuft als Besitzer ohne Superuser-Rechte durch${erster ? ` – ${erster.message}` : ''}`);
  if (erster) return;

  // ----------------------------------------------------------------- Aufbau
  const tabellen = await su(`select c.relname as name, c.relrowsecurity as rls from pg_class c
     where c.relkind = 'r' and c.relname in ('freizeit_person', 'freizeit_bock')`);
  check(tabellen.length === 2 && tabellen.every((t) => t.rls), 'beide Tabellen da, Row Level Security an');
  check(await zaehle("select count(*) from pg_policies where tablename in ('freizeit_person', 'freizeit_bock')") === 0,
    'keine einzige Regel (Policy) – herein kommt man nur über die Funktionen');
  const funktionen = await su(`select p.proname as name, pg_get_function_arguments(p.oid) as args,
        p.prorettype::regtype::text as rueckgabe, l.lanname as sprache, p.prosecdef as definer, p.proconfig as config
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_language l on l.oid = p.prolang
     where n.nspname = 'public' and p.proname like 'freizeit%'`);
  for (const [name, args] of Object.entries(SIGNATUR)) {
    const f = funktionen.filter((x) => x.name === name);
    check(f.length === 1 && f[0].args === args && f[0].rueckgabe === 'jsonb' && f[0].sprache === 'plpgsql'
      && f[0].definer && (f[0].config || []).includes('search_path=public, pg_temp'),
    `${name}(${args}) returns jsonb – plpgsql, security definer, search_path = public, pg_temp`);
  }
  await rechtePruefen('nach dem ersten Lauf');

  // -------------------------------------------------------------- Eintreten
  check(gleich(await lesen(A), LEER), 'lesen: ein Raum, in dem noch niemand ist, ist leer ({"personen": [], "bock": []}) – kein Fehler');
  let s = await ich(A, TOBI, 'Tobi');
  check(gleich(s, { personen: [{ id: TOBI, name: 'Tobi' }], bock: [] }), 'ich: Tobi tritt ein, zurück kommt der Stand des Raums');
  s = await ich(A, AMY, '  Amy ');
  check(gleich(s.personen, [{ id: TOBI, name: 'Tobi' }, { id: AMY, name: 'Amy' }]), 'ich: Amy tritt in denselben Raum ein – aus „  Amy “ wird „Amy“');
  check(gleich(await lesen(A), { personen: [{ id: TOBI, name: 'Tobi' }, { id: AMY, name: 'Amy' }], bock: [] }),
    'lesen: beide mit Namen, in der Reihenfolge des Eintretens');
  s = await ich(A, TOBI, 'Tobias');
  check(gleich(s.personen, [{ id: TOBI, name: 'Tobias' }, { id: AMY, name: 'Amy' }]), 'ich: Umbenennen – aus Tobi wird Tobias, er bleibt vorn');
  check(await zaehle('select count(*) from freizeit_person where raum = $1', [raumVon(A)]) === 2, 'Umbenennen legt niemanden doppelt an');
  check(gleich(await lesen('ABCD-EFGH-JKMN'), await lesen(A)), 'Großbuchstaben: ABCD-EFGH-JKMN ist derselbe Raum wie abcd-efgh-jkmn');
  s = await ich('AbCd-EfGh-JkMn', AMY, 'Amy');
  check(gleich(s.personen.map((p) => p.id), [TOBI, AMY]), 'ich in gemischter Schreibweise: Amy ist schon da, niemand kommt dazu');
  check(gleich(await lesen('abcdefghjkmn'), LEER), 'ohne Bindestriche ist es ein anderer Raum – die Bindestriche gehen mit in den Hash');
  check(gleich(await lesen(B), LEER), 'ein anderer Code sieht vom ersten Raum nichts');
  const JUERGEN = randomUUID();
  s = await ich(B, JUERGEN, 'Jürgen 🎸');
  check(gleich(s, { personen: [{ id: JUERGEN, name: 'Jürgen 🎸' }], bock: [] }), 'Raum B: eine UUID als Person, Umlaut und Emoji im Namen');
  check(gleich((await lesen(A)).personen.map((p) => p.id), [TOBI, AMY]), 'Raum A bleibt davon unberührt');
  const GUELTIG = ['abcd-efgh-jkmn-pqrs-tuvw', 'abcdefghjkmnpqrstuvw', 'abcd-efgh-jkmn-pqrs', '0000-0000-0000', 'abcdefgh-jkmn'];
  const abgelehnt = [];
  for (const c of GUELTIG) if (!gleich(await lesen(c).catch((e) => e.message), LEER)) abgelehnt.push(c);
  check(!abgelehnt.length, `auch gültig: drei bis fünf Vierergruppen, Bindestriche nach Belieben${abgelehnt.length ? ` – abgelehnt: ${abgelehnt.join(', ')}` : ''}`);

  // ---------------------------------------------------------------- Häkchen
  const KONZERT = {
    titel: 'Konzert „Schöne Aussicht“', tag: '2026-11-02', zeit: '19:30',
    ort: { name: 'Övelgönne', region: 'HH' }, merkmale: ['draußen', 'kostenlos'], preis: 0, ganztags: false,
  };
  const KINO = { titel: 'Kino lang', tag: '2026-11-04', zeit: '19:00' };
  s = await bock(A, TOBI, 'konzert-1', true, KONZERT);
  check(s.bock.length === 1 && s.bock[0].person === TOBI && s.bock[0].eintrag === 'konzert-1' && gleich(s.bock[0].daten, KONZERT),
    'bock: Tobi setzt ein Häkchen, daten kommen unverändert zurück');
  check(gleich(Object.keys(s.bock[0]).sort(), ['daten', 'eintrag', 'geaendert', 'person']), 'ein Häkchen hat genau person, eintrag, daten, geaendert');
  const zeit = s.bock[0].geaendert;
  check(ISO.test(zeit) && Math.abs(Date.parse(zeit) - Date.now()) < 60000, `geaendert ist ISO-Text in UTC wie toISOString() (${zeit})`);
  await db.exec("set timezone = 'Pacific/Kiritimati'");
  const zeitKiritimati = (await lesen(A)).bock[0].geaendert;
  await db.exec("set timezone = 'America/Los_Angeles'");
  const zeitLosAngeles = (await lesen(A)).bock[0].geaendert;
  await db.exec('reset timezone');
  check(zeitKiritimati === zeit && zeitLosAngeles === zeit, 'geaendert hängt nicht von der Zeitzone der Sitzung ab');

  await bock(A, AMY, 'konzert-1', true, KONZERT);
  s = await bock(A, TOBI, 'kino-2', true, KINO);
  check(gleich(reihe(s), [`${TOBI}/konzert-1`, `${AMY}/konzert-1`, `${TOBI}/kino-2`]), 'beide haken an, auch denselben Termin – Reihenfolge nach geaendert');
  check(gleich(await lesen(A), s), 'lesen zeigt genau das');
  const [{ t: davor }] = await su("select geaendert::text as t from freizeit_bock where raum = $1 and person = $2 and eintrag = 'konzert-1'", [raumVon(A), TOBI]);
  const SPAETER = { ...KONZERT, zeit: '20:00' };
  s = await bock(A, TOBI, 'konzert-1', true, SPAETER);
  const [{ neuer }] = await su("select geaendert > $3::timestamptz as neuer from freizeit_bock where raum = $1 and person = $2 and eintrag = 'konzert-1'",
    [raumVon(A), TOBI, davor]);
  check(s.bock.length === 3 && gleich(s.bock.find((b) => b.person === TOBI && b.eintrag === 'konzert-1')?.daten, SPAETER) && neuer,
    'nochmal setzen ersetzt daten und erneuert geaendert – ein zweites Häkchen gibt es nicht');
  check(gleich(reihe(s), [`${AMY}/konzert-1`, `${TOBI}/kino-2`, `${TOBI}/konzert-1`]), 'das erneuerte Häkchen rückt ans Ende');
  s = await bock(A, TOBI, 'kino-2', false);
  check(gleich(reihe(s), [`${AMY}/konzert-1`, `${TOBI}/konzert-1`]), 'bock mit false: das Häkchen ist weg');
  check(gleich(await bock(A, TOBI, 'kino-2', false), s), 'ein Häkchen wegnehmen, das es nicht gibt, ist kein Fehler');
  await bock(A, TOBI, 'nur-kurz', true, {});
  s = await bock(A, TOBI, 'nur-kurz', null);
  check(!reihe(s).includes(`${TOBI}/nur-kurz`), 'bock mit null nimmt weg wie false');
  s = await bock(A, TOBI, 'ohne-daten', true, null);
  check(s.bock.find((b) => b.eintrag === 'ohne-daten')?.daten === null, 'daten dürfen fehlen – dann steht dort null');
  s = await bock(A, TOBI, 'json-null', true, 'null');
  check(s.bock.find((b) => b.eintrag === 'json-null')?.daten === null
    && await zaehle("select count(*) from freizeit_bock where eintrag = 'json-null' and daten is null") === 1,
  'JSON-null als daten zählt wie fehlende daten');
  await bock(A, TOBI, 'ohne-daten', false);
  await bock(A, TOBI, 'json-null', false);
  check(await meldung(bock(A, NIEMAND, 'konzert-1', true, KONZERT)) === 'unbekannte Person', 'bock für jemanden, der nicht im Raum ist → „unbekannte Person“');
  check(await meldung(bock(A, NIEMAND, 'konzert-1', false)) === 'unbekannte Person', 'auch beim Wegnehmen → „unbekannte Person“');
  check(await meldung(bock(B, TOBI, 'konzert-1', true, KONZERT)) === 'unbekannte Person', 'Tobi ist in Raum B unbekannt → „unbekannte Person“');
  check(gleich(await lesen(B), { personen: [{ id: JUERGEN, name: 'Jürgen 🎸' }], bock: [] }), 'Raum B sieht keins der Häkchen aus Raum A');

  // -------------------------------------------------------------- Prüfungen
  const FALSCHE_CODES = [null, '', 'abcd', 'abcd-efgh', 'abcdefgh', 'abcd-efgh-jkm', 'abcd-efgh-jkmnp', 'abc-defgh-jkmn',
    'abcd-efgh-jkmn-pqrs-tuvw-xyz2', 'abcdefghjkmnpqrstuvwxyz2', 'abcd--efgh-jkmn', '-abcd-efgh-jkmn', 'abcd-efgh-jkmn-',
    ' abcd-efgh-jkmn', 'abcd-efgh-jkmn ', 'abcd-efgh-jkmn\n', 'abcd_efgh_jkmn', 'abcd efgh jkmn', 'äbcd-efgh-jkmn', 'abcd-efgh-jkmñ'];
  await jeder(FALSCHE_CODES, (c) => lesen(c), 'ungültiger Code', `lesen: ${FALSCHE_CODES.length} falsche Codes`);
  await jeder([null, 'abcd'], (c) => ich(c, TOBI, 'Tobi'), 'ungültiger Code', 'ich: falscher Code');
  await jeder([null, 'abcd'], (c) => bock(c, TOBI, 'konzert-1', true, {}), 'ungültiger Code', 'bock: falscher Code');
  await jeder([null, 'abcd'], (c) => weg(c, TOBI), 'ungültiger Code', 'weg: falscher Code');

  const FALSCHE_PERSONEN = [null, '', 'kurz-12', 'x'.repeat(41), 'Tobi-0001-aaaa', 'tobi_0001_aaaa', 'tobi 0001 aaaa',
    'tobi-0001-aaaa\n', 'tobi-0001-äaaa'];
  await jeder(FALSCHE_PERSONEN, (p) => ich(C, p, 'Wer'), 'ungültige Person', `ich: ${FALSCHE_PERSONEN.length} falsche Personen`);
  await jeder(FALSCHE_PERSONEN, (p) => bock(A, p, 'konzert-1', true, {}), 'ungültige Person', 'bock: dieselben falschen Personen');
  await jeder(FALSCHE_PERSONEN, (p) => weg(A, p), 'ungültige Person', 'weg: dieselben falschen Personen');
  const ACHT = 'acht-123';
  const VIERZIG = '4'.repeat(40);
  await ich(C, ACHT, 'Acht');
  s = await ich(C, VIERZIG, 'Vierzig');
  check(gleich(s.personen.map((p) => p.id), [ACHT, VIERZIG]), 'Personen mit 8 und mit 40 Zeichen gehen');

  const FALSCHE_NAMEN = [null, '', '   ', 'x'.repeat(31), `  ${'x'.repeat(31)}  `, 'ä'.repeat(31)];
  await jeder(FALSCHE_NAMEN, (n) => ich(C, ACHT, n), 'Name fehlt oder ist zu lang', `ich: ${FALSCHE_NAMEN.length} falsche Namen`);
  check((await lesen(C)).personen[0].name === 'Acht', 'ein abgelehnter Name ändert nichts');
  s = await ich(C, ACHT, `  ${'ä'.repeat(30)}  `);
  check(s.personen[0].name === 'ä'.repeat(30), 'ein Name mit 30 Zeichen geht – gezählt ohne die Leerzeichen am Rand');

  await jeder([null, '', 'e'.repeat(201)], (e) => bock(A, TOBI, e, true, {}), 'ungültiger Eintrag', 'bock: Eintrag null, leer oder mit 201 Zeichen');
  s = await bock(A, TOBI, 'e'.repeat(200), true, {});
  check(reihe(s).includes(`${TOBI}/${'e'.repeat(200)}`), 'ein Eintrag mit 200 Zeichen geht');
  await bock(A, TOBI, 'e'.repeat(200), false);

  // {"x": "aaa…"} – neun Zeichen drumherum, so schreibt Postgres jsonb als Text.
  const mitLaenge = (n, zeichen = 'a') => ({ x: zeichen.repeat(n - 9) });
  const laenge = await zaehle('select length($1::text::jsonb::text)', [JSON.stringify(mitLaenge(2000))]);
  await jeder(['[1, 2]', '"Konzert"', '5', 'true', mitLaenge(2001)], (d) => bock(A, TOBI, 'gross', true, d), 'Eintrag zu groß',
    'bock: daten als Liste, Text, Zahl, true oder mit 2001 Zeichen');
  s = await bock(A, TOBI, 'gross', true, mitLaenge(2000));
  check(laenge === 2000 && gleich(s.bock.find((b) => b.eintrag === 'gross')?.daten, mitLaenge(2000)), 'daten mit genau 2000 Zeichen gehen');
  // Gezählt wird in Bytes: Ein Umlaut sind in UTF-8 zwei. mitLaenge(1004, 'ä')
  // sind 9 Zeichen Rahmen plus 995 Umlaute = 1999 Byte, eins mehr wären 2001.
  s = await bock(A, TOBI, 'gross', true, mitLaenge(1004, 'ä'));
  check(gleich(s.bock.find((b) => b.eintrag === 'gross')?.daten, mitLaenge(1004, 'ä')),
    'gezählt wird in Bytes: 995 Umlaute (1999 Byte) gehen');
  await jeder([mitLaenge(1005, 'ä'), mitLaenge(2000, 'ä')], (d) => bock(A, TOBI, 'gross', true, d), 'Eintrag zu groß',
    'bock: daten über 2000 Byte, auch wenn es weniger als 2000 Zeichen sind');
  await jeder(['ü'.repeat(101)], (e) => bock(A, TOBI, e, true, {}), 'ungültiger Eintrag', 'bock: Eintrag mit 202 Byte (101 Umlaute)');
  s = await bock(A, TOBI, 'ü'.repeat(100), true, {});
  check(reihe(s).includes(`${TOBI}/${'ü'.repeat(100)}`), 'ein Eintrag mit genau 200 Byte (100 Umlaute) geht');
  await bock(A, TOBI, 'ü'.repeat(100), false);
  await bock(A, TOBI, 'gross', false);

  // ---------------------------------------------------------------- Grenzen
  const GAESTE = ['gast-0003-cccc', 'gast-0004-dddd', 'gast-0005-eeee', 'gast-0006-ffff'];
  for (const gast of GAESTE) s = await ich(A, gast, `Gast ${gast.slice(5, 9)}`);
  check(s.personen.length === 6, 'sechs Personen passen in einen Raum');
  check(await meldung(ich(A, 'gast-0007-gggg', 'Sieben')) === 'Raum ist voll', 'die siebte → „Raum ist voll“');
  s = await ich(A, GAESTE[0], 'Umbenannt');
  check(s.personen.length === 6 && s.personen.find((p) => p.id === GAESTE[0])?.name === 'Umbenannt', 'Umbenennen geht auch im vollen Raum');
  check((await ich(A, TOBI, 'Tobias')).personen.length === 6, 'und wer schon drin ist, kommt wieder herein');
  for (const gast of GAESTE) s = await weg(A, gast);
  check(gleich(s.personen.map((p) => p.id), [TOBI, AMY]), 'die Gäste gehen wieder');

  const vorhanden = (await lesen(A)).bock.length;
  await su("insert into freizeit_bock (raum, person, eintrag) select $1, $2, 'fuell-' || i from generate_series(1, $3::int) as i",
    [raumVon(A), TOBI, 2999 - vorhanden]);
  s = await bock(A, AMY, 'nr-3000', true, {});
  check(s.bock.length === 3000, 'das 3000. Häkchen im Raum geht noch');
  check(await meldung(bock(A, AMY, 'nr-3001', true, {})) === 'zu viele Häkchen', 'das 3001. → „zu viele Häkchen“');
  check(await meldung(bock(A, TOBI, 'nr-3001', true, {})) === 'zu viele Häkchen', 'die Grenze gilt für den Raum, nicht je Person');
  s = await bock(A, AMY, 'nr-3000', true, { neu: true });
  check(s.bock.length === 3000 && gleich(s.bock.find((b) => b.eintrag === 'nr-3000')?.daten, { neu: true }),
    'ein vorhandenes Häkchen neu setzen geht auch an der Grenze');
  await bock(A, AMY, 'nr-3000', false);
  s = await bock(A, AMY, 'nr-3001', true, {});
  check(s.bock.length === 3000, 'nach dem Wegnehmen ist wieder Platz');
  await su("delete from freizeit_bock where eintrag like 'fuell-%' or eintrag = 'nr-3001'");

  // Die Grenze für den ganzen Server. Aufgefüllt wird als Superuser in zehn
  // Füllräumen mit je höchstens 3000 Häkchen – so, wie es auch über die App ginge.
  const alleHaekchen = () => zaehle('select count(*) from freizeit_bock');
  const vorDerFuellung = await alleHaekchen();
  await su(`insert into freizeit_person (raum, person, name)
      select encode(sha256(convert_to('fuell-h:' || r, 'UTF8')), 'hex'), 'fuell-person', 'Füllung' from generate_series(1, 10) as r`);
  await su(`insert into freizeit_bock (raum, person, eintrag)
      select encode(sha256(convert_to('fuell-h:' || (1 + i % 10), 'UTF8')), 'hex'), 'fuell-person', 'fuell-' || i
        from generate_series(1, $1::int) as i`, [29999 - vorDerFuellung]);
  s = await bock(A, AMY, 'nr-30000', true, KINO);
  check(s.bock.some((b) => b.eintrag === 'nr-30000') && await alleHaekchen() === 30000, 'das 30000. Häkchen auf dem Server geht noch');
  check(await meldung(bock(A, AMY, 'nr-30001', true, {})) === 'Server voll', 'das 30001. → „Server voll“');
  check(await meldung(bock(B, JUERGEN, 'nr-30001', true, {})) === 'Server voll', 'die Grenze gilt für alle Räume zusammen – auch in Raum B');
  s = await bock(A, AMY, 'nr-30000', true, KONZERT);
  check(gleich(s.bock.find((b) => b.eintrag === 'nr-30000')?.daten, KONZERT) && await alleHaekchen() === 30000,
    'ein vorhandenes Häkchen neu setzen geht auch auf dem vollen Server');
  s = await bock(A, AMY, 'nr-30000', false);
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
  s = await ich(R100, TOBI, 'Tobi');
  check(s.personen.length === 1 && await raeume() === 100, 'der 100. Raum geht noch');
  check(await meldung(ich(R101, TOBI, 'Tobi')) === 'zu viele Räume', 'der 101. → „zu viele Räume“');
  check(await raeume() === 100, 'der abgelehnte Raum ist auch nicht halb angelegt');
  s = await ich(B, 'neu-in-b-0001', 'Neu');
  check(s.personen.length === 2, 'in einen Raum, den es schon gibt, kommt man trotzdem');
  check(gleich(await lesen(R101), LEER), 'lesen geht auch dann – und legt keinen Raum an');
  await weg(B, 'neu-in-b-0001');
  await weg(R100, TOBI);
  await su("delete from freizeit_person where person = 'fuell-person'");

  // --------------------------------------------------------------- 400 Tage
  await bock(A, TOBI, 'alt-399', true, {});
  await bock(A, AMY, 'alt-401', true, {});
  await bock(B, JUERGEN, 'alt-500', true, {});
  await su("update freizeit_bock set geaendert = now() - interval '399 days' where eintrag = 'alt-399'");
  await su("update freizeit_bock set geaendert = now() - interval '401 days' where eintrag = 'alt-401'");
  await su("update freizeit_bock set geaendert = now() - interval '500 days' where eintrag = 'alt-500'");
  const gibt = (eintrag) => zaehle('select count(*) from freizeit_bock where eintrag = $1', [eintrag]);
  s = await bock(A, TOBI, 'frisch', true, {});
  check(!s.bock.some((b) => b.eintrag === 'alt-401') && await gibt('alt-401') === 0,
    'nach 401 Tagen löscht der nächste bock im Raum das Häkchen – auch das eines anderen');
  check(s.bock.some((b) => b.eintrag === 'alt-399') && s.bock.some((b) => b.eintrag === 'frisch'), 'nach 399 Tagen bleibt es noch');
  check(await gibt('alt-500') === 1, 'aufgeräumt wird nur der eigene Raum');
  s = await bock(B, JUERGEN, 'gibt-es-nicht', false);
  check(!s.bock.length && await gibt('alt-500') === 0, 'aufgeräumt wird auch beim Wegnehmen');
  await bock(A, TOBI, 'alt-399', false);

  // ------------------------------------------------------------------ Gehen
  s = await lesen(A);
  const tobis = s.bock.filter((b) => b.person === TOBI);
  check(s.bock.some((b) => b.person === AMY) && tobis.length > 0, 'vor dem Gehen haben beide Häkchen');
  s = await weg(A, AMY);
  check(gleich(s.personen, [{ id: TOBI, name: 'Tobias' }]), 'weg: Amy ist nicht mehr im Raum');
  check(gleich(s.bock, tobis), 'weg: Amys Häkchen sind weg, Tobis bleiben, wie sie waren');
  check(await zaehle('select (select count(*) from freizeit_person where person = $1) + (select count(*) from freizeit_bock where person = $1)', [AMY]) === 0,
    'von Amy steht nichts mehr in den Tabellen');
  check(gleich(await weg(A, AMY), s), 'nochmal gehen ist kein Fehler');
  check(gleich(await weg(A, NIEMAND), s), 'wer nie da war, kann auch gehen – kein Fehler');
  const E = 'leer-wird-raum';
  await ich(E, TOBI, 'Tobi');
  await bock(E, TOBI, 'konzert-1', true, KONZERT);
  s = await weg(E, TOBI);
  check(gleich(s, LEER) && await zaehle('select (select count(*) from freizeit_person where raum = $1) + (select count(*) from freizeit_bock where raum = $1)',
    [raumVon(E)]) === 0, 'geht die letzte Person, ist der Raum ganz weg');
  // Amy kommt zurück – für den zweiten Lauf unten.
  await ich(A, AMY, 'Amy');
  await bock(A, AMY, 'konzert-1', true, KONZERT);

  // --------------------------------------------------------------- der Code
  const gespeichert = (await su('select raum from freizeit_person union select raum from freizeit_bock')).map((z) => z.raum).sort();
  check(gleich(gespeichert, [A, B, C].map(raumVon).sort()), 'in der Spalte raum steht SHA-256 über "freizeit:" + Code, klein, als Hex');
  const gefunden = [];
  for (const form of [A, B, C].flatMap((c) => [c, c.replaceAll('-', '')])) {
    const n = await zaehle(`select (select count(*) from freizeit_person t where strpos(lower(t::text), $1) > 0)
        + (select count(*) from freizeit_bock t where strpos(lower(t::text), $1) > 0)`, [form]);
    if (n) gefunden.push(form);
  }
  check(!gefunden.length, `kein Code steht in einer Tabelle – auch nicht groß oder ohne Bindestriche${gefunden.length ? ` – doch: ${gefunden.join(', ')}` : ''}`);

  // ----------------------------------------------------------- zweiter Lauf
  const alles = 'select (select count(*) from freizeit_person) + (select count(*) from freizeit_bock)';
  const vorher = [await lesen(A), await lesen(B), await lesen(C)];
  const zeilenVorher = await zaehle(alles);
  const zweiter = await fehler(einspielen());
  check(!zweiter, `die ganze Datei ein zweites Mal: läuft durch${zweiter ? ` – ${zweiter.message}` : ''}`);
  check(gleich([await lesen(A), await lesen(B), await lesen(C)], vorher) && await zaehle(alles) === zeilenVorher,
    'und alle Personen und Häkchen sind noch da, unverändert');
  await rechtePruefen('nach dem zweiten Lauf');
  const PROBE = 'probe-0001';
  const F = 'frei-raum-0001';
  const hakt = [];
  try {
    if (!gleich((await ich(F, PROBE, 'Probe')).personen, [{ id: PROBE, name: 'Probe' }])) hakt.push('ich');
    if ((await bock(F, PROBE, 'konzert-1', true, KONZERT)).bock.length !== 1) hakt.push('bock');
    if ((await lesen(F)).bock.length !== 1) hakt.push('lesen');
    if (!gleich(await weg(F, PROBE), LEER)) hakt.push('weg');
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
