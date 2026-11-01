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
 *   Woche   je Tag eine Karte: Wetter, Zeitstreifen, wie viele Termine, die
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
 */
import { esc, anzahl } from './text.js';
import {
  monatsRaster, monatVon, monatPlus, monatJahr, datumMitTag, montag, plusTage, kalenderwoche, wochentag, wochentagKurz, tagMonat,
  beginn, ende, zeitAm, uhrzeit, jetztMinuten, werktag,
} from './zeit.js';
import {
  termineAm, laufendZwischen, letzterTag, filterFuer, spaetText, umkreisAn,
} from './filter.js';
import {
  karte, eintragTermin, eintragLaufend, aufklappbar,
} from './karte.js';
import { meinBock } from './speicher.js';
import { andere, treffer as istTreffer, rolle, gastgeberName } from './gemeinsam.js';
import { geplante } from './ideen.js';
import { belegtAm, bekannt } from './zeiten.js';
import { filterLeiste, chipsProgramm } from './ansicht-filter.js';

/** Die drei Ansichten, vom Tag zum Überblick. */
export const ANSICHTEN = [['tag', 'Tag'], ['woche', 'Woche'], ['monat', 'Monat']];
const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// Der Zeitstreifen zeigt 7 bis 24 Uhr.
const VON = 7 * 60;
const BIS = 24 * 60;
const TAG = 24 * 60;

/** Der erste und der letzte Tag, durch den man blättern kann: vom Ersten dieses Monats bis zum Ende des Monats mit dem letzten Termin oder Plan. */
export function tagesBereich(p, heute) {
  const bis = p ? letzterTag(p, geplante().map((e) => e.datum)) : heute;
  const letzterMonat = monatVon(bis > heute ? bis : heute);
  const d = new Date(`${letzterMonat}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return { erster: `${monatVon(heute)}-01`, letzter: d.toISOString().slice(0, 10) };
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

/** Termine (nach Filtern und 21:30-Regel) und Eingeplantes eines Tages. */
function tagDaten(p, d, f, plaene) {
  const {
    tag, liste, spaet, spaetOnline,
  } = termineAm(p, d, f);
  const termine = liste.map((e) => eintragTermin(e, tag, p.tage));
  const geplant = plaene.filter((e) => e.datum === d);
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

/** „Diese Woche“: Highlights und Infos des Montagslaufs. */
function dieseWocheKasten(p) {
  if (!p.infos.length && !p.highlights.length) return '';
  const vorschau = [...p.highlights.map((h) => h.titel), ...p.infos.map((i) => i.titel || i.text)].filter(Boolean).join(' · ');
  const inhalt = `${p.highlights.length ? `<h3 class="ka-unter">${anzahl(p.highlights.length, 'Highlight', 'Highlights')}</h3>
      <ol class="highlights">${p.highlights.map((h) => `<li><strong>${esc(h.titel)}</strong><span>${esc(h.text)}</span></li>`).join('')}</ol>` : ''}
    ${p.infos.length ? `<h3 class="ka-unter">Gut zu wissen</h3>
      <ul class="infos">${p.infos.map((i) => `<li>${i.titel ? `<b>${esc(i.titel)}:</b> ` : ''}${esc(i.text)}</li>`).join('')}</ul>` : ''}`;
  return kasten('diese-woche', 'Diese Woche', inhalt, { vorschau, id: 'diese-woche' });
}

/** Was über Tage oder Wochen läuft – als Kasten mit Karten. */
function laufendKasten(liste, titel) {
  if (!liste.length) return '';
  const inhalt = `<p class="fein">Über Tage oder Wochen, mit ihren Zeiten – der Filter „Mo–Fr ab 15:30“ wirkt hier nicht.</p>
    ${liste.map((e) => karte(eintragLaufend(e))).join('')}`;
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

const teilKopf = (titel, n) => `<h3 class="tagesteil"><span>${esc(titel)}</span><span class="tt-zahl">${n}</span></h3>`;

/** Die sieben Tage der Woche wie eine Abfahrtstafel – klebt oben, ein Tipp wählt den Tag. */
function tagesleiste(p, st, heute, datum, plaene) {
  const f = filterFuer(st);
  const { erster, letzter } = tagesBereich(p, heute);
  const mo = montag(datum);
  return `<nav class="tagleiste" aria-label="Tage der Woche">${Array.from({ length: 7 }, (_, i) => plusTage(mo, i)).map((d) => {
    const td = tagDaten(p, d, f, plaene);
    const zahl = td.alle.length;
    const { wer } = punkte(td.alle);
    const klassen = ['tagzelle', d === heute ? 'ist-heute' : '', d === datum ? 'gewaehlt' : '', d < heute ? 'vorbei' : ''].filter(Boolean).join(' ');
    return `<button type="button" class="${klassen}" data-tag="${d}" aria-pressed="${d === datum}" aria-label="${esc(datumMitTag(d))}: ${anzahl(zahl, 'Termin', 'Termine')}${wer.length ? ', mit Bock' : ''}"${d < erster || d > letzter ? ' disabled' : ''}>
      <span class="tz-wt">${wochentagKurz(d)}</span><span class="tz-nr">${Number(d.slice(8))}</span>
      <span class="tz-unter"><span class="tz-zahl">${zahl || '–'}</span>${wer.slice(0, 3).map((x) => `<i class="pkt ${x}"></i>`).join('')}</span>
    </button>`;
  }).join('')}</nav>`;
}

function tagAnsicht(p, st, heute, d, plaene) {
  const f = filterFuer(st);
  const td = tagDaten(p, d, f, plaene);
  const { tag } = td;
  const wichtig = td.alle.filter(zaehlt);
  const fakten = [
    tag.wetter ? `<dt>Wetter</dt><dd>${esc(tag.wetter.replace(/^Hamburg\s*:?\s*/i, ''))}</dd>` : '',
    tag.wetterOstsee ? `<dt>Ostsee</dt><dd>${esc(tag.wetterOstsee.replace(/^Ostsee\/Kiel\s*:?\s*/i, ''))}</dd>` : '',
    tag.feiertag ? '<dt>Feiertag</dt><dd>gesetzlicher Feiertag</dd>' : '',
    tag.tipp ? `<dt>Tipp</dt><dd>${esc(tag.tipp)}</dd>` : '',
    f.feierabend && werktag(tag) ? '<dt>Filter</dt><dd>Mo–Fr ab 15:30: nur, was nach Feierabend noch geht.</dd>' : '',
    td.spaet ? `<dt>21:30</dt><dd>${spaetText(td.spaet, td.spaetOnline)}.</dd>` : '',
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
  const geplant = td.geplant.length ? `${teilKopf('Eingeplant', td.geplant.length)}${td.geplant.map(k).join('')}` : '';
  const termine = nachEntfernung
    ? td.termine.map(k).join('')
    : TEILE.map(([key, titel]) => {
      const liste = td.termine.filter((e) => tagesteil(e) === key);
      return liste.length ? `${teilKopf(titel, liste.length)}${liste.map(k).join('')}` : '';
    }).join('');
  const leer = td.termine.length || (td.geplant.length && d > p.bis) ? '' : `<div class="leer-klein">${leerText(p, d, st, f)}</div>`;

  // Die Hülle begrenzt die klebende Tagesleiste: Bei „Was immer geht“ scrollt sie mit weg.
  return `<div class="tag-huelle">
    ${tagesleiste(p, st, heute, d, plaene)}
    <section class="tag${d < heute ? ' vorbei' : ''}" id="tag-${d}" aria-label="${esc(datumMitTag(d))}">
      ${fakten ? `<dl class="tag-info">${fakten}</dl>` : ''}
      ${zeit}
      ${geplant}${termine}${leer}
    </section>
    ${laufendKasten(laufendZwischen(p, d, d, f), d === heute ? 'Läuft heute' : 'Läuft an dem Tag')}
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
  const klassen = ['wtag', d === heute ? 'heute' : '', d < heute ? 'vorbei' : '', ohneProgramm ? 'ohne' : '', vorschau ? 'vorschau' : ''].filter(Boolean).join(' ');
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

function wocheAnsicht(p, st, heute, mo, plaene) {
  const f = filterFuer(st);
  const tage = Array.from({ length: 7 }, (_, i) => plusTage(mo, i));
  const dieseWoche = mo === montag(heute);
  const zeiten = tage.some((d) => bekannt(d));
  const n = esc(gastgeberName() || 'der Gastgeber');
  const legende = zeiten || tage.some((d) => tagDaten(p, d, f, plaene).alle.some(zaehlt))
    ? `<p class="legende"><span><i class="lg-frei"></i> frei</span>${zeiten ? `<span><i class="lg-belegt"></i> ${rolle() === 'gastgeber' ? 'belegt (Kalender)' : `${n} ist belegt`}</span>` : ''}<span><i class="lg-haken ich"></i> dein Haken</span><span><i class="lg-haken p0"></i> die anderen</span><span><i class="lg-haken plan"></i> eingeplant</span></p>`
    : '';
  return `${dieseWoche ? dieseWocheKasten(p) : ''}
  ${mo > p.bis ? '<div class="banner">Für diese Woche gibt es noch kein Programm – hier stehen nur Konzerte deiner Künstler und was ihr eingeplant habt. Es kommt mit dem Montagslauf, sobald die Woche in den nächsten fünf Wochen liegt.</div>' : ''}
  <div class="wochen-liste">${tage.map((d) => tagKarte(p, d, f, plaene, heute)).join('')}</div>
  ${legende}
  ${laufendKasten(laufendZwischen(p, mo, plusTage(mo, 6), f), 'Läuft diese Woche')}
  ${dieseWoche ? hinweiseKasten(p) : ''}`;
}

// --- Monat

function monatAnsicht(p, st, heute, monat, datum, plaene) {
  const f = filterFuer(st);
  const felder = monatsRaster(monat).map((d) => {
    const td = tagDaten(p, d, f, plaene);
    const { wer, treffer } = punkte(td.alle);
    const n = td.termine.length;
    const kuenstler = td.termine.some((e) => e.kuenstler);
    const klassen = ['feld', monatVon(d) === monat ? '' : 'fremd', d < heute ? 'vorbei' : '', d === heute ? 'heute' : '', d > p.bis ? 'ohne' : '',
      treffer ? 'treffer' : '', td.tag.feiertag ? 'feiertag' : '', d === datum ? 'gewaehlt' : ''].filter(Boolean).join(' ');
    return `<button type="button" class="${klassen}" data-waehle="${d}" aria-pressed="${d === datum}" aria-label="${esc(datumMitTag(d))}: ${anzahl(n, 'Termin', 'Termine')}${kuenstler ? ', Konzert deiner Künstler' : ''}${wer.length ? ', mit Bock' : ''}${td.tag.feiertag ? ', Feiertag' : ''}">
      <span class="nr">${Number(d.slice(8))}</span>${n ? `<span class="zahl">${n}</span>` : ''}
      <span class="f-unten">${kuenstler ? '<span class="f-kuenstler">♫</span>' : ''}${wer.length ? `<span class="punkte">${wer.map((w) => `<i class="pkt ${w}"></i>`).join('')}</span>` : ''}</span>
    </button>`;
  }).join('');

  const konzerte = p.termine.filter((e) => e.kuenstler)
    .flatMap((e) => e.daten.filter((d) => monatVon(d) === monat).map((d) => ({ e, d })))
    .sort((a, b) => a.d.localeCompare(b.d) || String(a.e.zeit).localeCompare(String(b.e.zeit)));
  const konzertListe = konzerte.length ? `<section class="abschnitt-klein" id="monat-konzerte">
      <h3 class="tagesteil"><span>Deine Konzerte</span><span class="tt-zahl">${konzerte.length}</span></h3>
      ${konzerte.map(({ e, d }) => `<button type="button" class="konzert-zeile${d < heute ? ' vorbei' : ''}" data-tag="${d}">
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
  return tage.reduce((n, d) => n + termineAm(p, d, f).liste.length, 0);
}

/**
 * Der Reiter Programm ohne „Was immer geht“.
 * @param {object} ui  { ansicht: 'tag'|'woche'|'monat', datum: der gewählte Tag }
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
  if (ansicht === 'woche') laufend = laufendZwischen(p, montag(datum), plusTage(montag(datum), 6), f);
  const zaehler = `${anzahl(zahl, 'Termin', 'Termine')}${laufend.length ? ` · <button type="button" class="textknopf" data-aktion="zu-laufend">${laufend.length} laufend</button>` : ''}`;

  const kopf = `<header class="prog-kopf">
    ${ansichtSchalter(ansicht)}
    <div class="blaettern">
      ${pfeil('kal-zurueck', nav.zurueck, '‹', 'Zurück')}
      <h2 class="kal-titel" data-datum="${datum}">${nav.titel}</h2>
      ${pfeil('kal-vor', nav.vor, '›', 'Weiter')}
      ${nav.heuteSchon ? '' : '<button type="button" class="knopf klein heute-knopf" data-aktion="kal-heute">Heute</button>'}
    </div>
    ${filterLeiste(chipsProgramm(st), { rechts: `<span class="zaehler" id="zaehler">${zaehler}</span>` })}
  </header>
  ${heute > p.bis ? '<div class="banner">Das Programm ist abgelaufen. Das neue kommt montags gegen 7 Uhr.</div>' : ''}`;

  if (ansicht === 'woche') return `${kopf}${wocheAnsicht(p, st, heute, montag(datum), plaene)}`;
  if (ansicht === 'monat') return `${kopf}${monatAnsicht(p, st, heute, monatVon(datum), datum, plaene)}`;
  return `${kopf}${tagAnsicht(p, st, heute, datum, plaene)}`;
}
