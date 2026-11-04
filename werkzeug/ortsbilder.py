#!/usr/bin/env python3
"""
Ortsfotos für die Karten: freie Fotos der Spielstätten von Wikimedia Commons.

Für jeden Ort aus daten/programm.json (mit Koordinaten, nicht Online & TV)
sucht das Skript bei Wikidata Objekte im Umkreis (bis 400 m, bei exakt
gleichem Namen bis 600 m), die ein Bild haben (P18), und nimmt das mit dem
passendsten Namen. Lizenz und Urheber kommen aus Commons (extmetadata); nur
freie Lizenzen, die eine Nennung genügen lassen (CC0, gemeinfrei, CC BY,
CC BY-SA), ohne Fotos mit Persönlichkeitsrechten. Das Bild wird verkleinert (WebP) unter bilder/orte/ abgelegt:
<name>.webp (640 px breit, aufgeklappte Karte) und <name>-klein.webp (240 px,
Vorschau). Die Zuordnung steht in daten/ortsbilder.json – mit Urheber, Lizenz
und Link zur Dateiseite für die Nennung in der App.

Fehltreffer und Fotos, auf denen Menschen im Mittelpunkt stehen, kommen in
werkzeug/ortsbilder-ausnahmen.json und werden nie wieder genommen. Darum vor
dem Übernehmen immer den Kontaktbogen ansehen (--bogen).

  python3 werkzeug/ortsbilder.py --bogen /tmp/bogen    # neue Orte suchen, Bogen schreiben
  python3 werkzeug/ortsbilder.py --alle --bogen /tmp/b  # auch Orte ohne Treffer erneut
  python3 werkzeug/ortsbilder.py --aufraeumen           # Bilder ohne Ort löschen
  python3 werkzeug/ortsbilder.py --nur-bogen /tmp/b      # ohne Netz: Bogen aller Zuordnungen

Läuft auch als GitHub Action (.github/workflows/ortsbilder.yml), sobald sich
daten/programm.json ändert – Wikimedia drosselt geteilte Adressen stark, von
GitHub aus geht es zuverlässig. Den Kontaktbogen legt die Action als Artefakt ab.

Netz: query.wikidata.org, commons.wikimedia.org, upload.wikimedia.org – mit
Pausen zwischen den Abfragen (Wikimedia begrenzt die Rate).
"""
import argparse
import datetime as dt
import hashlib
import html
import io
import json
import math
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HIER = Path(__file__).resolve().parent.parent
PROGRAMM = HIER / 'daten' / 'programm.json'
ZIEL = HIER / 'daten' / 'ortsbilder.json'
AUSNAHMEN = HIER / 'werkzeug' / 'ortsbilder-ausnahmen.json'
ORDNER = HIER / 'bilder' / 'orte'
UA = 'Freizeit-App/1.0 (github.com/Finanzdienste/Freizeit)'
SPARQL = 'https://query.wikidata.org/sparql'
GROSS, KLEIN = 640, 240
NOCHMAL_NACH_TAGEN = 60

STOPP = {'der', 'die', 'das', 'des', 'dem', 'den', 'the', 'und', 'and', 'im', 'in', 'am', 'an', 'auf', 'zu',
         'zum', 'zur', 'von', 'vom', 'bei', 'hamburg', 'hh', 'e', 'v', 'ev', 'gmbh', 'co', 'kg', 'st', 'sankt'}
# Wörter, die allein nichts über den Ort sagen – ein Treffer nur über sie zählt nicht.
ALLGEMEIN = {'theater', 'kirche', 'park', 'platz', 'halle', 'haus', 'museum', 'kino', 'bar', 'club', 'saal',
             'buehne', 'kultur', 'zentrum', 'kulturzentrum', 'stadthalle', 'markt', 'hof', 'garten', 'strasse',
             'grosser', 'kleiner', 'neue', 'alte', 'altes', 'neues', 'arena', 'forum', 'bahnhof', 'schule'}
LIZENZEN = (r'^CC0', r'^Public domain', r'^PD', r'^CC BY(-SA)? \d\.\d( [a-z]{2})?$', r'^CC BY(-SA)? \d\.\d$')


def norm(s):
    s = s.lower().replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('ß', 'ss')
    s = ''.join(c for c in unicodedata.normalize('NFKD', s) if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()


def woerter(s):
    return {w for w in norm(s).split() if w not in STOPP}


def bewertung(ort, label, orte_namen):
    """Wie gut ein Objektname zum Ort passt: (Wert, exakt) – Wert 0 heißt: passt nicht."""
    teile = [t.strip() for t in ort.split(',')]
    haupt = woerter(teile[0])
    alle = woerter(ort)
    b = woerter(label)
    if not haupt or not b:
        return 0, False
    if norm(teile[0]).replace(' ', '') == norm(label).replace(' ', '') or haupt == b:
        return 2.0, True
    ca = len(haupt & b) / len(haupt)
    cb = len(alle & b) / len(b)
    gemeinsam = (haupt | alle) & b
    if not (gemeinsam - ALLGEMEIN - orte_namen):
        return 0, False
    if (ca >= 0.99 and cb >= 0.5) or (ca >= 0.66 and cb >= 0.99):
        return ca + cb, False
    return 0, False


def holen(url, *, daten=None, kopf=None, versuche=4, pause=1.2):
    for i in range(versuche):
        req = urllib.request.Request(url, data=daten, headers={'User-Agent': UA, **(kopf or {})})
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                inhalt = r.read()
            time.sleep(pause)
            return inhalt
        except urllib.error.HTTPError as f:
            if f.code in (429, 502, 503, 504) and i < versuche - 1:
                nach = f.headers.get('Retry-After', '') if f.headers else ''
                warte = int(nach) + 2 if nach.isdigit() and int(nach) <= 120 else 20 * (i + 1)
                print(f'  … {f.code}, warte {warte} s', file=sys.stderr)
                time.sleep(warte)
                continue
            if f.code == 404:
                return None
            raise
    return None


def orte_aus_programm():
    p = json.loads(PROGRAMM.read_text(encoding='utf-8'))
    orte = {}
    for e in p.get('termine', []) + p.get('laufend', []):
        ort, geo = e.get('ort'), e.get('geo')
        if not ort or not geo or e.get('online') or e.get('region') == 'ONL':
            continue
        o = orte.setdefault(ort, {'geo': geo, 'n': 0})
        o['n'] += len(e.get('daten') or [1])
    return orte


def kandidaten(orte):
    """Wikidata-Objekte mit Bild im Umkreis jedes Orts – in Gruppen zu 12 Orten; scheitert eine, halbiert."""
    namen = list(orte)
    treffer = {o: [] for o in namen}
    fertig = 0
    def gruppe_holen(gruppe):
        nonlocal fertig
        try:
            for o, liste in abfrage(gruppe).items():
                treffer[o].extend(liste)
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as f:
            if len(gruppe) == 1:
                print(f'  ✗ Wikidata für {gruppe[0]}: {f}', file=sys.stderr)
                return
            mitte = len(gruppe) // 2
            gruppe_holen(gruppe[:mitte])
            gruppe_holen(gruppe[mitte:])
            return
        fertig += len(gruppe)
        print(f'  Wikidata: {fertig}/{len(namen)} Orte', file=sys.stderr)
    def abfrage(gruppe):
        ergebnis = {o: [] for o in gruppe}
        werte = ' '.join(f'({json.dumps(o)} "Point({orte[o]["geo"][1]} {orte[o]["geo"][0]})"^^geo:wktLiteral)' for o in gruppe)
        q = f"""SELECT ?ort ?item ?bild ?dist (SAMPLE(?lde) AS ?de) (SAMPLE(?len) AS ?en)
  (GROUP_CONCAT(DISTINCT ?alt; separator="|") AS ?alts) WHERE {{
  VALUES (?ort ?pt) {{ {werte} }}
  SERVICE wikibase:around {{ ?item wdt:P625 ?loc . bd:serviceParam wikibase:center ?pt .
    bd:serviceParam wikibase:radius "0.6" . bd:serviceParam wikibase:distance ?dist . }}
  ?item wdt:P18 ?bild .
  MINUS {{ ?item wdt:P31 wd:Q26703203 . }}
  OPTIONAL {{ ?item rdfs:label ?lde FILTER(LANG(?lde) = "de") }}
  OPTIONAL {{ ?item rdfs:label ?len FILTER(LANG(?len) = "en") }}
  OPTIONAL {{ ?item skos:altLabel ?alt FILTER(LANG(?alt) = "de") }}
}} GROUP BY ?ort ?item ?bild ?dist"""
        roh = holen(SPARQL, daten=urllib.parse.urlencode({'query': q}).encode(),
                    kopf={'Accept': 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded'}, pause=2, versuche=2)
        for b in json.loads(roh)['results']['bindings']:
            ergebnis[b['ort']['value']].append({
                'item': b['item']['value'].rsplit('/', 1)[1],
                'bild': urllib.parse.unquote(b['bild']['value'].rsplit('/', 1)[1]),
                'dist': float(b['dist']['value']) * 1000,
                'namen': [x for x in [b.get('de', {}).get('value'), b.get('en', {}).get('value')] if x]
                + [x for x in b.get('alts', {}).get('value', '').split('|') if x],
            })
        return ergebnis
    for i in range(0, len(namen), 12):
        gruppe_holen(namen[i:i + 12])
    return treffer


def bester(ort, liste, orte_namen, ausnahmen):
    beste = None
    for k in liste:
        if f'File:{k["bild"]}' in ausnahmen['dateien'] or k['item'] in ausnahmen['objekte']:
            continue
        wert, exakt = max((bewertung(ort, n, orte_namen) for n in k['namen']), default=(0, False))
        if not wert or k['dist'] > (600 if exakt else 400):
            continue
        schluessel = (wert, -k['dist'])
        if not beste or schluessel > beste[0]:
            beste = (schluessel, {**k, 'name': k['namen'][0] if k['namen'] else k['item'], 'wert': wert})
    return beste[1] if beste else None


def text(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', s or ''))).strip()


def urheber_text(s):
    """„I, Bahnmoeller“ → „Bahnmoeller“, „User:Matthias Süßen“ → „Matthias Süßen“, ohne „(talk)“."""
    s = re.sub(r'\s*\((talk|Diskussion|contribs)\)', '', s or '')
    s = re.sub(r'^(I|Ich)\s*,\s*', '', s.strip())
    s = re.sub(r'\b(User|Benutzer|Benutzerin)\s*:\s*', '', s)
    return s.strip()[:120]


def lizenzen(dateien):
    """Lizenz und Urheber aus Commons (extmetadata, je 50 Dateien eine Abfrage – Wikimedia begrenzt die Rate).
    Ergebnis: Datei → {lizenz, lizenzLink, urheber} oder None (nicht frei genug, Persönlichkeitsrechte)."""
    ergebnis = {}
    dateien = list(dateien)
    for i in range(0, len(dateien), 50):
        teil = dateien[i:i + 50]
        q = urllib.parse.urlencode({'action': 'query', 'format': 'json', 'formatversion': 2, 'prop': 'imageinfo',
                                    'iiprop': 'extmetadata', 'titles': '|'.join(f'File:{d}' for d in teil)})
        roh = holen(f'https://commons.wikimedia.org/w/api.php?{q}', versuche=8, pause=3)
        if not roh:
            continue
        seiten = json.loads(roh)['query']
        namen = {n['to']: n['from'] for n in seiten.get('normalized', [])}
        for seite in seiten.get('pages', []):
            datei = namen.get(seite['title'], seite['title'])[5:]
            m = ((seite.get('imageinfo') or [{}])[0]).get('extmetadata', {})
            wert = lambda k: text(m.get(k, {}).get('value', ''))
            kurz = wert('LicenseShortName')
            frei = any(re.match(x, kurz, re.I) for x in LIZENZEN)
            if wert('NonFree') == 'true' or 'personality' in wert('Restrictions').lower() or not frei:
                ergebnis[datei] = None
                continue
            urheber = urheber_text(wert('Attribution') or wert('Artist'))
            gemeinfrei = bool(re.match(r'^(CC0|Public domain|PD)', kurz, re.I))
            if not urheber and not gemeinfrei:
                ergebnis[datei] = None
                continue
            ergebnis[datei] = {'lizenz': kurz, 'lizenzLink': m.get('LicenseUrl', {}).get('value', ''), 'urheber': urheber or 'unbekannt'}
        print(f'  Commons: {min(i + 50, len(dateien))}/{len(dateien)} Dateien', file=sys.stderr)
    return ergebnis


def bild_url(datei, breite):
    name = datei.replace(' ', '_')
    h = hashlib.md5(name.encode('utf-8')).hexdigest()
    q = urllib.parse.quote(name)
    return (f'https://upload.wikimedia.org/wikipedia/commons/thumb/{h[0]}/{h[:2]}/{q}/{breite}px-{q}',
            f'https://upload.wikimedia.org/wikipedia/commons/{h[0]}/{h[:2]}/{q}')


def slug(s):
    return re.sub(r'-+', '-', norm(s).replace(' ', '-'))[:48].strip('-') or 'ort'


def ablegen(datei, name):
    """Das Bild in zwei Größen als WebP ablegen. Nur Vorschaubilder in Standardbreiten – das Original
    liefert Wikimedia an Skripte nicht aus. False, wenn es nicht klappt (dann beim nächsten Lauf wieder)."""
    from PIL import Image  # nur hier gebraucht
    if not re.search(r'\.(jpe?g|png|webp)$', datei, re.I):
        return False
    roh = None
    for breite in (960, 500, 330):
        try:
            roh = holen(bild_url(datei, breite)[0], pause=4, versuche=6)
        except urllib.error.HTTPError as f:
            print(f'  … {datei} in {breite} px: {f.code}', file=sys.stderr)
            roh = None
        if roh:
            break
    if not roh:
        return False
    bild = Image.open(io.BytesIO(roh)).convert('RGB')
    ORDNER.mkdir(parents=True, exist_ok=True)
    for breite, endung, qualitaet in ((GROSS, '', 70), (KLEIN, '-klein', 72)):
        b = bild.copy()
        if b.width > breite:
            b = b.resize((breite, round(b.height * breite / b.width)), Image.LANCZOS)
        b.save(ORDNER / f'{name}{endung}.webp', 'WEBP', quality=qualitaet, method=6)
    return True


def bogen(eintraege, pfad):
    """Kontaktbogen: je Bild Ort, Objekt und Lizenz – zum Prüfen mit bloßem Auge."""
    from PIL import Image, ImageDraw, ImageFont
    pfad = Path(pfad)
    pfad.mkdir(parents=True, exist_ok=True)
    try:
        schrift = ImageFont.truetype('DejaVuSans.ttf', 13)
    except OSError:
        schrift = ImageFont.load_default()
    pro_seite, spalten, w, h = 24, 4, 300, 250
    for s in range(0, len(eintraege), pro_seite):
        teil = eintraege[s:s + pro_seite]
        blatt = Image.new('RGB', (spalten * w, math.ceil(len(teil) / spalten) * h), 'white')
        d = ImageDraw.Draw(blatt)
        for i, (ort, info) in enumerate(teil):
            x, y = (i % spalten) * w, (i // spalten) * h
            b = Image.open(ORDNER / f'{info["name"]}.webp')
            b.thumbnail((w - 10, h - 60))
            blatt.paste(b, (x + 5, y + 5))
            d.text((x + 5, y + h - 52), f'{s + i + 1}. {ort[:38]}', fill='black', font=schrift)
            d.text((x + 5, y + h - 36), f'→ {info["objekt"][:38]}', fill='#0e6f69', font=schrift)
            d.text((x + 5, y + h - 20), f'{info["lizenz"]} · {info["urheber"][:26]}', fill='#555', font=schrift)
        blatt.save(pfad / f'bogen-{s // pro_seite + 1}.jpg', quality=80)
    print(f'Kontaktbogen: {pfad} ({math.ceil(len(eintraege) / pro_seite)} Blatt)', file=sys.stderr)


def main():
    a = argparse.ArgumentParser()
    a.add_argument('--alle', action='store_true', help='auch Orte erneut suchen, die bisher keinen Treffer hatten')
    a.add_argument('--bogen', help='Ordner für den Kontaktbogen der neu gefundenen Bilder')
    a.add_argument('--aufraeumen', action='store_true', help='Bilddateien löschen, die keinem Ort mehr gehören')
    a.add_argument('--nur-bogen', help='ohne Netz: Kontaktbogen aller zugeordneten Orte in diesen Ordner')
    a.add_argument('--nur-pflege', action='store_true', help='ohne Netz: nur Ausnahmen anwenden, Urheber aufräumen, speichern')
    arg = a.parse_args()
    if arg.nur_bogen:
        stand = json.loads(ZIEL.read_text(encoding='utf-8'))
        bogen([(o, {**stand['bilder'][n], 'name': n}) for o, n in stand['orte'].items()], arg.nur_bogen)
        return

    stand = json.loads(ZIEL.read_text(encoding='utf-8')) if ZIEL.exists() else {'version': 1, 'orte': {}, 'ohne': {}, 'bilder': {}}
    stand.setdefault('warten', {})
    aus = json.loads(AUSNAHMEN.read_text(encoding='utf-8')) if AUSNAHMEN.exists() else {}
    ausnahmen = {'orte': aus.get('orte', {}), 'dateien': aus.get('dateien', {}), 'objekte': aus.get('objekte', {})}
    heute = dt.date.today().isoformat()

    for b in stand['bilder'].values():
        b['urheber'] = urheber_text(b.get('urheber')) or 'unbekannt'
    for w in stand['warten'].values():
        if w.get('lizenz'):
            w['lizenz']['urheber'] = urheber_text(w['lizenz'].get('urheber')) or 'unbekannt'
        if f'File:{w["bild"]}' in ausnahmen['dateien'] or w['item'] in ausnahmen['objekte']:
            w['raus'] = True
    stand['warten'] = {o: w for o, w in stand['warten'].items()
                       if not w.pop('raus', False) and o not in ausnahmen['orte'] and o not in stand['orte']}
    # Was eine Ausnahme ist, fliegt auch aus dem Bestand.
    for ort, name in list(stand['orte'].items()):
        info = stand['bilder'].get(name, {})
        if ort in ausnahmen['orte'] or info.get('datei') in ausnahmen['dateien'] or info.get('wikidata') in ausnahmen['objekte']:
            del stand['orte'][ort]
    if arg.aufraeumen:
        benutzt = set(stand['orte'].values())
        for name in list(stand['bilder']):
            if name not in benutzt:
                del stand['bilder'][name]
                for endung in ('', '-klein'):
                    (ORDNER / f'{name}{endung}.webp').unlink(missing_ok=True)
        # … und Dateien, die zu keinem Bild gehören (etwa von einem abgebrochenen Lauf)
        for f in ORDNER.glob('*.webp') if ORDNER.exists() else []:
            if f.name.removesuffix('.webp').removesuffix('-klein') not in stand['bilder']:
                f.unlink()

    if arg.nur_pflege:
        stand['stand'] = heute
        for k in ('orte', 'ohne', 'bilder', 'warten'):
            stand[k] = dict(sorted(stand[k].items()))
        ZIEL.write_text(json.dumps({k: v for k, v in stand.items() if k != 'warten' or v}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        print(f'{len(stand["orte"])} Orte mit Foto, {len(stand["bilder"])} Bilder, {len(stand["warten"])} warten', file=sys.stderr)
        return

    orte = orte_aus_programm()
    orte_namen = set()
    for o in orte:
        for t in o.split(',')[1:]:
            orte_namen |= woerter(t)
    def faellig(o):
        if o in stand['orte'] or o in ausnahmen['orte'] or o in stand['warten']:
            return False
        if o in stand['ohne'] and not arg.alle:
            alt = dt.date.fromisoformat(stand['ohne'][o])
            return (dt.date.today() - alt).days >= NOCHMAL_NACH_TAGEN
        return True
    suchen = {o: v for o, v in orte.items() if faellig(o)}
    print(f'{len(orte)} Orte im Programm, {len(suchen)} zu suchen', file=sys.stderr)
    neu = []
    warten = stand.setdefault('warten', {})
    def speichern():
        # Sortiert schreiben, ohne die Wörterbücher selbst zu ersetzen – `warten` zeigt weiter auf dasselbe.
        stand['stand'] = heute
        aus_datei = {k: (dict(sorted(v.items())) if k in ('orte', 'ohne', 'bilder', 'warten') else v)
                     for k, v in stand.items() if k != 'warten' or v}
        ZIEL.write_text(json.dumps(aus_datei, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    suchen = {o: v for o, v in suchen.items() if o not in warten}
    if suchen:
        alle = kandidaten(suchen)
        for ort in sorted(suchen, key=lambda o: -suchen[o]['n']):
            k = bester(ort, alle[ort], orte_namen, ausnahmen)
            if k:
                warten[ort] = {'bild': k['bild'], 'item': k['item'], 'name': k['name'], 'dist': round(k['dist'])}
            else:
                stand['ohne'][ort] = heute
        speichern()
    bekannt = {i['datei']: n for n, i in stand['bilder'].items()}
    offen = sorted({w['bild'] for w in warten.values() if f'File:{w["bild"]}' not in bekannt and 'lizenz' not in w})
    if offen:
        lz = lizenzen(offen)
        for w in warten.values():
            if w['bild'] in lz:
                w['lizenz'] = lz[w['bild']] or False
        speichern()
    for ort, w in list(warten.items()):
        datei = f'File:{w["bild"]}'
        name = bekannt.get(datei)
        if not name:
            if 'lizenz' not in w:
                print(f'  ? {ort}: {datei} – Lizenz noch nicht abgefragt (Rate), nächstes Mal', file=sys.stderr)
                continue
            if not w['lizenz']:
                print(f'  ✗ {ort}: {datei} – Lizenz passt nicht', file=sys.stderr)
                stand['ohne'][ort] = heute
                del warten[ort]
                speichern()
                continue
            name = f'{slug(w["name"])}-{w["item"].lower()}'
            if not ablegen(w['bild'], name):
                print(f'  ? {ort}: {datei} – Bild nicht zu laden, nächstes Mal', file=sys.stderr)
                continue
            stand['bilder'][name] = {
                'datei': datei, 'objekt': w['name'], 'wikidata': w['item'],
                'seite': f'https://commons.wikimedia.org/wiki/{urllib.parse.quote(datei.replace(" ", "_"))}', **w['lizenz'],
            }
            bekannt[datei] = name
        stand['orte'][ort] = name
        stand['ohne'].pop(ort, None)
        del warten[ort]
        neu.append((ort, {**stand['bilder'][name], 'name': name}))
        print(f'  ✓ {ort} → {w["name"]} ({w["dist"]} m)', file=sys.stderr)
        speichern()

    speichern()
    print(f'{len(neu)} neue Zuordnungen; {len(stand["orte"])} Orte mit Foto, {len(stand["bilder"])} Bilder', file=sys.stderr)
    if arg.bogen and neu:
        bogen(neu, arg.bogen)


if __name__ == '__main__':
    main()
