-- Die gemeinsamen Häkchen – wer hat wozu Bock? Drei Tabellen, vier Funktionen –
-- und, damit der Gastgeber Bescheid bekommt, drei Tabellen und eine fünfte
-- Funktion für Push-Nachrichten (unten, PUSH).
--
--   Wo:  Supabase → SQL Editor → einfügen → Run
--   Wer: der Betreiber. Der Block ist wiederholbar – ein weiterer Lauf legt
--        nichts doppelt an und löscht weder Personen noch Häkchen. Das gilt
--        auch über der ersten Fassung (zwei Tabellen, jeder sah alles): Was
--        dort steht, bleibt, und wer einen Raum begonnen hat, wird beim
--        nächsten Öffnen der App sein Gastgeber.
--
-- Ob er tut, was die App erwartet, prüft tests/test-sql.mjs – mit einem
-- echten Postgres im Testprozess (PGlite), ohne Supabase.
--
-- WORUM ES GEHT
--
-- Einer lädt ein – der Gastgeber –, die anderen haken in der App an, wozu sie
-- Bock haben: mit ihm oder ohne ihn. Das steht in den daten des Häkchens; der
-- Server schaut nicht hinein. Zusammen gehören alle über einen Raumcode, etwa
-- „abcd-efgh-jkmn“. Wer den Code hat, kann eintreten – Konten gibt es keine.
-- Einen Raum gibt es, sobald eine Person darin ist.
--
-- Wer was sieht:
--
--   der Gastgeber       alle im Raum und alle Häkchen
--   jeder andere        den Gastgeber und sich selbst, mit den Häkchen der
--                       beiden – von den übrigen nichts, nicht einmal, dass
--                       es sie gibt
--   wer nicht drin ist  nur den Namen des Gastgebers (für die Einladung)
--
-- Gastgeber ist, wer den Raum anlegt und dabei einen Schlüssel mitschickt.
-- Der Server behält nur dessen Hash. Ohne den Schlüssel kommt niemand an die
-- Sicht des Gastgebers oder setzt Häkchen in seinem Namen – auch nicht, wer
-- seine Kennung kennt. Die anderen sehen ihn ohnehin nur unter der Kennung
-- 'gastgeber'; die Kennungen der anderen kennt allein der Gastgeber, und mit
-- ihnen kann er jemanden aus dem Raum nehmen. Geht der Gastgeber selbst, ist
-- der Raum aufgelöst – mit allen Personen und Häkchen.
--
-- In einem Raum ohne Schlüssel (aus der ersten Fassung) gilt als Gastgeber,
-- wer am längsten drin ist. Der hinterlegt seinen Schlüssel mit dem nächsten
-- freizeit_ich; bis dahin braucht er keinen. Ein Schlüssel, den jemand
-- anderes mitschickt, bleibt ohne Wirkung.
--
-- DER CODE
--
-- Drei bis fünf Vierergruppen aus a–z und 0–9, mit oder ohne Bindestrich
-- dazwischen. Großbuchstaben macht der Server klein: „ABCD-EFGH-JKMN“ ist
-- derselbe Raum wie „abcd-efgh-jkmn“. Die Bindestriche dagegen gehen mit in
-- den Hash ein – „abcdefghjkmn“ ist ein ANDERER Raum. Die App schickt den Code
-- deshalb immer klein und mit Bindestrichen.
--
-- DER SCHLÜSSEL
--
-- 20–64 Zeichen aus a–z und 0–9, von der App gewürfelt (24 Zeichen, rund
-- 120 Bit). Er bleibt auf dem Gerät des Gastgebers – und auf seinen weiteren,
-- wenn er ihn dorthin mitnimmt.
--
-- WAS DER SERVER SIEHT
--
--   raum       SHA-256 über "freizeit:" + Code in Kleinbuchstaben, als Hex.
--              Der Code selbst steht nirgends.
--   person     eine Kennung, die die App für jede Person würfelt
--              (8–40 Zeichen aus a–z, 0–9 und -, etwa eine UUID; nicht
--              'gastgeber')
--   name       der Name, den sich die Person gibt (1–30 Zeichen)
--   eintrag    die Kennung des Termins mit dem Häkchen
--   daten      was die App zum Häkchen mitschickt (Titel, Tag, mit wem …),
--              damit es auch dann noch dasteht, wenn der Termin nicht mehr in
--              der Woche steht – ein JSON-Objekt, höchstens 2000 Byte
--   schluessel SHA-256 über "freizeit-gast:" + Schlüssel des Gastgebers, als
--              Hex. Der Schlüssel selbst steht nirgends.
--   angelegt, geaendert   wann
--
-- Anders als die Sicherung der Workout-App ist hier nichts verschlüsselt:
-- Namen und Häkchen liegen lesbar in der Datenbank. Sehen kann sie, wer das
-- Supabase-Projekt verwaltet – der Betreiber –, und Supabase selbst. Über die
-- App kommt nur heran, wer den Code hat, und auch dann nur an das, was oben
-- steht. Die IP-Adresse sieht Supabase wie bei jeder Anfrage; in den Tabellen
-- steht sie nicht.
--
-- GRENZEN
--
-- Den öffentlichen Schlüssel kann jeder aus der Seite lesen und damit Räume
-- anlegen. Damit die Tabellen nicht beliebig wachsen: höchstens 30 Personen
-- und 6000 Häkchen je Raum, höchstens 100 Räume und 30000 Häkchen auf dem
-- ganzen Server. Ein Häkchen, das 400 Tage niemand neu gesetzt hat, löscht
-- der nächste Aufruf von freizeit_bock im selben Raum – der Termin ist dann
-- lange vorbei.
--
-- Im Alltag sind das ein paar hundert Häkchen zu ein paar hundert Byte, kein
-- Megabyte. Im schlimmsten Fall füllt aber jemand mit dem öffentlichen
-- Schlüssel alles bis an die Grenzen, und das ist mit genau diesen Tabellen
-- gemessen: 30000 Häkchen mit 200 Byte Eintrag und 2000 Byte daten
-- brauchen samt Index rund 105 MB. Gezählt wird in Bytes (octet_length),
-- nicht in Zeichen – sonst kämen mit Zeichen, die in UTF-8 vier Byte lang
-- sind (etwa Emoji), rund 320 MB zusammen. Die höchstens 3000 Personen und
-- 100 Gastgeber fallen daneben nicht ins Gewicht. Der kostenlose Tarif hat
-- 500 MB, und die teilt sich das hier mit der Sicherung der Workout-App, die
-- bis 200 MB wachsen darf: Auch ganz ausgereizt bleibt Luft.
--
-- WARUM FUNKTIONEN UND KEINE REGELN
--
-- Wie bei der Sicherung der Workout-App: Auf die Tabellen hat der öffentliche
-- Schlüssel kein Recht, und Row Level Security ist an, ohne eine einzige
-- Regel. Gelesen und geschrieben wird nur über die vier Funktionen, die mit
-- den Rechten ihres Besitzers laufen und selbst prüfen, was sie annehmen.
--
--   freizeit_lesen(p_code, p_person, p_schluessel)       nur lesen
--   freizeit_ich(p_code, p_person, p_name, p_schluessel) eintreten, umbenennen
--   freizeit_bock(p_code, p_person, p_eintrag, p_bock, p_daten, p_schluessel)
--   freizeit_weg(p_code, p_person, p_schluessel, p_wer)  gehen, jemanden
--                                                        herausnehmen
--   freizeit_push(p_code, p_person, p_schluessel, p_abo, p_an)
--                                                        Push an oder aus (nur
--                                                        der Gastgeber, siehe PUSH)
--
-- p_schluessel braucht nur der Gastgeber, p_person nicht, wer nur lesen will;
-- was fehlt, ist null. Jede der vier gibt zurück, was der Aufrufer sieht:
--
--   {"rolle": "gastgeber" | "mitglied" | "gast",
--    "personen": [{"id": "…", "name": "Tobi"}, …],
--    "bock": [{"person": "…", "eintrag": "…", "daten": {…},
--              "geaendert": "2026-10-26T16:32:09.014Z"}, …]}
--
-- personen in der Reihenfolge des Eintretens, bock nach geaendert. Beide sind
-- immer Listen, notfalls leere, nie null; daten ist null, wenn die App keine
-- mitgeschickt hat. geaendert ist ISO-Text in UTC auf die Millisekunde, so,
-- wie JavaScript ihn mit toISOString() schreibt – egal, welche Zeitzone die
-- Sitzung hat. Wer nicht Gastgeber ist, sieht den Gastgeber mit der id
-- 'gastgeber' und dessen Häkchen mit der person 'gastgeber'.
--
-- Geht etwas nicht, bricht die Funktion mit einer kurzen Meldung ab (bei
-- PostgREST im Feld message) und ändert nichts:
--
--   ungültiger Code               der Code hat nicht die Form oben
--   ungültige Person              die Kennung hat nicht die Form oben
--   ungültiger Schlüssel          der Schlüssel hat nicht die Form oben
--   Name fehlt oder ist zu lang   ohne Leerzeichen am Rand nicht 1–30 Zeichen
--   ungültiger Eintrag            die Kennung des Termins nicht 1–200 Byte
--   Eintrag zu groß               daten kein JSON-Objekt oder über 2000 Byte
--   falscher Schlüssel            der Gastgeber ohne seinen Schlüssel
--   unbekannte Person             ein Häkchen für jemanden, der nicht im Raum ist
--   nur der Gastgeber             jemand anderen herausnehmen, ohne Gastgeber zu sein
--   Raum ist voll                 die 31. Person
--   zu viele Häkchen              das 6001. Häkchen im Raum
--   zu viele Räume                der 101. Raum
--   Server voll                   das 30001. Häkchen auf dem ganzen Server

create table if not exists freizeit_person (
  raum      text not null,
  person    text not null,
  name      text not null,
  angelegt  timestamptz not null default now(),
  geaendert timestamptz not null default now(),
  primary key (raum, person)
);

-- Ein Häkchen gehört einer Person im Raum. Geht sie, gehen ihre Häkchen mit:
-- freizeit_weg löscht sie ausdrücklich, und der Fremdschlüssel sorgt dafür,
-- dass es gar nicht anders sein kann.
create table if not exists freizeit_bock (
  raum      text not null,
  person    text not null,
  eintrag   text not null,
  daten     jsonb,
  geaendert timestamptz not null default now(),
  primary key (raum, person, eintrag),
  foreign key (raum, person) references freizeit_person (raum, person) on delete cascade
);

-- Wer in einem Raum Gastgeber ist, und der Hash seines Schlüssels. Höchstens
-- einer je Raum, und nur jemand, der im Raum ist.
create table if not exists freizeit_gastgeber (
  raum       text primary key,
  person     text not null,
  schluessel text not null,
  angelegt   timestamptz not null default now(),
  foreign key (raum, person) references freizeit_person (raum, person) on delete cascade
);

-- PUSH: Der Gastgeber will wissen, wenn jemand eintritt oder etwas anhakt.
-- Sein Browser gibt ihm dafür ein Abo (Adresse beim Push-Dienst plus zwei
-- Schlüssel); das liegt hier, je Gerät eine Zeile. Was zu melden ist, kommt
-- in freizeit_nachricht; die Edge Function freizeit-push (Ordner
-- supabase/functions) holt es dort ab, schickt es verschlüsselt an die Geräte
-- und hakt es ab. Ohne Abo im Raum wird nichts gesammelt.
create table if not exists freizeit_push (
  raum      text not null,
  person    text not null,
  endpunkt  text not null,
  abo       jsonb not null,
  angelegt  timestamptz not null default now(),
  primary key (raum, endpunkt),
  foreign key (raum, person) references freizeit_person (raum, person) on delete cascade
);

-- art: neu (eingetreten), bock (angehakt oder „mit wem“ gewechselt),
-- aus (ein Häkchen „mit dir“ zurückgenommen), weg (den Raum verlassen);
-- daten bei bock und aus der Schnappschuss des Eintrags samt eintrag und mitwem.
create table if not exists freizeit_nachricht (
  id        bigint generated always as identity primary key,
  raum      text not null,
  art       text not null,
  name      text not null,
  daten     jsonb,
  angelegt  timestamptz not null default now(),
  geholt    timestamptz,
  gesendet  timestamptz
);
create index if not exists freizeit_nachricht_offen on freizeit_nachricht (angelegt) where gesendet is null;

-- Das VAPID-Schlüsselpaar, mit dem sich die Edge Function bei den
-- Push-Diensten ausweist: Sie erzeugt es beim ersten Lauf selbst und legt es
-- hier ab (nur service_role kommt heran). Der öffentliche Teil geht an die
-- App, wenn ein Gerät sich anmeldet.
create table if not exists freizeit_einstellung (
  schluessel text primary key,
  wert       text not null
);

alter table freizeit_person enable row level security;
alter table freizeit_bock enable row level security;
alter table freizeit_gastgeber enable row level security;
alter table freizeit_push enable row level security;
alter table freizeit_nachricht enable row level security;
alter table freizeit_einstellung enable row level security;

-- Erst weg, dann neu: Ändert sich eine Signatur oder ein Rückgabetyp,
-- verweigert "create or replace" den Dienst. Die Funktionen der ersten
-- Fassung gehen auch – blieben sie liegen, fände PostgREST zu einem Aufruf
-- wie freizeit_lesen(p_code) zwei passende und nähme keine.
drop function if exists freizeit_ich(text, text, text);
drop function if exists freizeit_lesen(text);
drop function if exists freizeit_bock(text, text, text, boolean, jsonb);
drop function if exists freizeit_weg(text, text);
drop function if exists freizeit_stand(text);
drop function if exists freizeit_ich(text, text, text, text);
drop function if exists freizeit_lesen(text, text, text);
drop function if exists freizeit_bock(text, text, text, boolean, jsonb, text);
drop function if exists freizeit_weg(text, text, text, text);
drop function if exists freizeit_raum(text);
drop function if exists freizeit_kennung(text);
drop function if exists freizeit_hash(text);
drop function if exists freizeit_gastgeber_von(text);
drop function if exists freizeit_rolle(text, text, text);
drop function if exists freizeit_stand(text, text, text);
drop function if exists freizeit_melden(text, text, text, jsonb);
drop function if exists freizeit_push(text, text, text, jsonb, boolean);
drop function if exists freizeit_push_offen();
drop function if exists freizeit_push_fertig(bigint[], text[]);
drop function if exists freizeit_push_schluessel();
drop function if exists freizeit_push_schluessel_setzen(text, text);

-- Sechs Helfer für die vier Funktionen. Von außen lassen sie sich nicht
-- aufrufen (siehe unten), und sie laufen mit den Rechten dessen, der sie
-- aufruft – aus den vier Funktionen heraus also mit denen des Besitzers.

-- Aus dem Code der Raum – oder 'ungültiger Code'.
create or replace function freizeit_raum(p_code text)
returns text
language plpgsql immutable set search_path = public, pg_temp as $$
begin
  if p_code is null or lower(p_code) !~ '^[a-z0-9]{4}(-?[a-z0-9]{4}){2,4}$' then
    raise exception 'ungültiger Code';
  end if;
  return encode(sha256(convert_to('freizeit:' || lower(p_code), 'UTF8')), 'hex');
end $$;

-- Die Kennung einer Person, wie sie ist – oder 'ungültige Person'. 'gastgeber'
-- ist vergeben: So sehen die anderen den Gastgeber.
create or replace function freizeit_kennung(p_person text)
returns text
language plpgsql immutable set search_path = public, pg_temp as $$
begin
  if p_person is null or p_person !~ '^[a-z0-9-]{8,40}$' or p_person = 'gastgeber' then
    raise exception 'ungültige Person';
  end if;
  return p_person;
end $$;

-- Aus dem Schlüssel sein Hash – ohne Schlüssel null, sonst 'ungültiger Schlüssel'.
create or replace function freizeit_hash(p_schluessel text)
returns text
language plpgsql immutable set search_path = public, pg_temp as $$
begin
  if p_schluessel is null then
    return null;
  end if;
  if p_schluessel !~ '^[a-z0-9]{20,64}$' then
    raise exception 'ungültiger Schlüssel';
  end if;
  return encode(sha256(convert_to('freizeit-gast:' || p_schluessel, 'UTF8')), 'hex');
end $$;

-- Wer im Raum Gastgeber ist: wer seinen Schlüssel hinterlegt hat – sonst,
-- solange es keiner getan hat, wer am längsten drin ist. Im leeren Raum null.
create or replace function freizeit_gastgeber_von(p_raum text)
returns text
language sql stable set search_path = public, pg_temp as $$
  select coalesce(
    (select g.person from freizeit_gastgeber g where g.raum = p_raum),
    (select p.person from freizeit_person p where p.raum = p_raum order by p.angelegt, p.person limit 1));
$$;

-- Als was jemand anfragt: 'gastgeber', 'mitglied' – oder 'gast', wer nicht im
-- Raum ist. Der Gastgeber muss seinen Schlüssel mitbringen, sobald er einen
-- hinterlegt hat; sonst 'falscher Schlüssel'.
create or replace function freizeit_rolle(p_raum text, p_person text, p_schluessel text)
returns text
language plpgsql stable set search_path = public, pg_temp as $$
declare
  v_hash text;
begin
  if p_person is null or not exists (select 1 from freizeit_person where raum = p_raum and person = p_person) then
    return 'gast';
  end if;
  if p_person is distinct from freizeit_gastgeber_von(p_raum) then
    return 'mitglied';
  end if;
  select g.schluessel into v_hash from freizeit_gastgeber g where g.raum = p_raum;
  if v_hash is not null and v_hash is distinct from freizeit_hash(p_schluessel) then
    raise exception 'falscher Schlüssel';
  end if;
  return 'gastgeber';
end $$;

-- Was jemand in dieser Rolle vom Raum sieht (siehe oben).
create or replace function freizeit_stand(p_raum text, p_person text, p_rolle text)
returns jsonb
language sql stable set search_path = public, pg_temp as $$
  with gast as (select freizeit_gastgeber_von(p_raum) as id),
  -- Wen die Anfrage zu sehen bekommt, und unter welcher Kennung.
  sicht as (
    select p.person, p.name, p.angelegt,
           case when p_rolle <> 'gastgeber' and p.person = gast.id then 'gastgeber' else p.person end as kennung
      from freizeit_person p cross join gast
     where p.raum = p_raum
       and (p_rolle = 'gastgeber' or p.person = gast.id or (p_rolle = 'mitglied' and p.person = p_person)))
  select jsonb_build_object(
    'rolle', p_rolle,
    'personen', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.kennung, 'name', s.name) order by s.angelegt, s.kennung)
        from sicht s), '[]'::jsonb),
    'bock', coalesce((
      select jsonb_agg(jsonb_build_object(
               'person', s.kennung,
               'eintrag', b.eintrag,
               'daten', b.daten,
               'geaendert', to_char(b.geaendert at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
             order by b.geaendert, s.kennung, b.eintrag)
        from freizeit_bock b join sicht s on s.person = b.person
       where b.raum = p_raum and p_rolle <> 'gast'), '[]'::jsonb));
$$;

-- Etwas zum Melden (PUSH): Nur, wenn im Raum jemand Push hat – sonst bliebe es
-- liegen. Zugestelltes älter als sieben Tage räumt der Aufruf gleich mit weg,
-- und bei 200 offenen Nachrichten im Raum ist die Zustellung kaputt: dann
-- lieber nichts mehr stapeln.
create or replace function freizeit_melden(p_raum text, p_art text, p_name text, p_daten jsonb)
returns void
language plpgsql set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from freizeit_push where raum = p_raum) then
    return;
  end if;
  delete from freizeit_nachricht where raum = p_raum and gesendet is not null and gesendet < now() - interval '7 days';
  if (select count(*) from freizeit_nachricht where raum = p_raum and gesendet is null) >= 200 then
    return;
  end if;
  insert into freizeit_nachricht (raum, art, name, daten) values (p_raum, p_art, left(coalesce(p_name, ''), 30), p_daten);
end $$;

-- Eintreten oder umbenennen. Wer einen neuen Raum anlegt und einen Schlüssel
-- mitschickt, ist sein Gastgeber.
create or replace function freizeit_ich(p_code text, p_person text, p_name text, p_schluessel text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_raum  text := freizeit_raum(p_code);
  v_name  text := btrim(p_name);
  v_hash  text;
  v_rolle text;
begin
  perform freizeit_kennung(p_person);
  if v_name is null or length(v_name) not between 1 and 30 then
    raise exception 'Name fehlt oder ist zu lang';
  end if;
  v_hash := freizeit_hash(p_schluessel);

  -- Ein Aufruf je Raum zur selben Zeit: Zwei gleichzeitige zählten sonst
  -- beide noch unter der Grenze.
  perform pg_advisory_xact_lock(hashtext('freizeit:raum'), hashtext(v_raum));

  if exists (select 1 from freizeit_person where raum = v_raum and person = p_person) then
    -- Wer schon drin ist, heißt danach nur anders – das geht immer, auch im
    -- vollen Raum. Der Gastgeber muss dafür seinen Schlüssel zeigen.
    v_rolle := freizeit_rolle(v_raum, p_person, p_schluessel);
    update freizeit_person set name = v_name, geaendert = now()
     where raum = v_raum and person = p_person;
    -- Ein Raum aus der ersten Fassung: Sein Gastgeber hinterlegt jetzt den Schlüssel.
    if v_rolle = 'gastgeber' and v_hash is not null then
      insert into freizeit_gastgeber (raum, person, schluessel) values (v_raum, p_person, v_hash)
        on conflict (raum) do nothing;
    end if;
    return freizeit_stand(v_raum, p_person, v_rolle);
  end if;

  if not exists (select 1 from freizeit_person where raum = v_raum) then
    -- Ein neuer Raum. Was alle Räume zusammen zählt, zählt immer nur einer
    -- zur Zeit – mit derselben Sperre wie die Häkchen aller Räume in
    -- freizeit_bock. Immer erst die Sperre des Raums, dann diese: So wartet
    -- nie einer auf den, der auf ihn wartet.
    perform pg_advisory_xact_lock(hashtext('freizeit:alle'), 0);
    if (select count(distinct raum) from freizeit_person) >= 100 then
      raise exception 'zu viele Räume';
    end if;
    insert into freizeit_person (raum, person, name) values (v_raum, p_person, v_name);
    if v_hash is not null then
      insert into freizeit_gastgeber (raum, person, schluessel) values (v_raum, p_person, v_hash);
    end if;
    return freizeit_stand(v_raum, p_person, 'gastgeber');
  end if;

  -- Ein Raum, den es schon gibt: Hier ist man einer der anderen, auch mit Schlüssel.
  if (select count(*) from freizeit_person where raum = v_raum) >= 30 then
    raise exception 'Raum ist voll';
  end if;
  insert into freizeit_person (raum, person, name) values (v_raum, p_person, v_name);
  perform freizeit_melden(v_raum, 'neu', v_name, null);
  return freizeit_stand(v_raum, p_person, 'mitglied');
end $$;

-- Ein Häkchen setzen (p_bock = true) oder wegnehmen (false – null ebenso).
-- Setzen ersetzt daten und erneuert geaendert; ein zweites Häkchen derselben
-- Person für denselben Termin gibt es nicht. Wegnehmen, was nicht da ist, ist
-- kein Fehler.
create or replace function freizeit_bock(
  p_code text, p_person text, p_eintrag text, p_bock boolean, p_daten jsonb, p_schluessel text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_raum  text := freizeit_raum(p_code);
  -- JSON-null zählt wie keine daten.
  v_daten jsonb := case when jsonb_typeof(p_daten) = 'null' then null else p_daten end;
  v_rolle text;
  v_alt   jsonb;
  v_neu   boolean;
begin
  perform freizeit_kennung(p_person);
  perform freizeit_hash(p_schluessel);
  if p_eintrag is null or octet_length(p_eintrag) not between 1 and 200 then
    raise exception 'ungültiger Eintrag';
  end if;
  if v_daten is not null and (jsonb_typeof(v_daten) <> 'object' or octet_length(v_daten::text) > 2000) then
    raise exception 'Eintrag zu groß';
  end if;

  perform pg_advisory_xact_lock(hashtext('freizeit:raum'), hashtext(v_raum));

  -- Aufräumen nebenbei, nur in diesem Raum: Ein Häkchen, das 400 Tage niemand
  -- neu gesetzt hat, gehört zu einem Termin, der lange vorbei ist.
  delete from freizeit_bock where raum = v_raum and geaendert < now() - interval '400 days';

  v_rolle := freizeit_rolle(v_raum, p_person, p_schluessel);
  if v_rolle = 'gast' then
    raise exception 'unbekannte Person';
  end if;

  if p_bock then
    -- Die Grenzen gelten nur für ein neues Häkchen. Ein vorhandenes neu
    -- setzen und Wegnehmen geht immer.
    if not exists (select 1 from freizeit_bock
                    where raum = v_raum and person = p_person and eintrag = p_eintrag) then
      if (select count(*) from freizeit_bock where raum = v_raum) >= 6000 then
        raise exception 'zu viele Häkchen';
      end if;
      -- Alle Räume zusammen zählt immer nur einer zur Zeit (wie in freizeit_ich).
      perform pg_advisory_xact_lock(hashtext('freizeit:alle'), 0);
      if (select count(*) from freizeit_bock) >= 30000 then
        raise exception 'Server voll';
      end if;
    end if;
    select daten, false into v_alt, v_neu from freizeit_bock
     where raum = v_raum and person = p_person and eintrag = p_eintrag;
    insert into freizeit_bock (raum, person, eintrag, daten)
      values (v_raum, p_person, p_eintrag, v_daten)
      on conflict (raum, person, eintrag) do update
        set daten = excluded.daten, geaendert = now();
    -- Dem Gastgeber Bescheid sagen (PUSH): ein neues Häkchen eines anderen,
    -- oder dasselbe mit anderem „mit wem“ – nicht, wenn die App nur noch einmal
    -- schickt, was schon da ist.
    if v_rolle = 'mitglied' and (coalesce(v_neu, true)
        or coalesce(v_alt ->> 'mitwem', '') is distinct from coalesce(v_daten ->> 'mitwem', '')) then
      perform freizeit_melden(v_raum, 'bock',
        (select name from freizeit_person where raum = v_raum and person = p_person),
        coalesce(v_daten, '{}'::jsonb) || jsonb_build_object('eintrag', p_eintrag));
    end if;
  else
    -- Nimmt jemand ein Häkchen „mit dir“ zurück, geht das den Gastgeber an;
    -- ein zurückgenommenes „ohne dich“ nicht (PUSH).
    delete from freizeit_bock where raum = v_raum and person = p_person and eintrag = p_eintrag
      returning daten into v_alt;
    if found and v_rolle = 'mitglied' and v_alt ->> 'mitwem' = 'gastgeber' then
      perform freizeit_melden(v_raum, 'aus',
        (select name from freizeit_person where raum = v_raum and person = p_person),
        v_alt || jsonb_build_object('eintrag', p_eintrag));
    end if;
  end if;
  return freizeit_stand(v_raum, p_person, v_rolle);
end $$;

-- Aus dem Raum gehen: die Person und alle ihre Häkchen. Geht der Gastgeber,
-- ist der ganze Raum aufgelöst. Mit p_wer nimmt der Gastgeber jemand anderen
-- heraus. Wer schon weg ist, bekommt keinen Fehler, nur den Stand.
create or replace function freizeit_weg(p_code text, p_person text, p_schluessel text default null, p_wer text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_raum  text := freizeit_raum(p_code);
  v_wer   text;
  v_rolle text;
begin
  perform freizeit_kennung(p_person);
  v_wer := freizeit_kennung(coalesce(p_wer, p_person));
  perform freizeit_hash(p_schluessel);
  perform pg_advisory_xact_lock(hashtext('freizeit:raum'), hashtext(v_raum));
  v_rolle := freizeit_rolle(v_raum, p_person, p_schluessel);

  if v_wer = p_person then
    if v_rolle = 'gastgeber' and exists (select 1 from freizeit_gastgeber where raum = v_raum) then
      delete from freizeit_bock where raum = v_raum;
      delete from freizeit_gastgeber where raum = v_raum;
      delete from freizeit_push where raum = v_raum;
      delete from freizeit_nachricht where raum = v_raum;
      delete from freizeit_person where raum = v_raum;
    else
      -- Auch in einem Raum ohne Schlüssel geht nur, wer geht – danach ist der
      -- Nächste am längsten drin.
      if v_rolle = 'mitglied' then
        perform freizeit_melden(v_raum, 'weg', (select name from freizeit_person where raum = v_raum and person = p_person), null);
      end if;
      delete from freizeit_bock where raum = v_raum and person = p_person;
      delete from freizeit_person where raum = v_raum and person = p_person;
    end if;
    return freizeit_stand(v_raum, null, 'gast');
  end if;

  if v_rolle <> 'gastgeber' or not exists (select 1 from freizeit_gastgeber where raum = v_raum) then
    raise exception 'nur der Gastgeber';
  end if;
  delete from freizeit_bock where raum = v_raum and person = v_wer;
  delete from freizeit_person where raum = v_raum and person = v_wer;
  return freizeit_stand(v_raum, p_person, v_rolle);
end $$;

-- Nur lesen. Ohne Person (oder mit einer, die nicht im Raum ist) ist man Gast:
-- Man sieht den Namen des Gastgebers, sonst nichts. Ein Raum, in dem niemand
-- ist, ist leer und kein Fehler – so sieht jeder frische Code aus.
create or replace function freizeit_lesen(p_code text, p_person text default null, p_schluessel text default null)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_raum text := freizeit_raum(p_code);
begin
  if p_person is not null then
    perform freizeit_kennung(p_person);
  end if;
  perform freizeit_hash(p_schluessel);
  return freizeit_stand(v_raum, p_person, freizeit_rolle(v_raum, p_person, p_schluessel));
end $$;

-- PUSH ---------------------------------------------------------------------
--
-- Der Gastgeber meldet sein Gerät an (p_an = true) oder ab (false). p_abo ist
-- das Abo, wie der Browser es gibt: {"endpoint": "https://…", "keys":
-- {"p256dh": "…", "auth": "…"}} – mit allem, was die Edge Function zum
-- Verschlüsseln braucht. Nur der Gastgeber eines Raums mit Schlüssel, und
-- höchstens fünf Geräte je Raum. Zurück kommt {"push": an, "geraete": Zahl}.
create or replace function freizeit_push(p_code text, p_person text, p_schluessel text, p_abo jsonb, p_an boolean)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_raum     text := freizeit_raum(p_code);
  v_endpunkt text;
begin
  perform freizeit_kennung(p_person);
  perform freizeit_hash(p_schluessel);
  if p_abo is null or jsonb_typeof(p_abo) <> 'object' or octet_length(p_abo::text) > 2000 then
    raise exception 'ungültiges Abo';
  end if;
  v_endpunkt := p_abo ->> 'endpoint';
  if v_endpunkt is null or v_endpunkt !~ '^https://[^[:space:]]+$' or length(v_endpunkt) not between 16 and 900
     or jsonb_typeof(p_abo -> 'keys') <> 'object'
     or coalesce(p_abo -> 'keys' ->> 'p256dh', '') !~ '^[A-Za-z0-9_=-]{80,120}$'
     or coalesce(p_abo -> 'keys' ->> 'auth', '') !~ '^[A-Za-z0-9_=-]{16,32}$' then
    raise exception 'ungültiges Abo';
  end if;
  perform pg_advisory_xact_lock(hashtext('freizeit:raum'), hashtext(v_raum));
  if freizeit_rolle(v_raum, p_person, p_schluessel) <> 'gastgeber'
     or not exists (select 1 from freizeit_gastgeber where raum = v_raum) then
    raise exception 'nur der Gastgeber';
  end if;
  if coalesce(p_an, false) then
    if not exists (select 1 from freizeit_push where raum = v_raum and endpunkt = v_endpunkt)
       and (select count(*) from freizeit_push where raum = v_raum) >= 5 then
      raise exception 'zu viele Geräte';
    end if;
    insert into freizeit_push (raum, person, endpunkt, abo) values (v_raum, p_person, v_endpunkt, p_abo)
      on conflict (raum, endpunkt) do update set abo = excluded.abo, person = excluded.person;
  else
    delete from freizeit_push where raum = v_raum and endpunkt = v_endpunkt;
  end if;
  return jsonb_build_object('push', coalesce(p_an, false),
    'geraete', (select count(*) from freizeit_push where raum = v_raum));
end $$;

-- Für die Edge Function (nur service_role): die offenen Nachrichten mit den
-- Abos ihres Raums, als Liste (raum ist der Hash – die Function fasst damit
-- zusammen, was in einen Raum gehört). Was sie holt, gilt zwei Minuten als „in
-- Arbeit“ – zwei Aufrufe zugleich teilen sich nichts. Älter als ein Tag ist
-- nicht mehr zuzustellen und gilt als erledigt.
create or replace function freizeit_push_offen()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v jsonb;
begin
  update freizeit_nachricht set gesendet = now()
   where gesendet is null and angelegt <= now() - interval '1 day';
  with offen as (
    update freizeit_nachricht n set geholt = now()
     where n.gesendet is null and (n.geholt is null or n.geholt < now() - interval '2 minutes')
    returning n.id, n.raum, n.art, n.name, n.daten, n.angelegt)
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id, 'raum', o.raum, 'art', o.art, 'name', o.name, 'daten', o.daten,
      'angelegt', to_char(o.angelegt at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'abos', (select coalesce(jsonb_agg(p.abo order by p.angelegt), '[]'::jsonb) from freizeit_push p where p.raum = o.raum))
    order by o.id), '[]'::jsonb)
    into v
    from offen o;
  return v;
end $$;

-- Für die Edge Function (nur service_role): zugestellt – und Abos, deren
-- Push-Dienst sie nicht mehr kennt (404, 410), weg.
create or replace function freizeit_push_fertig(p_ids bigint[], p_tot text[])
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update freizeit_nachricht set gesendet = now() where id = any (coalesce(p_ids, '{}'::bigint[]));
  delete from freizeit_push where endpunkt = any (coalesce(p_tot, '{}'::text[]));
end $$;

-- Für die Edge Function (nur service_role): ihr Schlüsselpaar – { "oeffentlich",
-- "privat" } (base64url, 65 und 32 Byte) oder null, solange keins da ist.
create or replace function freizeit_push_schluessel()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v jsonb;
begin
  select jsonb_object_agg(replace(schluessel, 'vapid_', ''), wert) into v
    from freizeit_einstellung where schluessel in ('vapid_oeffentlich', 'vapid_privat');
  if v is null or not (v ? 'oeffentlich' and v ? 'privat') then
    return null;
  end if;
  return v;
end $$;

-- Für die Edge Function (nur service_role): das Paar einmalig ablegen. Ist
-- schon eins da, bleibt es – zwei Läufe zugleich einigen sich so auf das
-- erste. Zurück kommt, was gilt.
create or replace function freizeit_push_schluessel_setzen(p_oeffentlich text, p_privat text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_oeffentlich !~ '^[A-Za-z0-9_-]{87}$' or p_privat !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'ungültiges Schlüsselpaar';
  end if;
  perform pg_advisory_xact_lock(hashtext('freizeit:vapid'), 0);
  if freizeit_push_schluessel() is null then
    delete from freizeit_einstellung where schluessel in ('vapid_oeffentlich', 'vapid_privat');
    insert into freizeit_einstellung (schluessel, wert) values ('vapid_oeffentlich', p_oeffentlich), ('vapid_privat', p_privat);
  end if;
  return freizeit_push_schluessel();
end $$;

-- Die Zustellung anstoßen: Nach jedem Einfügen in freizeit_nachricht ruft die
-- Datenbank die Edge Function (über pg_net, ohne zu warten). Ohne pg_net –
-- etwa im Test mit PGlite – passiert hier nichts; die Function holt die
-- Nachrichten dann beim nächsten Aufruf von woanders.
do $$
begin
  begin
    create extension if not exists pg_net;
  exception when others then
    raise notice 'pg_net nicht verfügbar (%): Push wird nicht von der Datenbank angestoßen', sqlerrm;
  end;
end $$;

create or replace function freizeit_push_anstossen()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_net') then
    perform net.http_post(
      url := 'https://vjyohppohmvhhxgwouti.supabase.co/functions/v1/freizeit-push',
      body := '{}'::jsonb,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 5000);
  end if;
  return null;
end $$;

drop trigger if exists freizeit_push_anstossen on freizeit_nachricht;
create trigger freizeit_push_anstossen
  after insert on freizeit_nachricht
  for each statement execute function freizeit_push_anstossen();

-- Nur die fünf Funktionen sind erreichbar – die Tabellen und die Helfer nicht;
-- die vier für die Edge Function nur mit dem Schlüssel des Betreibers.
-- Supabase gibt neuen Tabellen und Funktionen von sich aus Rechte für anon und
-- authenticated, Postgres jeder Funktion eins für alle (public). Deshalb erst
-- alles weg, dann das eine Recht dazu.
revoke all on table freizeit_person, freizeit_bock, freizeit_gastgeber, freizeit_push, freizeit_nachricht, freizeit_einstellung
  from public, anon, authenticated, service_role;
revoke all on function freizeit_ich(text, text, text, text), freizeit_lesen(text, text, text),
                       freizeit_bock(text, text, text, boolean, jsonb, text), freizeit_weg(text, text, text, text),
                       freizeit_push(text, text, text, jsonb, boolean),
                       freizeit_push_offen(), freizeit_push_fertig(bigint[], text[]), freizeit_push_anstossen(),
                       freizeit_push_schluessel(), freizeit_push_schluessel_setzen(text, text),
                       freizeit_raum(text), freizeit_kennung(text), freizeit_hash(text), freizeit_melden(text, text, text, jsonb),
                       freizeit_gastgeber_von(text), freizeit_rolle(text, text, text), freizeit_stand(text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function freizeit_ich(text, text, text, text), freizeit_lesen(text, text, text),
                          freizeit_bock(text, text, text, boolean, jsonb, text), freizeit_weg(text, text, text, text),
                          freizeit_push(text, text, text, jsonb, boolean)
  to anon;
grant execute on function freizeit_push_offen(), freizeit_push_fertig(bigint[], text[]),
                          freizeit_push_schluessel(), freizeit_push_schluessel_setzen(text, text)
  to service_role;

-- PostgREST die neuen Funktionen sofort zeigen, statt auf den nächsten
-- Neustart seines Zwischenspeichers zu warten.
notify pgrst, 'reload schema';
