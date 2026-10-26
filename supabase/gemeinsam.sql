-- Die gemeinsamen Häkchen – wer hat wozu Bock? Zwei Tabellen, vier Funktionen.
--
--   Wo:  Supabase → SQL Editor → einfügen → Run
--   Wer: der Betreiber, einmal. Der Block ist wiederholbar – ein zweiter Lauf
--        legt nichts doppelt an und löscht weder Personen noch Häkchen.
--
-- Ob er tut, was die App erwartet, prüft tests/test-sql.mjs – mit einem
-- echten Postgres im Testprozess (PGlite), ohne Supabase.
--
-- WORUM ES GEHT
--
-- Zwei Leute haken in der App an, wozu sie Bock haben, und sehen die Häkchen
-- des anderen. Zusammen gehören sie über einen Raumcode, den nur die beiden
-- kennen, etwa „abcd-efgh-jkmn“. Wer den Code hat, ist im Raum – Konten gibt
-- es keine. Einen Raum gibt es, sobald eine Person darin ist, und nicht mehr,
-- wenn die letzte gegangen ist.
--
-- DER CODE
--
-- Drei bis fünf Vierergruppen aus a–z und 0–9, mit oder ohne Bindestrich
-- dazwischen. Großbuchstaben macht der Server klein: „ABCD-EFGH-JKMN“ ist
-- derselbe Raum wie „abcd-efgh-jkmn“. Die Bindestriche dagegen gehen mit in
-- den Hash ein – „abcdefghjkmn“ ist ein ANDERER Raum. Die App schickt den Code
-- deshalb immer klein und mit Bindestrichen.
--
-- WAS DER SERVER SIEHT
--
--   raum       SHA-256 über "freizeit:" + Code in Kleinbuchstaben, als Hex.
--              Der Code selbst steht nirgends.
--   person     eine Kennung, die die App für jede Person würfelt
--              (8–40 Zeichen aus a–z, 0–9 und -, etwa eine UUID)
--   name       der Name, den sich die Person gibt (1–30 Zeichen)
--   eintrag    die Kennung des Termins mit dem Häkchen
--   daten      was die App zum Häkchen mitschickt (Titel, Tag …), damit der
--              andere es auch dann noch zeigen kann, wenn der Termin nicht
--              mehr in der Woche steht – ein JSON-Objekt, höchstens 2000 Zeichen
--   angelegt, geaendert   wann
--
-- Anders als die Sicherung der Workout-App ist hier nichts verschlüsselt:
-- Namen und Häkchen liegen lesbar in der Datenbank. Sehen kann sie, wer das
-- Supabase-Projekt verwaltet – der Betreiber –, und Supabase selbst. Über die
-- App kommt nur heran, wer den Code hat. Die IP-Adresse sieht Supabase wie bei
-- jeder Anfrage; in den Tabellen steht sie nicht.
--
-- GRENZEN
--
-- Den öffentlichen Schlüssel kann jeder aus der Seite lesen und damit Räume
-- anlegen. Damit die Tabellen nicht beliebig wachsen: höchstens 6 Personen
-- und 3000 Häkchen je Raum, höchstens 100 Räume und 30000 Häkchen auf dem
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
-- sind (etwa Emoji), rund 320 MB zusammen. Die höchstens 600 Personen fallen
-- daneben nicht ins Gewicht. Der kostenlose Tarif hat 500 MB, und die teilt
-- sich das hier mit der Sicherung der Workout-App, die bis 200 MB wachsen
-- darf: Auch ganz ausgereizt bleibt Luft.
--
-- WARUM FUNKTIONEN UND KEINE REGELN
--
-- Wie bei der Sicherung der Workout-App: Auf die Tabellen hat der öffentliche
-- Schlüssel kein Recht, und Row Level Security ist an, ohne eine einzige
-- Regel. Gelesen und geschrieben wird nur über die vier Funktionen, die mit
-- den Rechten ihres Besitzers laufen und selbst prüfen, was sie annehmen.
--
-- Jede der vier gibt den Stand des Raums zurück:
--
--   {"personen": [{"id": "…", "name": "Tobi"}, …],
--    "bock": [{"person": "…", "eintrag": "…", "daten": {…},
--              "geaendert": "2026-10-26T16:32:09.014Z"}, …]}
--
-- personen in der Reihenfolge des Eintretens, bock nach geaendert. Beide sind
-- immer Listen, notfalls leere, nie null; daten ist null, wenn die App keine
-- mitgeschickt hat. geaendert ist ISO-Text in UTC auf die Millisekunde, so,
-- wie JavaScript ihn mit toISOString() schreibt – egal, welche Zeitzone die
-- Sitzung hat.
--
-- Geht etwas nicht, bricht die Funktion mit einer kurzen Meldung ab (bei
-- PostgREST im Feld message) und ändert nichts:
--
--   ungültiger Code               der Code hat nicht die Form oben
--   ungültige Person              die Kennung hat nicht die Form oben
--   Name fehlt oder ist zu lang   ohne Leerzeichen am Rand nicht 1–30 Zeichen
--   ungültiger Eintrag            die Kennung des Termins nicht 1–200 Zeichen
--   Eintrag zu groß               daten kein JSON-Objekt oder über 2000 Zeichen
--   unbekannte Person             ein Häkchen für jemanden, der nicht im Raum ist
--   Raum ist voll                 die siebte Person
--   zu viele Häkchen              das 3001. Häkchen im Raum
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

alter table freizeit_person enable row level security;
alter table freizeit_bock enable row level security;

-- Erst weg, dann neu: Ändert sich eine Signatur oder ein Rückgabetyp,
-- verweigert "create or replace" den Dienst.
drop function if exists freizeit_ich(text, text, text);
drop function if exists freizeit_lesen(text);
drop function if exists freizeit_bock(text, text, text, boolean, jsonb);
drop function if exists freizeit_weg(text, text);
drop function if exists freizeit_raum(text);
drop function if exists freizeit_stand(text);

-- Zwei Helfer für die vier Funktionen. Von außen lassen sie sich nicht
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

-- Der Stand des Raums, wie ihn jede der vier Funktionen zurückgibt.
create or replace function freizeit_stand(p_raum text)
returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'personen', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.person, 'name', p.name)
                       order by p.angelegt, p.person)
        from freizeit_person p
       where p.raum = p_raum), '[]'::jsonb),
    'bock', coalesce((
      select jsonb_agg(jsonb_build_object(
               'person', b.person,
               'eintrag', b.eintrag,
               'daten', b.daten,
               'geaendert', to_char(b.geaendert at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
             order by b.geaendert, b.person, b.eintrag)
        from freizeit_bock b
       where b.raum = p_raum), '[]'::jsonb));
$$;

-- Eintreten oder umbenennen.
create or replace function freizeit_ich(p_code text, p_person text, p_name text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_raum text := freizeit_raum(p_code);
  v_name text := btrim(p_name);
begin
  if p_person is null or p_person !~ '^[a-z0-9-]{8,40}$' then raise exception 'ungültige Person'; end if;
  if v_name is null or length(v_name) not between 1 and 30 then
    raise exception 'Name fehlt oder ist zu lang';
  end if;

  -- Ein Aufruf je Raum zur selben Zeit: Zwei gleichzeitige zählten sonst
  -- beide noch unter der Grenze.
  perform pg_advisory_xact_lock(hashtext('freizeit:raum'), hashtext(v_raum));

  -- Wer schon drin ist, heißt danach nur anders – das geht immer, auch im
  -- vollen Raum.
  update freizeit_person set name = v_name, geaendert = now()
   where raum = v_raum and person = p_person;
  if found then
    return freizeit_stand(v_raum);
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
  elsif (select count(*) from freizeit_person where raum = v_raum) >= 6 then
    raise exception 'Raum ist voll';
  end if;

  insert into freizeit_person (raum, person, name) values (v_raum, p_person, v_name);
  return freizeit_stand(v_raum);
end $$;

-- Ein Häkchen setzen (p_bock = true) oder wegnehmen (false – null ebenso).
-- Setzen ersetzt daten und erneuert geaendert; ein zweites Häkchen derselben
-- Person für denselben Termin gibt es nicht. Wegnehmen, was nicht da ist, ist
-- kein Fehler.
create or replace function freizeit_bock(
  p_code text, p_person text, p_eintrag text, p_bock boolean, p_daten jsonb)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_raum  text := freizeit_raum(p_code);
  -- JSON-null zählt wie keine daten.
  v_daten jsonb := case when jsonb_typeof(p_daten) = 'null' then null else p_daten end;
begin
  if p_person is null or p_person !~ '^[a-z0-9-]{8,40}$' then raise exception 'ungültige Person'; end if;
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

  if not exists (select 1 from freizeit_person where raum = v_raum and person = p_person) then
    raise exception 'unbekannte Person';
  end if;

  if p_bock then
    -- Die Grenzen gelten nur für ein neues Häkchen. Ein vorhandenes neu
    -- setzen und Wegnehmen geht immer.
    if not exists (select 1 from freizeit_bock
                    where raum = v_raum and person = p_person and eintrag = p_eintrag) then
      if (select count(*) from freizeit_bock where raum = v_raum) >= 3000 then
        raise exception 'zu viele Häkchen';
      end if;
      -- Alle Räume zusammen zählt immer nur einer zur Zeit (wie in freizeit_ich).
      perform pg_advisory_xact_lock(hashtext('freizeit:alle'), 0);
      if (select count(*) from freizeit_bock) >= 30000 then
        raise exception 'Server voll';
      end if;
    end if;
    insert into freizeit_bock (raum, person, eintrag, daten)
      values (v_raum, p_person, p_eintrag, v_daten)
      on conflict (raum, person, eintrag) do update
        set daten = excluded.daten, geaendert = now();
  else
    delete from freizeit_bock where raum = v_raum and person = p_person and eintrag = p_eintrag;
  end if;
  return freizeit_stand(v_raum);
end $$;

-- Aus dem Raum gehen: die Person und alle ihre Häkchen. Wer schon weg ist,
-- bekommt keinen Fehler, nur den Stand. Mit der letzten Person ist auch der
-- Raum verschwunden.
create or replace function freizeit_weg(p_code text, p_person text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_raum text := freizeit_raum(p_code);
begin
  if p_person is null or p_person !~ '^[a-z0-9-]{8,40}$' then raise exception 'ungültige Person'; end if;
  perform pg_advisory_xact_lock(hashtext('freizeit:raum'), hashtext(v_raum));
  delete from freizeit_bock where raum = v_raum and person = p_person;
  delete from freizeit_person where raum = v_raum and person = p_person;
  return freizeit_stand(v_raum);
end $$;

-- Nur lesen. Ein Raum, in dem niemand ist, ist leer und kein Fehler – so sieht
-- jeder frische Code aus, bevor der Erste eintritt.
create or replace function freizeit_lesen(p_code text)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return freizeit_stand(freizeit_raum(p_code));
end $$;

-- Nur die vier Funktionen sind erreichbar – die Tabellen und die Helfer nicht.
-- Supabase gibt neuen Tabellen und Funktionen von sich aus Rechte für anon und
-- authenticated, Postgres jeder Funktion eins für alle (public). Deshalb erst
-- alles weg, dann das eine Recht dazu.
revoke all on table freizeit_person, freizeit_bock from public, anon, authenticated;
revoke all on function freizeit_ich(text, text, text), freizeit_lesen(text),
                       freizeit_bock(text, text, text, boolean, jsonb), freizeit_weg(text, text),
                       freizeit_raum(text), freizeit_stand(text)
  from public, anon, authenticated;
grant execute on function freizeit_ich(text, text, text), freizeit_lesen(text),
                          freizeit_bock(text, text, text, boolean, jsonb), freizeit_weg(text, text)
  to anon;

-- PostgREST die neuen Funktionen sofort zeigen, statt auf den nächsten
-- Neustart seines Zwischenspeichers zu warten.
notify pgrst, 'reload schema';
