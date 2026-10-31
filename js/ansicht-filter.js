/*
 * Filter – in Programm, Karte und Ideen gleich gebaut:
 *
 *   [≡ Filter 2]  [Online & TV ✕] [kostenlos ✕]          135 Termine
 *
 * Der Knopf öffnet das Blatt (blatt.js) mit den Gruppen, jede Wahl gilt
 * sofort. Was gewählt ist, steht als Chip neben dem Knopf und lässt sich mit
 * ✕ einzeln entfernen; ab zwei Chips nimmt „Alle zeigen“ alles zurück.
 *
 * Programm (Liste, Monat, Woche, Tag) und Karte teilen sich die Filter
 * (st.filter) – was man in der einen Ansicht wählt, gilt in allen. Die Karte
 * hat dazu die Gruppe „Karte“, die Ideen haben eigene Filter (st.ideenFilter).
 */
import { esc, REGIONEN, ORTE } from './text.js';
import { SCHALTER, ART, kategorien, umkreisAn, filterFuer } from './filter.js';
import { UMKREISE, knopfName } from './standort.js';
import { WIRKUNG, WO } from './ideen.js';

/** Die Schalter unter „Was“ – „Mo–Fr ab 15:30“ steht unter „Wann“. */
const WAS = SCHALTER.filter(([k]) => k !== 'feierabend');
/** Rahmen im Ideen-Filter: Feldname, Beschriftung. */
export const EXTRA = [['drinnen', 'drinnen'], ['draussen', 'draußen'], ['kostenlos', 'kostenlos'], ['kurz', 'bis 2 Std.'], ['zuZweit', 'zu zweit']];
const KARTE = [['karte-bock', 'Nur mit Bock'], ['karte-ideen', 'Orte aus Ideen zeigen']];

/** Drei Regler, wie man sie kennt. */
const SYMBOL = '<svg class="symbol" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>';

// --- Chips: was gerade gewählt ist, je mit dem Schlüssel, unter dem ✕ es entfernt

/** Programm und Karte; auf der Karte kommen die Schalter der Gruppe „Karte“ dazu. */
export function chipsProgramm(st, { karte = false } = {}) {
  const f = filterFuer(st);
  const c = [];
  if (f.art) c.push(['art', ART.find(([k]) => k === f.art)[1]]);
  if (f.region) c.push(['region', REGIONEN[f.region] || f.region]);
  if (umkreisAn(f)) c.push(['umkreis', `bis ${f.umkreis} km`]);
  if (f.kategorie) c.push(['kategorie', f.kategorie]);
  for (const [k, t] of SCHALTER) if (f[k]) c.push([k, t]);
  if (karte) {
    if (st.karteBock) c.push(['karte-bock', 'nur mit Bock']);
    if (st.karteIdeen) c.push(['karte-ideen', 'mit Ideen-Orten']);
  }
  return c;
}

/** Ideen: Wirkung, wo, Rahmen – und ob auch zählt, was gerade keine Saison hat. */
export function chipsIdeen(f, saisonAlle) {
  const c = f.wirkung.filter((w) => WIRKUNG[w]).map((w) => [`w:${w}`, WIRKUNG[w]]);
  if (f.wo && WO[f.wo]) c.push([`wo:${f.wo}`, WO[f.wo]]);
  for (const [k, t] of EXTRA) if (f[k]) c.push([`x:${k}`, t]);
  if (saisonAlle) c.push(['saison', 'auch außerhalb der Saison']);
  return c;
}

/**
 * Die Leiste: oben der Knopf (davor, was der Reiter dort braucht – auf der
 * Karte der Zeitraum –, rechts die Zahl der Treffer oder ein Knopf), darunter
 * die Chips und ab zwei Chips „Alle zeigen“.
 * @param {string} weg  die Aktion für „Alle zeigen“
 */
export function filterLeiste(chips, { vorn = '', rechts = '', weg = 'filter-weg' } = {}) {
  const n = chips.length;
  return `<div class="filterleiste">
    <div class="filterleiste-oben">
      ${vorn}
      <button type="button" class="knopf filterknopf${n ? ' an' : ''}" data-aktion="filter-auf" aria-haspopup="dialog" aria-expanded="false">${SYMBOL}<span>Filter</span>${n ? `<span class="zahl-marke">${n}</span>` : ''}</button>
      ${rechts ? `<span class="leiste-rechts">${rechts}</span>` : ''}
    </div>
    ${n ? `<div class="filterchips">${chips.map(([k, t]) => `<button type="button" class="filterchip" data-aktion="chip-weg" data-chip="${esc(k)}" aria-label="${esc(t)} – Filter entfernen">${esc(t)}<span class="chip-x" aria-hidden="true">✕</span></button>`).join('')}
      ${n > 1 ? `<button type="button" class="textknopf alle-zeigen" data-aktion="${esc(weg)}">Alle zeigen</button>` : ''}</div>` : ''}
  </div>`;
}

// --- Bausteine des Blatts

const gruppe = (titel, inhalt, notiz = '') => `<section class="fgruppe"><h3>${esc(titel)}</h3>${inhalt}${notiz ? `<p class="fein">${notiz}</p>` : ''}</section>`;

/** Eins aus mehreren: [['', 'Alles'], …]; `attr(k)` gibt die data-Attribute des Knopfs. */
const segmente = (name, liste, wert, attr) => `<div class="segmente" role="group" aria-label="${esc(name)}">${liste
  .map(([k, t]) => `<button type="button" class="segment" ${attr(k)} data-fokus="${esc(`${name}:${k}`)}" aria-pressed="${wert === k}">${esc(t)}</button>`).join('')}</div>`;

/** Schalter zum An- und Ausmachen. */
const schalter = (name, liste, an, attr) => `<div class="filterzeile">${liste
  .map(([k, t]) => `<button type="button" class="schalter${k === 'hohwacht' ? ' hb' : ''}${k === 'flow' ? ' flow' : ''}" ${attr(k)} data-fokus="${esc(`${name}:${k}`)}" aria-pressed="${Boolean(an(k))}">${esc(t)}</button>`).join('')}</div>`;

const auswahl = (id, label, leer, liste, wert) => `<label class="feld-label">${esc(label)}<select id="${id}">
    <option value=""${wert ? '' : ' selected'}>${esc(leer)}</option>
    ${liste.map(([k, t]) => `<option value="${esc(k)}"${wert === k ? ' selected' : ''}>${esc(t)}</option>`).join('')}
  </select></label>`;

/** Unten im Blatt: Zurücksetzen (wenn es etwas gibt) und der Knopf mit der Zahl der Treffer. */
const fuss = (an, zahlText) => `<button type="button" class="textknopf zuruecksetzen" data-aktion="blatt-zuruecksetzen"${an ? '' : ' disabled'}>Zurücksetzen</button>
  <button type="button" class="knopf haupt" data-aktion="blatt-zu">${esc(zahlText)} zeigen</button>`;

/**
 * Das Blatt für Programm und Karte.
 * @param {object} o  karte: mit der Gruppe „Karte“ (ohne „Reihenfolge am Tag“);
 *                    zahlText: „135 Termine“ – was der Knopf unten zeigt
 */
export function programmBlatt(p, st, { karte = false, zahlText = '' } = {}) {
  const f = st.filter;
  const s = st.standort;
  const art = gruppe('Art', segmente('Art', ART, f.art, (k) => `data-aktion="art" data-wert="${k}"`),
    f.art === 'online' ? 'Live im Stream oder im Fernsehen – ohne Ort, darum ohne Entfernung.' : '');
  const umkreis = s
    ? `<div class="feld-label" id="umkreis-name">Umkreis um ${esc(s.art === 'geraet' ? 'deinen Standort' : knopfName(s.name, 24))}</div>
      ${segmente('Umkreis', UMKREISE.map((km) => [km, km ? `${km} km` : 'alle']), f.umkreis, (km) => `data-aktion="umkreis" data-km="${km}"`)}`
    : '<p class="fein">Den Umkreis gibt es mit Standort. <button type="button" class="textknopf" data-aktion="standort-festlegen">Standort festlegen</button></p>';
  const wo = gruppe('Wo', `${auswahl('f-region', 'Region', 'Alle Regionen', ORTE, f.region)}${umkreis}`);
  const was = gruppe('Was', `${auswahl('f-kategorie', 'Kategorie', 'Alle Kategorien', p ? kategorien(p).map((k) => [k, k]) : [], f.kategorie)}
    ${schalter('Was', WAS, (k) => f[k], (k) => `data-filter="${k}"`)}`);
  const wann = gruppe('Wann', schalter('Wann', [['feierabend', 'Mo–Fr ab 15:30']], (k) => f[k], (k) => `data-filter="${k}"`),
    'An Werktagen nur, was nach Feierabend noch geht.');
  const reihenfolge = s && !karte
    ? gruppe('Reihenfolge am Tag', segmente('Reihenfolge', [['zeit', 'Uhrzeit'], ['entfernung', 'Entfernung']], f.nachEntfernung ? 'entfernung' : 'zeit',
      (k) => `data-aktion="reihenfolge" data-wert="${k}"`))
    : '';
  const kartenGruppe = karte
    ? gruppe('Karte', schalter('Karte', KARTE, (k) => (k === 'karte-bock' ? st.karteBock : st.karteIdeen), (k) => `data-aktion="${k}"`))
    : '';
  return {
    titel: 'Filter',
    inhalt: art + wo + was + wann + reihenfolge + kartenGruppe,
    fuss: fuss(chipsProgramm(st, { karte }).length > 0, zahlText),
  };
}

/** Das Blatt für die Ideen. */
export function ideenBlatt(f, saisonAlle, zahlText) {
  const wirkung = gruppe('Wirkung', schalter('Wirkung', Object.entries(WIRKUNG), (k) => f.wirkung.includes(k), (k) => `data-ifilter="w:${k}"`),
    '⚡ Flow: fordert dich genau richtig, mit klarem Ziel – die Zeit verfliegt. Mehrere Wirkungen müssen alle passen.');
  const wo = gruppe('Wo', segmente('Wo', [['', 'Überall'], ...Object.entries(WO)], f.wo, (k) => `data-ifilter="wo:${k}"`));
  const extras = gruppe('Rahmen', schalter('Rahmen', EXTRA, (k) => f[k], (k) => `data-ifilter="x:${k}"`));
  const saison = gruppe('Saison', schalter('Saison', [['saison', 'auch außerhalb der Saison']], () => saisonAlle, () => 'data-aktion="saison-alle"'),
    'Sonst stehen nur Ideen, die jetzt Saison haben – kein Tretboot im November.');
  return {
    titel: 'Filter',
    inhalt: wirkung + wo + extras + saison,
    fuss: fuss(chipsIdeen(f, saisonAlle).length > 0, zahlText),
  };
}
