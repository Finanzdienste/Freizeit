/*
 * Reiter „Karte“: was wo ist, auf OpenStreetMap.
 *
 * Ein Marker je Ort, darauf die Zahl der Termine dort im gewählten Zeitraum;
 * ein Tipp öffnet die Liste mit Bock-Knopf. Orange heißt: Du hast irgendwo
 * dort Bock, violett: die anderen, mit Rand: ein Treffer – ihr wollt
 * zusammen hin (siehe treffer() in gemeinsam.js). Mit „Ideen“ kommen
 * die Orte aus dem Ideen-Katalog dazu (eckige, gestrichelte Marker);
 * Eingeplantes steht wie ein Termin an seinem Tag.
 *
 * Leaflet (vendor/leaflet, im Offline-Vorrat) lädt erst, wenn der Reiter das
 * erste Mal aufgeht. Die Kacheln kommen von tile.openstreetmap.org und
 * brauchen Netz – alles andere hier nicht.
 *
 * Anders als die übrigen Reiter wird die Karte nicht bei jedem Tipp neu
 * gezeichnet: Ein Bock-Haken färbt nur die Marker um, damit die offene Liste
 * stehen bleibt.
 */
import { esc, anzahl } from './text.js';
import { plusTage, montag } from './zeit.js';
import { termineAm, laufendZwischen, filterAn, letzterTag } from './filter.js';
import { eintragTermin, eintragLaufend, merkeEintrag, bockKnopf, wannKurz } from './karte.js';
import { meinBock } from './speicher.js';
import { andere, treffer } from './gemeinsam.js';
import { geplante } from './ideen.js';

export const ZEITRAEUME = [
  ['heute', 'Heute'],
  ['morgen', 'Morgen'],
  ['woche', 'Diese Woche'],
  ['naechste', 'Nächste Woche'],
  ['alles', 'Alles'],
  ['bock', 'Mit Bock'],
];

let laden = null;

function skript(src) {
  return new Promise((ok, fehl) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = ok;
    s.onerror = () => fehl(new Error('Die Karte ließ sich nicht laden.'));
    document.head.append(s);
  });
}

/**
 * Leaflet und das Zusammenfassen naher Marker (markercluster) einmal
 * nachladen – als klassische Skripte, sie legen window.L an.
 */
export function leafletLaden() {
  if (window.L && window.L.markerClusterGroup) return Promise.resolve(window.L);
  if (!laden) {
    for (const href of ['vendor/leaflet/leaflet.css', 'vendor/leaflet/MarkerCluster.css']) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = href;
      document.head.append(css);
    }
    laden = skript('vendor/leaflet/leaflet.js')
      .then(() => skript('vendor/leaflet/leaflet.markercluster.js'))
      .then(() => window.L)
      .catch((e) => { laden = null; throw e; });
  }
  return laden;
}

function zeitraum(raum, heute, p, plaene) {
  const weit = letzterTag(p, plaene.map((e) => e.datum));
  if (raum === 'heute') return [heute, heute];
  if (raum === 'morgen') return [plusTage(heute, 1), plusTage(heute, 1)];
  if (raum === 'naechste') {
    const m = plusTage(montag(heute), 7);
    return [m, plusTage(m, 6)];
  }
  if (raum === 'alles' || raum === 'bock') return [heute, weit > heute ? weit : heute];
  return [heute, plusTage(montag(heute), 6)];
}

/**
 * Was im Zeitraum auf die Karte gehört – Termine je Tag, Laufendes und
 * Eingeplantes; mit dem Schalter „Ideen“ (und bei „Mit Bock“) auch die Orte
 * der Ideen, je Ort ein Eintrag.
 */
export function eintraegeFuerKarte(p, st, heute, raum, ideen = []) {
  const f = st.filter;
  const plaene = geplante(st);
  const [von, bis] = zeitraum(raum, heute, p, plaene);
  const liste = [];
  for (let d = von; d <= bis; d = plusTage(d, 1)) {
    const { tag, liste: termine } = termineAm(p, d, f);
    for (const e of termine) liste.push(eintragTermin(e, tag, p.tage));
  }
  for (const e of laufendZwischen(p, von, bis, f)) liste.push(eintragLaufend(e));
  for (const e of plaene) if (e.datum >= von && e.datum <= bis) liste.push(e);
  if (st.karteIdeen || raum === 'bock') {
    for (const x of ideen) for (const o of x.orte) if (o.geo) liste.push({ ...x, ort: o.name, geo: o.geo, link: o.link || x.link });
  }
  return raum === 'bock' ? liste.filter((x) => meinBock(x.schluessel) || andere(x.schluessel).length) : liste;
}

/** Nach Ort zusammenfassen: gleiche Koordinaten (auf etwa 10 m) sind ein Marker. */
function gruppieren(eintraege) {
  const gruppen = new Map();
  for (const x of eintraege) {
    if (!x.geo) continue;
    const k = `${x.geo[0].toFixed(4)},${x.geo[1].toFixed(4)}`;
    if (!gruppen.has(k)) gruppen.set(k, { geo: x.geo, eintraege: [] });
    gruppen.get(k).eintraege.push(x);
  }
  return [...gruppen.values()];
}

/** Farbe eines Markers (oder eines Haufens aus mehreren): wer dort Bock hat. */
function markerKlasse(gruppen, haufen = false) {
  let ich = false;
  let sie = false;
  let beide = false;
  let kuenstler = false;
  let nurIdeen = true;
  for (const g of gruppen) {
    for (const x of g.eintraege) {
      ich ||= meinBock(x.schluessel);
      sie ||= andere(x.schluessel).length > 0;
      beide ||= treffer(x.schluessel);
      kuenstler ||= x.kuenstler;
      nurIdeen &&= x.quelle === 'idee';
    }
  }
  return ['pin', haufen ? 'haufen' : '', beide ? 'treffer' : (ich ? 'ich' : (sie ? 'andere' : '')), kuenstler ? 'kuenstler' : '', nurIdeen ? 'idee' : '']
    .filter(Boolean).join(' ');
}

function sortierschluessel(x) {
  return `${x.datum || x.von || '9999'} ${String(x.zeit || '').match(/\d{1,2}:\d{2}/)?.[0].padStart(5, '0') || '99:99'}`;
}

function popup(gruppe) {
  const eintraege = [...gruppe.eintraege].sort((a, b) => sortierschluessel(a).localeCompare(sortierschluessel(b)));
  const orte = [...new Set(eintraege.map((x) => x.ort).filter(Boolean))];
  return `<div class="pop">
    <div class="pop-ort">${esc(orte[0] || 'Ort')}</div>
    <ul class="pop-liste">${eintraege.map((x) => {
    merkeEintrag(x);
    const idee = x.quelle === 'idee';
    const wann = idee ? `Idee · ${x.kategorie}` : [wannKurz(x), x.datum ? x.zeit : '', x.quelle === 'plan' ? 'eingeplant' : ''].filter(Boolean).join(' · ');
    return `<li>
        <div class="pop-wann">${esc(wann)}${x.kuenstler ? ' · <b>♫ Dein Künstler</b>' : ''}</div>
        <div class="pop-titel">${esc(x.titel)}</div>
        ${x.ort && x.ort !== orte[0] ? `<div class="pop-unter">${esc(x.ort)}</div>` : ''}
        <div class="pop-aktionen">${bockKnopf(x)}${x.link ? `<a href="${esc(x.link)}" target="_blank" rel="noopener">${idee ? 'Info' : 'Quelle'}</a>` : ''}${x.datum ? `<button type="button" class="textknopf" data-zu-tag="${x.datum}">im Programm</button>` : ''}${idee ? `<button type="button" class="textknopf" data-zu-idee="${esc(x.schluessel)}">bei den Ideen</button>` : ''}</div>
      </li>`;
  }).join('')}</ul>
  </div>`;
}

export function landkarteGeruest(st, raum) {
  return `<header class="woche-kopf">
    <div class="filterzeile karte-zeitraum">
      ${ZEITRAEUME.map(([k, text]) => `<button type="button" class="schalter" data-raum="${k}" aria-pressed="${raum === k}">${text}</button>`).join('')}
      <button type="button" class="schalter ideen-schalter" data-aktion="karte-ideen" aria-pressed="${Boolean(st.karteIdeen)}">💡 Ideen</button>
    </div>
    ${filterAn(st.filter) ? '<p class="fein">Filter aus dem Programm sind aktiv. <button type="button" class="textknopf" data-aktion="filter-weg">Alle zeigen</button></p>' : ''}
  </header>
  <div class="landkarte" id="landkarte" role="region" aria-label="Karte"></div>
  <p class="fein karte-fuss" id="karte-fuss"></p>`;
}

let karteL = null;
let ebene = null;
let letzterRaum = '';
const marker = [];

const pinIcon = (L, gruppe) => L.divIcon({
  className: 'pin-huelle',
  html: `<span class="${markerKlasse([gruppe])}">${gruppe.eintraege.length}</span>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -12],
});

/** Marker setzen (und die Karte anlegen, falls ihr Element neu ist). */
export async function landkarteZeichnen(p, st, heute, raum, ideen = []) {
  const el = document.getElementById('landkarte');
  if (!el || !p) return;
  let L;
  try {
    L = await leafletLaden();
  } catch (e) {
    el.innerHTML = `<div class="leer">${esc(e.message)} Ohne Netz geht das beim ersten Mal nicht.</div>`;
    return;
  }
  if (!document.body.contains(el)) return; // Reiter inzwischen gewechselt
  if (!karteL || karteL.getContainer() !== el) {
    if (karteL) karteL.remove();
    karteL = L.map(el, { zoomControl: false });
    L.control.zoom({ position: 'bottomleft' }).addTo(karteL);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-Mitwirkende',
    }).addTo(karteL);
    // Nahe Marker werden zu einem Haufen mit der Summe; ein Tipp zoomt hinein.
    ebene = L.markerClusterGroup({
      maxClusterRadius: 42,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (haufen) => {
        const kinder = haufen.getAllChildMarkers();
        const n = kinder.reduce((summe, m) => summe + m.options.gruppe.eintraege.length, 0);
        return L.divIcon({
          className: 'pin-huelle',
          html: `<span class="${markerKlasse(kinder.map((m) => m.options.gruppe), true)}">${n}</span>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });
      },
    }).addTo(karteL);
    karteL.setView([53.55, 10.0], 10);
    letzterRaum = '';
  }
  ebene.clearLayers();
  marker.length = 0;
  const eintraege = eintraegeFuerKarte(p, st, heute, raum, ideen);
  const gruppen = gruppieren(eintraege);
  const neue = gruppen.map((g) => {
    const m = L.marker(g.geo, { icon: pinIcon(L, g), title: g.eintraege[0].ort || '', gruppe: g })
      .bindPopup(() => popup(g), { maxWidth: 280, minWidth: 210, autoPanPadding: [12, 12], keepInView: true });
    marker.push({ m, g });
    return m;
  });
  ebene.addLayers(neue);
  if (raum !== letzterRaum) {
    // Das meiste liegt in Hamburg. Ein Rahmen um alles (bis Kiel und Soltau)
    // drückte die Stadt auf ein paar Haufen zusammen – also erst Hamburg,
    // das Umland ist einen Fingerzug entfernt.
    const hh = gruppen.filter((g) => g.eintraege.some((x) => x.region === 'HH'));
    const rahmen = hh.length ? hh : gruppen;
    if (rahmen.length) karteL.fitBounds(L.latLngBounds(rahmen.map((g) => g.geo)), { padding: [24, 24], maxZoom: 14 });
    letzterRaum = raum;
  }
  const ohne = eintraege.filter((x) => !x.geo).length;
  const ideenOrte = eintraege.filter((x) => x.quelle === 'idee').length;
  const fuss = document.getElementById('karte-fuss');
  if (fuss) {
    fuss.textContent = `${anzahl(eintraege.length - ohne, 'Eintrag', 'Einträge')} an ${anzahl(gruppen.length, 'Ort', 'Orten')}${ideenOrte ? `, davon ${ideenOrte} aus den Ideen` : ''}${ohne ? ` · ${ohne} ohne Ortsangabe nicht auf der Karte` : ''}`;
  }
  setTimeout(() => karteL && karteL.invalidateSize(), 0);
}

/** Nach einem Bock-Haken: nur die Farben der Marker und Haufen, die offene Liste bleibt. */
export function landkarteAuffrischen() {
  if (!karteL || !window.L) return;
  for (const { m, g } of marker) {
    const neu = markerKlasse([g]);
    const el = m.getElement() && m.getElement().querySelector('.pin');
    if (el) el.className = neu;
    else m.options.icon = pinIcon(window.L, g); // steckt im Haufen – gilt beim Auffächern
  }
  ebene.refreshClusters();
}

/** Die Zahl der Orte auf der Karte – für die Tests. */
export const markerZahl = () => marker.length;

/** Den Marker eines Orts zeigen und seine Liste öffnen (Haufen werden dafür aufgefächert). */
export function markerOeffnen(ortText) {
  const treffer = marker.find(({ g }) => g.eintraege.some((x) => (x.ort || '').includes(ortText)));
  if (!treffer || !ebene) return Promise.resolve(false);
  return new Promise((fertig) => {
    ebene.zoomToShowLayer(treffer.m, () => {
      treffer.m.openPopup();
      fertig(true);
    });
  });
}
