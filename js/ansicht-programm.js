/*
 * Reiter „Programm“: Tag, Woche und Monat – darunter „Was immer geht“
 * (ansicht-ideen.js).
 *
 *   Tag     der ganze Tag: Wetter, Feiertag, Tipp, „Deine Zeit“ (ein
 *           Zeitstreifen von 7 bis 24 Uhr mit belegten Zeiten und Haken),
 *           Eingeplantes und alle Termine als Karten – nach Uhrzeit in
 *           „Den ganzen Tag“, Vormittag, Nachmittag und Abend, nach
 *           Entfernung ohne Gliederung –, zuletzt, was an dem Tag läuft.
 *           Oben die Tagesleiste: die sieben Tage der Woche wie eine
 *           Abfahrtstafel, mit der Zahl der Termine und wer Bock hat; ein
 *           Tipp wählt den Tag.
 *   Woche   oben „Für dich“ (zwei Tipps von Claude, ki-tipp.js), dann je Tag eine Karte: Wetter, Zeitstreifen, wie viele Termine, die
 *           Haken, Eingeplantes und Konzerte deiner Künstler, der Tipp des
 *           Tages. Ein Tipp öffnet den Tag. In der laufenden Woche dazu
 *           „Diese Woche“ (Highlights, Gut zu wissen), dann was die Woche
 *           über läuft und die Hinweise.
 *   Monat   das Blatt mit Zahlen, Bock-Punkten, ♫ für Konzerte deiner
 *           Künstler und Feiertagen. Ein Tipp wählt den Tag – darunter steht
 *           er wie eine Karte der Woche, ein Tipp darauf (oder ein zweiter
 *           aufs Feld) öffnet ihn. Dazu die Konzerte deiner Künstler im Monat.
 *
 * Alle drei teilen den Kopf: die Ansicht, blättern (‹ ›, „Heute“, auch
 * Wischen), Filter mit Chips und Zähler. Überall dieselbe Auswahl: Filter und
 * 21:30-Regel (filter.js). Nach dem Programm reichen Konzerte der eigenen
 * Künstler und Eingeplantes Monate weiter – Tage dort zeigen nur das.
 *
 * Vergangenes steht nicht da: Es geht erst ab heute los (die Tage davor sind
 * in Tagesleiste und Monat blass und ohne Zahl, die Woche beginnt mit heute),
 * und heute fehlt, was schon zu Ende ist (schonVorbei in zeit.js).
 */
import { esc, anzahl } from './text.js';
import {
  monatsRaster, monatVon, monatPlus, monatJahr, datumMitTag, montag, plusTage, kalenderwoche, wochentag, wochentagKurz, tagMonat,
  beginn, ende, zeitAm, uhrzeit, jetztMinuten, werktag, schonVorbei,
} from './zeit.js';
import {
  termineAm, laufendZwischen, letzterTag, filterFuer, spaetText, umkreisAn, istOnline,
} from './filter.js';
import {
  karte, eintragTermin, eintragLaufend, aufklappbar,
} from './karte.js';
import { meinBock } from './speicher.js';
import { andere, treffer as istTreffer, rolle, gastgeberName } from './gemeinsam.js';
import { geplante } from './ideen.js';
import { belegtAm, bekannt } from './zeiten.js';
import { filterLeiste, chipsProgramm } from './ansicht-filter.js';
import { planenForm, meldungBox } from './ansicht-ideen.js';
import {
  kiSchluessel, gemerkteTipps, tippTermin, kiUi,
} from './ki-tipp.js';

/** Die drei Ansichten, vom Tag zum Überblick. */
export const ANSICHTEN = [['tag', 'Tag'], ['woche', 'Woche'], ['monat', 'Monat']];
const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// Der Zeitstreifen zeigt 7 bis 24 Uhr.
const VON = 7 * 60;
const BIS = 24 * 60;
const TAG = 24 * 60;

/** Der erste und der letzte Tag, durch den man blättern kann: von heute – Vergangenes zeigt die App nicht – bis zum Ende des Monats mit dem letzten Termin oder Plan. */
export function tagesBereich(p, heute) {
  const bis = p ? letzterTag(p, geplante().map((e) => e.datum)) : heute;
  const letzterMonat = monatVon(bis > heute ? bis : heute);
  const d = new Date(`${letzterMonat}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return { erster: heute, letzter: d.toISOString().slice(0, 10) };
}

/** Der gewählte Tag – liegt er außerhalb, dann heute. */
const gewaehlterTag = (p, heute, ui) => {
  const { erster, letzter } = tagesBereich(p, heute);
  return ui.datum && ui.datum >= erster && ui.datum <= letzter ? ui.datum : heute;
};

/** Die Woche als Titel: „KW 45 · 2.11. – 8.11.“ */
export const wochenTitel = (mo) => `KW ${kalenderwoche(mo)} · ${tagMonat(mo)} – ${tagMonat(plusTage(mo, 6))}`;

/** „Samstag, 31.10.“ – das Jahr nur, wenn es nicht dieses ist. */
const tagTitel = (d, heute) => `${wochentag(d)}, ${tagMonat(d)}${d.slice(0, 4) === heute.slice(0, 4) ? '' : d.slice(0, 4)}`;

// --- Was an einem Tag steht

/** Termine (nach Filtern und 21:30-Regel) und Eingeplantes eines Tages – heute ohne das, was schon vorbei ist. */
function tagDaten(p, d, f, plaene) {
  const {
    tag, liste, spaet, spaetOnline, spaete,
  } = termineAm(p, d, f);
  // Ist die 21:30-Regel abgestellt, trägt, was sie sonst ausblenden würde, eine Marke (karte.js).
  const termine = liste.map((e) => {
    const x = eintragTermin(e, tag, p.tage);
    if (spaete.has(e)) x.spaet = istOnline(e) ? 'beginnt nach 21:30' : 'endet nach 21:30';
    return x;
  });
  const geplant = plaene.filter((e) => e.datum === d && !schonVorbei(e, d));
  return {
    tag, termine, geplant, spaet, spaetOnline, alle: [...geplant, ...termine],
  };
}

/** Wer an einem Tag Bock hat: ich und die anderen nach ihrer Nummer – und ob es einen Treffer gibt. */
export function punkte(eintraege) {
  const wer = new Set();
  let treffer = false;
  for (const x of eintraege) {
    if (meinBock(x.schluessel)) wer.add('ich');
    for (const p of andere(x.schluessel)) wer.add(`p${p.nr % 4}`);
    if (istTreffer(x.schluessel)) treffer = true;
  }
  return { wer: [...wer], treffer };
}

/** Was im Zeitstreifen und in der Wochenkarte zählt: eigene Haken, Haken der anderen, Eingeplantes. */
const zaehlt = (e) => e.quelle === 'plan' || meinBock(e.schluessel) || andere(e.schluessel).length > 0;

/** Farbe eines Hakens: Treffer, eigener Haken, Haken der anderen, Eingeplantes. */
function hakenKlasse(e) {
  if (istTreffer(e.schluessel)) return 'treffer';
  if (meinBock(e.schluessel)) return 'ich';
  const sie = andere(e.schluessel);
  if (sie.length) return `p${sie[0].nr % 4}`;
  return 'plan';
}

/** Beginn und Ende in Minuten des Tages – ganztägig und ohne Uhrzeit: null. */
function spanne(e) {
  if (e.ganztags) return null;
  const b = beginn(zeitAm(e, e.datum));
  if (b === null) return null;
  const i = ende(e, e.datum);
  const bis = i && i.ende > b ? Math.min(i.ende, TAG) : Math.min(b + 120, TAG);
  return [b, Math.max(bis, b + 30)];
}

// --- Der Zeitstreifen: 7 bis 24 Uhr, belegt schraffiert, Haken als Marker, jetzt als Strich

const prozent = (t) => `${(((Math.min(Math.max(t, VON), BIS) - VON) / (BIS - VON)) * 100).toFixed(2)}%`;
const breite = (a, b) => `calc(${prozent(b)} - ${prozent(a)})`;
const blockText = ([a, b]) => `${uhrzeit(a)}–${b >= TAG ? '24:00' : uhrzeit(b)}`;
const belegtImStreifen = (d) => belegtAm(d).filter(([a, b]) => b > VON && a < BIS);

function zeitstreifen(d, wichtig, heute, { klein = false } = {}) {
  const marker = wichtig.map((e) => ({ e, s: spanne(e) })).filter((x) => x.s);
  if (!bekannt(d) && !marker.length) return '';
  const belegt = belegtImStreifen(d).map(([a, b]) => `<i class="zs-belegt" style="left:${prozent(a)};width:${breite(a, b)}"></i>`).join('');
  const haken = marker.map(({ e, s }) => `<i class="zs-haken ${hakenKlasse(e)}" style="left:${prozent(s[0])};width:${breite(s[0], s[1])}"></i>`).join('');
  const t = jetztMinuten();
  const jetzt = d === heute && t >= VON && t <= BIS ? `<i class="zs-jetzt" style="left:${prozent(t)}"></i>` : '';
  const skala = klein ? '' : `<span class="zs-skala">${[8, 12, 16, 20, 24].map((h) => `<i style="left:${prozent(h * 60)}">${h}</i>`).join('')}</span>`;
  return `<span class="zeitstreifen${klein ? ' klein' : ''}" aria-hidden="true"><span class="zs-balken">${belegt}${haken}${jetzt}</span>${skala}</span>`;
}

/** Ein Satz zur Zeit des Tages – „Belegt 07:00–15:30, frei ab 15:30.“ –, nur wenn die App die Woche kennt. */
function zeitSatz(d) {
  if (!bekannt(d)) return '';
  const belegt = belegtImStreifen(d);
  const ich = rolle() === 'gastgeber';
  const n = esc(gastgeberName() || 'Der Gastgeber');
  if (!belegt.length) return ich ? 'Den ganzen Tag frei.' : `${n} hat den ganzen Tag Zeit.`;
  const letzter = belegt[belegt.length - 1][1];
  const frei = letzter < BIS ? ` Frei ab ${uhrzeit(letzter)}.` : '';
  return `${ich ? 'Belegt' : `${n} ist belegt`} ${belegt.map(blockText).join(', ')}.${frei}`;
}

// --- Bausteine

/** Kurzes Wetter für die Wochenkarte: „13°/6° · teils sonnig“. */
export function wetterKurz(text) {
  const t = String(text || '').replace(/^Hamburg\s*:?\s*/i, '').trim();
  if (!t) return '';
  const temp = t.match(/-?\d+°(?:\s*\/\s*-?\d+°)?/);
  const rest = (temp ? t.replace(temp[0], '') : t).replace(/^[\s,:;–-]+/, '');
  const wort = rest.split(/[,.;(–]/)[0].trim();
  return [temp ? temp[0].replace(/\s+/g, '') : '', wort].filter(Boolean).join(' · ');
}

/** Ein aufklappbarer Kasten über die ganze Breite: Titel, Zahl, zugeklappt eine Zeile Vorschau. */
function kasten(name, titel, inhalt, { zahl = '', vorschau = '', id = '' } = {}) {
  const kopf = `<span class="ka-titel">${esc(titel)}</span>${zahl !== '' ? `<span class="ka-zahl">${zahl}</span>` : ''}${vorschau ? `<span class="ka-vorschau">${esc(vorschau)}</span>` : ''}`;
  return aufklappbar(name, kopf, inhalt, { klasse: 'kasten', id });
}

const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/;

/**
 * „Für dich“ (ki-tipp.js): zwei Termine der Woche, die Claude ausgesucht hat,
 * jeder mit einem Satz, warum – als Karten wie im Tag. Nur mit Schlüssel auf
 * dem Gerät, nicht bei Eingeladenen und nicht nach dem Ende des Programms.
 */
function fuerDich(p, mo, heute) {
  if (rolle() === 'mitglied' || mo > p.bis || !kiSchluessel()) return '';
  const gemerkt = gemerkteTipps(mo);
  const tipps = (gemerkt ? gemerkt.liste : [])
    .filter((t) => t.datum >= heute)
    .map((t) => ({ t, x: tippTermin(p, t) }))
    .filter(({ t, x }) => x && !schonVorbei(x.e, t.datum));
  const laeuft = kiUi.laeuft === mo;
  const fehler = kiUi.fehler && kiUi.woche === mo ? `<div class="fehlerbox" role="alert">${esc(kiUi.fehler)}</div>` : '';
  const liste = tipps.map(({ t, x }) => `<div class="fd-tipp">
      <p class="fd-warum"><button type="button" class="fd-tag" data-tag="${t.datum}">${wochentagKurz(t.datum)} ${tagMonat(t.datum)}</button> ${esc(t.warum)}</p>
      ${karte(eintragTermin(x.e, x.tag, p.tage), { zeitSpalte: true })}
    </div>`).join('');
  const knopf = `<button type="button" class="knopf${tipps.length ? ' klein' : ' haupt'}" data-aktion="ki-tipp" data-woche="${mo}"${laeuft ? ' disabled' : ''}>${laeuft ? 'Claude sucht …' : tipps.length ? 'Neu fragen' : 'Zwei Tipps holen'}</button>`;
  return `<section class="fuer-dich" id="fuer-dich" aria-labelledby="fuer-dich-titel">
    <div class="fd-kopf"><h2 class="fd-titel" id="fuer-dich-titel">✨ Für dich</h2>${tipps.length ? knopf : ''}</div>
    ${liste || `<p class="fein">Claude sucht dir zwei Termine dieser Woche aus, die zu dir und deinem Kalender passen.</p>${knopf}`}
    ${laeuft ? '<p class="fein" role="status">Claude schaut sich das Programm der Woche an …</p>' : ''}
    ${fehler}
  </section>`;
}

/**
 * Die Highlights einer Woche: Der Monatslauf gibt jedem ein „datum“ – es
 * steht in seiner Woche, ab heute. Highlights ohne Datum (ältere Läufe)
 * gehören zur ersten Woche des Programms.
 */
const highlightsDer = (p, mo, heute) => p.highlights.filter((h) => (ISO_TAG.test(h.datum || '')
  ? h.datum >= heute && h.datum >= mo && h.datum <= plusTage(mo, 6)
  : mo === montag(p.von)));

/** Infos gelten, bis ihr „bis“ vorbei ist (und ab „von“) – ohne die beiden immer. */
const infosDer = (p, mo, heute) => p.infos.filter((i) => (!ISO_TAG.test(i.bis || '') || i.bis >= heute) && (!ISO_TAG.test(i.von || '') || i.von <= plusTage(mo, 6)));

/**
 * „Diese Woche“: die Highlights und Infos des Monatslaufs für die laufende
 * Woche. In späteren Wochen ein Kasten „Highlights“ mit denen dieser Woche.
 */
function dieseWocheKasten(p, mo, heute) {
  const jetzt = mo === montag(heute);
  const highlights = highlightsDer(p, mo, heute);
  const infos = jetzt ? infosDer(p, mo, heute) : [];
  if (!infos.length && !highlights.length) return '';
  const vorschau = [...highlights.map((h) => h.titel), ...infos.map((i) => i.titel || i.text)].filter(Boolean).join(' · ');
  const inhalt = `${highlights.length ? `<h3 class="ka-unter">${anzahl(highlights.length, 'Highlight', 'Highlights')}</h3>
      <ol class="highlights">${highlights.map((h) => `<li><strong>${esc(h.titel)}</strong><span>${esc(h.text)}</span></li>`).join('')}</ol>` : ''}
    ${infos.length ? `<h3 class="ka-unter">Gut zu wissen</h3>
      <ul class="infos">${infos.map((i) => `<li>${i.titel ? `<b>${esc(i.titel)}:</b> ` : ''}${esc(i.text)}</li>`).join('')}</ul>` : ''}`;
  return kasten('diese-woche', jetzt ? 'Diese Woche' : 'Highlights', inhalt, { vorschau, id: 'diese-woche' });
}

/**
 * Was über Tage oder Wochen läuft – als Kasten mit Karten. Was noch läuft,
 * lässt sich für einen Tag einplanen; vorgeschlagen wird `tag` (in der Woche
 * ihr Samstag).
 */
function laufendKasten(liste, titel, { heute, tag = '', ctx = {} }) {
  if (!liste.length) return '';
  const k = (e) => {
    const x = eintragLaufend(e);
    if (x.bis < heute) return karte(x);
    const offen = ctx.planen === `laufend|${x.schluessel}`;
    return karte(x, { planen: { bereich: 'laufend', offen, form: offen ? planenForm(x, 'laufend', heute, { tag, fehler: ctx.planFehler }) : '' } });
  };
  const inhalt = `<p class="fein">Über Tage oder Wochen, mit ihren Zeiten – der Filter „Mo–Fr ab 15:30“ wirkt hier nicht. Wenn ihr an einem bestimmten Tag hinwollt: aufklappen, „Einplanen“.</p>
    ${liste.map(k).join('')}`;
  return kasten('laufend', titel, inhalt, { zahl: liste.length, vorschau: liste.slice(0, 3).map((e) => e.titel).join(' · '), id: 'abschnitt-laufend' });
}

function hinweiseKasten(p) {
  if (!p.hinweise.length) return '';
  const inhalt = `<ul class="hinweise">${p.hinweise.map((h) => `<li>${h.titel ? `<b>${esc(h.titel)}:</b> ` : ''}${esc(h.text)}</li>`).join('')}</ul>`;
  return kasten('hinweise', 'Hinweise', inhalt, { vorschau: p.hinweise.map((h) => h.titel).filter(Boolean).join(' · '), id: 'abschnitt-hinweise' });
}

/** Ein leerer Tag sagt, woran es liegt. */
function leerText(p, d, st, f) {
  if (d > p.bis) return 'Für diesen Tag gibt es noch kein Programm – nur Konzerte deiner Künstler und Eingeplantes stehen schon fest.';
  return chipsProgramm(st).length
    ? `Keine Termine für diese Filter${umkreisAn(f) ? ` bis ${f.umkreis} km` : ''}. <button type="button" class="textknopf" data-aktion="filter-weg">Alle zeigen</button>`
    : 'Keine Termine.';
}

// --- Tag

const TEILE = [['ganz', 'Den ganzen Tag'], ['vormittag', 'Vormittag'], ['nachmittag', 'Nachmittag'], ['abend', 'Abend']];

function tagesteil(e) {
  const b = e.ganztags ? null : beginn(e.zeit);
  if (b === null) return 'ganz';
  if (b < 12 * 60) return 'vormittag';
  if (b < 17 * 60) return 'nachmittag';
  return 'abend';
}

// data-teil wählt das Zeichen davor (Sonnenaufgang, Sonne, Mond …, styles.css)
const teilKopf = (titel, n, teil) => `<h3 class="tagesteil" data-teil="${teil}"><span>${esc(titel)}</span><span class="tt-zahl">${n}</span></h3>`;

/** Ein Zeichen fürs Wetter, aus den Worten des Tages – bei Hamburger Wetter im Zweifel die Wolke. */
const WETTER_ZEICHEN = {
  gewitter: '<path d="M7.5 15.5H7a4 4 0 0 1-.4-8 5.5 5.5 0 0 1 10.6 1.3 3.4 3.4 0 0 1-.2 6.7"/><path d="M12.5 12l-2.5 4.5h3.5L11 21"/>',
  schnee: '<path d="M7.5 15.5H7a4 4 0 0 1-.4-8 5.5 5.5 0 0 1 10.6 1.3 3.4 3.4 0 0 1 .3 6.7h-.5"/><path d="M9 18.5h.01M12 20.5h.01M15 18.5h.01M10.5 21.5h.01M13.5 17.5h.01"/>',
  regen: '<path d="M7.5 15.5H7a4 4 0 0 1-.4-8 5.5 5.5 0 0 1 10.6 1.3 3.4 3.4 0 0 1 .3 6.7h-.5"/><path d="M9 18l-1 2.5M12.5 18l-1 2.5M16 18l-1 2.5"/>',
  nebel: '<path d="M4 9h16M6 13h12M4 17h16"/>',
  teils: '<circle cx="8.5" cy="8.5" r="3"/><path d="M8.5 2.8v1.1M3.8 4.9l.8.8M2.8 9.5h1.1M13.2 4.9l-.8.8"/><path d="M9.5 19.5h7.7a3.3 3.3 0 0 0 .3-6.6 4.6 4.6 0 0 0-8.8 1.1 2.8 2.8 0 0 0 .8 5.5z"/>',
  sonne: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.5 5.5L7 7M17 17l1.5 1.5M5.5 18.5L7 17M17 7l1.5-1.5"/>',
  wolke: '<path d="M7.5 18.5h9.8a3.7 3.7 0 0 0 .4-7.4 5.7 5.7 0 0 0-10.9 1.5 3 3 0 0 0 .7 5.9z"/>',
};
function wetterArt(text) {
  const t = String(text).toLowerCase();
  if (/gewitter/.test(t)) return 'gewitter';
  if (/schnee|graupel/.test(t)) return 'schnee';
  if (/regen|regn|schauer|niesel/.test(t)) return 'regen';
  if (/nebel|dunst/.test(t)) return 'nebel';
  if (/teils|wechsel|aufgelockert|heiter/.test(t)) return 'teils';
  if (/sonn|klar/.test(t) && !/wolk|bedeckt|grau/.test(t)) return 'sonne';
  return 'wolke';
}
/** Das Wetter vorn im Tag: Zeichen, die Temperaturen groß, dann der Satz. */
function wetterZeile(text) {
  const t = text.replace(/^Hamburg\s*:?\s*/i, '');
  const m = t.match(/^\s*([-−]?\d+°(?:\s*\/\s*[-−]?\d+°)?)[\s,;:–-]*/);
  const zeichen = `<svg class="wetter-zeichen" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${WETTER_ZEICHEN[wetterArt(t)]}</svg>`;
  return m
    ? `${zeichen}<b class="temp">${esc(m[1].replace(/\s+/g, ''))}</b><span>${esc(t.slice(m[0].length))}</span>`
    : `${zeichen}<span>${esc(t)}</span>`;
}

/** Die sieben Tage der Woche wie eine Abfahrtstafel – klebt oben, ein Tipp wählt den Tag. Vergangene Tage stehen blass da, ohne Zahl. */
function tagesleiste(p, st, heute, datum, plaene) {
  const f = filterFuer(st);
  const { erster, letzter } = tagesBereich(p, heute);
  const mo = montag(datum);
  return `<nav class="tagleiste" aria-label="Tage der Woche">${Array.from({ length: 7 }, (_, i) => plusTage(mo, i)).map((d) => {
    if (d < heute) {
      return `<button type="button" class="tagzelle vorbei" data-tag="${d}" aria-label="${esc(datumMitTag(d))}: vorbei" disabled>
      <span class="tz-wt">${wochentagKurz(d)}</span><span class="tz-nr">${Number(d.slice(8))}</span><span class="tz-unter"></span>
    </button>`;
    }
    const td = tagDaten(p, d, f, plaene);
    const zahl = td.alle.length;
    const { wer } = punkte(td.alle);
    const klassen = ['tagzelle', d === heute ? 'ist-heute' : '', d === datum ? 'gewaehlt' : ''].filter(Boolean).join(' ');
    return `<button type="button" class="${klassen}" data-tag="${d}" aria-pressed="${d === datum}" aria-label="${esc(datumMitTag(d))}: ${anzahl(zahl, 'Termin', 'Termine')}${wer.length ? ', mit Bock' : ''}"${d < erster || d > letzter ? ' disabled' : ''}>
      <span class="tz-wt">${wochentagKurz(d)}</span><span class="tz-nr">${Number(d.slice(8))}</span>
      <span class="tz-unter"><span class="tz-zahl">${zahl || '–'}</span>${wer.slice(0, 3).map((x) => `<i class="pkt ${x}"></i>`).join('')}</span>
    </button>`;
  }).join('')}</nav>`;
}

function tagAnsicht(p, st, heute, d, plaene, ctx = {}) {
  const f = filterFuer(st);
  const td = tagDaten(p, d, f, plaene);
  const { tag } = td;
  const wichtig = td.alle.filter(zaehlt);
  const fakten = [
    // „Wetter“ sagt das Zeichen – das Wort steht nur für Vorleser da.
    tag.wetter ? `<dt class="sr">Wetter</dt><dd class="wetter">${wetterZeile(tag.wetter)}</dd>` : '',
    tag.wetterOstsee ? `<dt>Ostsee</dt><dd>${esc(tag.wetterOstsee.replace(/^Ostsee\/Kiel\s*:?\s*/i, ''))}</dd>` : '',
    tag.feiertag ? '<dt>Feiertag</dt><dd>gesetzlicher Feiertag</dd>' : '',
    tag.tipp ? `<dt class="tipp-titel">Tipp</dt><dd>${esc(tag.tipp)}</dd>` : '',
    f.feierabend && werktag(tag) ? '<dt>Filter</dt><dd>Mo–Fr ab 15:30: nur, was nach Feierabend noch geht.</dd>' : '',
    // Die Regel lässt sich gleich hier ab- und wieder anstellen – wie im Filter unter „Wann“.
    td.spaet ? `<dt>21:30</dt><dd>${spaetText(td.spaet, td.spaetOnline, f.auchSpaet)}. <button type="button" class="textknopf" data-aktion="${f.auchSpaet ? 'spaet-ausblenden' : 'spaet-zeigen'}">${f.auchSpaet ? 'Wieder ausblenden' : 'Zeigen'}</button></dd>` : '',
  ].join('');
  const streifen = zeitstreifen(d, wichtig, heute);
  const satz = zeitSatz(d);
  const n = esc(gastgeberName() || 'der Gastgeber');
  const zeit = streifen || satz ? `<div class="deine-zeit">
      <div class="dz-kopf"><span class="dz-titel">${rolle() === 'mitglied' ? `Wann ${n} kann` : 'Deine Zeit'}</span>${satz ? `<span class="dz-satz">${satz}</span>` : ''}</div>
      ${streifen}
    </div>` : '';

  const nachEntfernung = Boolean(f.bezug && f.nachEntfernung);
  const k = (e) => karte(e, { zeitSpalte: true });
  const geplant = td.geplant.length ? `${teilKopf('Eingeplant', td.geplant.length, 'plan')}${td.geplant.map(k).join('')}` : '';
  const termine = nachEntfernung
    ? td.termine.map(k).join('')
    : TEILE.map(([key, titel]) => {
      const liste = td.termine.filter((e) => tagesteil(e) === key);
      return liste.length ? `${teilKopf(titel, liste.length, key)}${liste.map(k).join('')}` : '';
    }).join('');
  const leer = td.termine.length || (td.geplant.length && d > p.bis) ? '' : `<div class="leer-klein">${leerText(p, d, st, f)}</div>`;

  // Die Hülle begrenzt die klebende Tagesleiste: Bei „Was immer geht“ scrollt sie mit weg.
  return `<div class="tag-huelle">
    ${tagesleiste(p, st, heute, d, plaene)}
    <section class="tag" id="tag-${d}" aria-label="${esc(datumMitTag(d))}">
      ${ctx.meldung && ctx.meldung.ort === 'programm' && ctx.meldung.tag === d ? meldungBox(ctx.meldung) : ''}
      ${fakten ? `<dl class="tag-info">${fakten}</dl>` : ''}
      ${zeit}
      ${geplant}${termine}${leer}
    </section>
    ${laufendKasten(laufendZwischen(p, d, d, f), d === heute ? 'Läuft heute' : 'Läuft an dem Tag', { heute, tag: d, ctx })}
  </div>`;
}

// --- Woche

/** Die Zeile eines Eintrags in der Wochenkarte: Uhrzeit und Titel. */
function eintragZeile(e) {
  const b = e.ganztags ? null : beginn(e.zeit);
  const uhr = e.ganztags ? 'ganzt.' : (b === null ? '' : uhrzeit(b));
  const art = zaehlt(e) ? hakenKlasse(e) : 'kuenstler';
  return `<span class="wt-eintrag ${art}"><span class="wt-uhr">${esc(uhr)}</span><span class="wt-titel">${e.kuenstler ? '♫ ' : ''}${esc(e.titel)}</span></span>`;
}

/**
 * Ein Tag als Karte (Woche, Vorschau im Monat): Wetter, Zeitstreifen, Zahl,
 * Haken, Eingeplantes und Konzerte deiner Künstler, der Tipp. Ein Tipp öffnet den Tag.
 */
function tagKarte(p, d, f, plaene, heute, { vorschau = false } = {}) {
  const td = tagDaten(p, d, f, plaene);
  const { tag } = td;
  const wichtig = td.alle.filter(zaehlt);
  const zeilen = [...wichtig, ...td.termine.filter((e) => e.kuenstler && !zaehlt(e))];
  const zeig = zeilen.slice(0, 4);
  const ohneProgramm = d > p.bis;
  const zahlText = ohneProgramm && !td.alle.length
    ? 'noch kein Programm'
    : `${anzahl(td.termine.length, 'Termin', 'Termine')}${wichtig.length ? ` · ${wichtig.length} mit Bock` : ''}`;
  const wetter = wetterKurz(tag.wetter);
  const klassen = ['wtag', d === heute ? 'heute' : '', ohneProgramm ? 'ohne' : '', vorschau ? 'vorschau' : ''].filter(Boolean).join(' ');
  return `<button type="button" class="${klassen}" data-tag="${d}">
    <span class="wt-datum"><span class="wt-wt">${wochentagKurz(d)}</span><span class="wt-nr">${Number(d.slice(8))}</span>${vorschau ? `<span class="wt-monat">${esc(monatJahr(d).split(' ')[0].slice(0, 3))}</span>` : ''}</span>
    <span class="wt-inhalt">
      <span class="wt-kopf">${wetter ? `<span class="wt-wetter">${esc(wetter)}</span>` : ''}${tag.feiertag ? '<span class="wt-feiertag">Feiertag</span>' : ''}${d === heute ? '<span class="wt-heute">heute</span>' : ''}<span class="wt-zahl">${zahlText}</span></span>
      ${zeitstreifen(d, wichtig, heute, { klein: true })}
      ${zeig.length ? `<span class="wt-liste">${zeig.map(eintragZeile).join('')}${zeilen.length > zeig.length ? `<span class="wt-mehr">+ ${zeilen.length - zeig.length} weitere</span>` : ''}</span>` : ''}
      ${tag.tipp ? `<span class="wt-tipp"><b>Tipp</b> ${esc(tag.tipp)}</span>` : ''}
      ${vorschau ? '<span class="wt-auf">Ganzen Tag ansehen</span>' : ''}
    </span>
    <span class="wt-pfeil" aria-hidden="true"></span>
  </button>`;
}

function wocheAnsicht(p, st, heute, mo, plaene, ctx = {}) {
  const f = filterFuer(st);
  // In dieser Woche erst ab heute – was vorbei ist, braucht keine Karte.
  const tage = Array.from({ length: 7 }, (_, i) => plusTage(mo, i)).filter((d) => d >= heute);
  const dieseWoche = mo === montag(heute);
  const zeiten = tage.some((d) => bekannt(d));
  const n = esc(gastgeberName() || 'der Gastgeber');
  const legende = zeiten || tage.some((d) => tagDaten(p, d, f, plaene).alle.some(zaehlt))
    ? `<p class="legende"><span><i class="lg-frei"></i> frei</span>${zeiten ? `<span><i class="lg-belegt"></i> ${rolle() === 'gastgeber' ? 'belegt (Kalender)' : `${n} ist belegt`}</span>` : ''}<span><i class="lg-haken ich"></i> dein Haken</span><span><i class="lg-haken p0"></i> die anderen</span><span><i class="lg-haken plan"></i> eingeplant</span></p>`
    : '';
  return `${fuerDich(p, mo, heute)}
  ${dieseWocheKasten(p, mo, heute)}
  ${mo > p.bis ? '<div class="banner">Für diese Woche gibt es noch kein Programm – hier stehen nur Konzerte deiner Künstler und was ihr eingeplant habt. Es kommt mit dem Monatslauf am Ersten, sobald die Woche in den nächsten acht Wochen liegt.</div>' : ''}
  <div class="wochen-liste">${tage.map((d) => tagKarte(p, d, f, plaene, heute)).join('')}</div>
  ${legende}
  ${laufendKasten(laufendZwischen(p, mo < heute ? heute : mo, plusTage(mo, 6), f), 'Läuft diese Woche', { heute, tag: plusTage(mo, 5), ctx })}
  ${dieseWoche ? hinweiseKasten(p) : ''}`;
}

// --- Monat

function monatAnsicht(p, st, heute, monat, datum, plaene) {
  const f = filterFuer(st);
  // Wie voll ein Tag ist, im Verhältnis zum vollsten des Monats – das Feld färbt sich danach (--dichte).
  const kommend = monatsRaster(monat).filter((d) => d >= heute && monatVon(d) === monat && d <= p.bis);
  const meiste = Math.max(1, ...kommend.map((d) => tagDaten(p, d, f, plaene).termine.length));
  const felder = monatsRaster(monat).map((d) => {
    if (d < heute) {
      return `<button type="button" class="feld vorbei${monatVon(d) === monat ? '' : ' fremd'}" data-waehle="${d}" aria-label="${esc(datumMitTag(d))}: vorbei" disabled><span class="nr">${Number(d.slice(8))}</span></button>`;
    }
    const td = tagDaten(p, d, f, plaene);
    const { wer, treffer } = punkte(td.alle);
    const n = td.termine.length;
    const kuenstler = td.termine.some((e) => e.kuenstler);
    const klassen = ['feld', monatVon(d) === monat ? '' : 'fremd', d === heute ? 'heute' : '', d > p.bis ? 'ohne' : '',
      treffer ? 'treffer' : '', td.tag.feiertag ? 'feiertag' : '', d === datum ? 'gewaehlt' : ''].filter(Boolean).join(' ');
    const dichte = n && d <= p.bis ? ` style="--dichte:${Math.min(1, n / meiste).toFixed(2)}"` : '';
    return `<button type="button" class="${klassen}" data-waehle="${d}" aria-pressed="${d === datum}"${dichte} aria-label="${esc(datumMitTag(d))}: ${anzahl(n, 'Termin', 'Termine')}${kuenstler ? ', Konzert deiner Künstler' : ''}${wer.length ? ', mit Bock' : ''}${td.tag.feiertag ? ', Feiertag' : ''}">
      <span class="nr">${Number(d.slice(8))}</span>${n ? `<span class="zahl">${n}</span>` : ''}
      <span class="f-unten">${kuenstler ? '<span class="f-kuenstler">♫</span>' : ''}${wer.length ? `<span class="punkte">${wer.map((w) => `<i class="pkt ${w}"></i>`).join('')}</span>` : ''}</span>
    </button>`;
  }).join('');

  const konzerte = p.termine.filter((e) => e.kuenstler)
    .flatMap((e) => e.daten.filter((d) => monatVon(d) === monat && d >= heute && !schonVorbei(e, d)).map((d) => ({ e, d })))
    .sort((a, b) => a.d.localeCompare(b.d) || String(a.e.zeit).localeCompare(String(b.e.zeit)));
  const konzertListe = konzerte.length ? `<section class="abschnitt-klein" id="monat-konzerte">
      <h3 class="tagesteil" data-teil="konzerte"><span>Deine Konzerte</span><span class="tt-zahl">${konzerte.length}</span></h3>
      ${konzerte.map(({ e, d }) => `<button type="button" class="konzert-zeile" data-tag="${d}">
        <span class="kz-datum">${wochentagKurz(d)} ${tagMonat(d)}</span><span class="kz-titel">♫ ${esc(e.titel)}</span><span class="kz-ort">${esc([e.ort, zeitAm(e, d)].filter(Boolean).join(' · '))}</span>
      </button>`).join('')}
    </section>` : '';

  return `<div class="kalender" role="group" aria-label="${esc(monatJahr(`${monat}-01`))}" data-monat="${monat}">
    ${WOCHENTAGE.map((w) => `<div class="wt">${w}</div>`).join('')}
    ${felder}
  </div>
  <p class="legende"><span>Zahl: Termine</span><span><i class="pkt ich"></i> dein Haken</span><span><i class="pkt p0"></i> die anderen</span><span><b class="f-kuenstler">♫</b> deine Künstler</span><span><b class="lg-feiertag">1</b> Feiertag</span></p>
  <div class="monat-vorschau">${tagKarte(p, datum, f, plaene, heute, { vorschau: true })}</div>
  ${konzertListe}`;
}

// --- Kopf und Ganzes

/** Der Schalter Tag · Woche · Monat. */
export function ansichtSchalter(ansicht) {
  return `<div class="ansicht-wahl" role="group" aria-label="Ansicht">
    ${ANSICHTEN.map(([k, t]) => `<button type="button" class="segment" data-kal-ansicht="${k}" aria-pressed="${k === ansicht}">${t}</button>`).join('')}
  </div>`;
}

const pfeil = (aktion, datum, zeichen, label) => `<button type="button" class="pfeil" data-aktion="${aktion}"${datum ? ` data-datum="${datum}"` : ' disabled'} aria-label="${label}">${zeichen}</button>`;

/** Wohin ‹ und › führen und wie die Ansicht heißt. */
function blaettern(ansicht, datum, heute, erster, letzter) {
  const imBereich = (d) => (d >= erster && d <= letzter ? d : '');
  if (ansicht === 'monat') {
    const monat = monatVon(datum);
    const hin = (n) => {
      const m = monatPlus(monat, n);
      if (m < monatVon(erster) || m > monatVon(letzter)) return '';
      return m === monatVon(heute) ? heute : `${m}-01`;
    };
    return {
      titel: esc(monatJahr(`${monat}-01`)), zurueck: hin(-1), vor: hin(1), heuteSchon: monat === monatVon(heute),
    };
  }
  if (ansicht === 'woche') {
    const mo = montag(datum);
    const zurueck = plusTage(mo, -7) >= montag(erster) ? (plusTage(datum, -7) < erster ? erster : plusTage(datum, -7)) : '';
    const vor = plusTage(mo, 7) <= letzter ? (plusTage(datum, 7) > letzter ? letzter : plusTage(datum, 7)) : '';
    return {
      titel: esc(wochenTitel(mo)), zurueck, vor, heuteSchon: mo === montag(heute),
    };
  }
  return {
    titel: `${esc(tagTitel(datum, heute))}${datum === heute ? ' <span class="kt-heute">heute</span>' : ''}`,
    zurueck: imBereich(plusTage(datum, -1)),
    vor: imBereich(plusTage(datum, 1)),
    heuteSchon: datum === heute,
  };
}

/** Wie viele Termine die Ansicht zeigt: am Tag, in der Woche, im Monat – auch für den Knopf unten im Filter-Blatt. */
export function programmZahl(p, st, heute, ui) {
  if (!p) return 0;
  const datum = gewaehlterTag(p, heute, ui);
  let tage = [datum];
  if (ui.ansicht === 'woche') tage = Array.from({ length: 7 }, (_, i) => plusTage(montag(datum), i));
  if (ui.ansicht === 'monat') tage = monatsRaster(monatVon(datum)).filter((d) => monatVon(d) === monatVon(datum));
  const f = filterFuer(st);
  return tage.filter((d) => d >= heute).reduce((n, d) => n + termineAm(p, d, f).liste.length, 0);
}

/**
 * Der Reiter Programm ohne „Was immer geht“.
 * @param {object} ui  { ansicht: 'tag'|'woche'|'monat', datum: der gewählte Tag,
 *                    planen, planFehler, meldung – fürs Einplanen von Laufendem (app.js, uiIdeen) }
 */
export function programmAnsicht(p, st, heute, ui) {
  const ansicht = ANSICHTEN.some(([k]) => k === ui.ansicht) ? ui.ansicht : 'tag';
  if (!p) {
    return `${ansichtSchalter(ansicht)}<div class="leer"><h2>Keine Daten</h2><p>Das Programm ließ sich nicht laden. Ohne Netz zeigt die App das zuletzt geladene – beim ersten Öffnen braucht sie einmal Verbindung.</p></div>`;
  }
  const { erster, letzter } = tagesBereich(p, heute);
  const datum = gewaehlterTag(p, heute, ui);
  const plaene = geplante(st);
  const f = filterFuer(st);
  const nav = blaettern(ansicht, datum, heute, erster, letzter);

  // Rechts in der Filterleiste: wie viele Termine – am Tag und in der Woche dazu, was läuft.
  const zahl = programmZahl(p, st, heute, { ansicht, datum });
  let laufend = [];
  if (ansicht === 'tag') laufend = laufendZwischen(p, datum, datum, f);
  if (ansicht === 'woche') laufend = laufendZwischen(p, montag(datum) < heute ? heute : montag(datum), plusTage(montag(datum), 6), f);
  const zaehler = `${anzahl(zahl, 'Termin', 'Termine')}${laufend.length ? ` · <button type="button" class="textknopf" data-aktion="zu-laufend">${laufend.length} laufend</button>` : ''}`;

  // „Heute“ steht fest oben neben Tag/Woche/Monat – immer da, ausgegraut, wenn man schon bei heute ist.
  // Neben ‹ › darf nichts auftauchen: Wer oft auf › tippt, träfe es sonst aus Versehen.
  const kopf = `<header class="prog-kopf">
    <div class="ansicht-zeile">
      ${ansichtSchalter(ansicht)}
      <button type="button" class="heute-knopf" data-aktion="kal-heute"${nav.heuteSchon ? ' disabled' : ''}>Heute</button>
    </div>
    <div class="blaettern">
      ${pfeil('kal-zurueck', nav.zurueck, '‹', 'Zurück')}
      <h2 class="kal-titel" data-datum="${datum}">${nav.titel}</h2>
      ${pfeil('kal-vor', nav.vor, '›', 'Weiter')}
    </div>
    ${filterLeiste(chipsProgramm(st), { rechts: `<span class="zaehler" id="zaehler">${zaehler}</span>` })}
  </header>
  ${heute > p.bis ? '<div class="banner">Das Programm ist abgelaufen. Das neue kommt am Ersten des Monats gegen 7 Uhr.</div>' : ''}`;

  // Einplanen von Laufendem: welches Formular offen ist, sein Fehler, die Meldung danach.
  const ctx = { planen: ui.planen || '', planFehler: ui.planFehler || '', meldung: ui.meldung || null };
  if (ansicht === 'woche') return `${kopf}${wocheAnsicht(p, st, heute, montag(datum), plaene, ctx)}`;
  if (ansicht === 'monat') return `${kopf}${monatAnsicht(p, st, heute, monatVon(datum), datum, plaene)}`;
  return `${kopf}${tagAnsicht(p, st, heute, datum, plaene, ctx)}`;
}
