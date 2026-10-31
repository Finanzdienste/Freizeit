/*
 * Freizeit – was in Hamburg und Umgebung los ist, mit den Konzerten deiner
 * Künstler, als Liste, Monat, Woche und Tag, auf der Karte, Ideen für alles
 * ohne Termin, und gemeinsam mit deinen Leuten.
 *
 * Einstieg: Daten laden, Reiter zeichnen, Knöpfe verdrahten, den gemeinsamen
 * Plan abgleichen. Das Programm schreibt ein geplanter Lauf montags früh nach
 * daten/, den Ideen-Katalog pflegt man von Hand; die App selbst ändert
 * beides nie.
 *
 * Wo was ist: unten die Reiter Programm, Karte, Ideen, Wir und Einstellungen;
 * in Programm, Karte und Ideen oben der Knopf „Filter“ mit dem Blatt von unten
 * (blatt.js, ansicht-filter.js); alles Einmalige – welche Reiter unten
 * stehen, Standort, Mitteilungen, der Plan, die App – im Reiter Einstellungen
 * (#einstellungen). Ein ausgeblendeter Reiter bleibt über Links erreichbar;
 * unten ist dann keiner markiert.
 */
import {
  laden, speichern, aktuell, bockUmschalten, bockWeg, meinBock, gemachtSpeichern, gemachtWeg, LEERER_FILTER, LEERER_IDEENFILTER, ARTEN,
  INHALTS_REITER,
} from './speicher.js';
import { ladeAlles } from './daten.js';
import {
  heute, montag, plusTage, wochentagKurz, tagMonat,
} from './zeit.js';
import { anzahl } from './text.js';
import { SCHALTER } from './filter.js';
import {
  programmAnsicht, wochenBereich, listenZahl, tagesleisteNeu,
} from './ansicht-programm.js';
import {
  kalenderAnsicht, ansichtSchalter, ANSICHTEN, kalenderZahl,
} from './ansicht-kalender.js';
import {
  landkarteGeruest, landkarteZeichnen, landkarteAuffrischen, karteKopf, kartenZahl, ZEITRAEUME,
} from './ansicht-landkarte.js';
import { ideenAnsicht, ideeAnker, ideenZahl } from './ansicht-ideen.js';
import { wirAnsicht, vorbei } from './ansicht-wir.js';
import { einstellungenAnsicht } from './ansicht-einstellungen.js';
import { programmBlatt, ideenBlatt } from './ansicht-filter.js';
import {
  blattOeffnen, blattSchliessen, blattAuffrischen, blattArt,
} from './blatt.js';
import {
  alleIdeen, planEintrag, neueIdee, BEWERTUNG,
} from './ideen.js';
import {
  eintragZu, vergessen as karteVergessen, bockKnopf, aufklappen, abschnittUmschalten,
} from './karte.js';
import { pushEinschalten, pushAusschalten } from './push.js';
import {
  geraetStandort, adresseSuchen, standortUi, UMKREISE,
} from './standort.js';
import {
  planStarten, beitreten, codeLesen, zugangLesen, zugangUebernehmen, einladungAnsehen, abgleichen, umbenennen, verlassen,
  vergessen as planVergessen, wiederBeitreten, entfernen, neuesterAndererHaken, rolle,
} from './gemeinsam.js';

// Die Reiter unten: vier mit Inhalt (abschaltbar) und Einstellungen, immer da.
const SEITEN = [...INHALTS_REITER, 'einstellungen'];
// Adressen aus früheren Fassungen (Lesezeichen) landen sinnvoll.
const ALTE_REITER = { woche: 'programm', konzerte: 'programm', kalender: 'programm', merkliste: 'wir' };
const $ = (s) => document.querySelector(s);

let daten = {
  programm: null, ideen: null, ideenStand: '', fehler: [],
};
let ideenListe = []; // Katalog und Ausflugsziele aus dem Programm (ideen.js, alleIdeen)
let geladen = false;
let reiter = 'programm';
// Programm: die Ansicht (liste, monat, woche, tag) und der gewählte Tag – die
// Liste zeigt seine Woche, der Monat seinen Monat.
const prog = { ansicht: 'liste', datum: '' };
let raum = 'woche'; // Zeitraum auf der Karte
// Wir und Einstellungen: offene Felder, die Person, die gleich herausgenommen
// wird, wer zu einem Einladungslink einlädt, aufgeklappte Abschnitte
// (data-offen), ein Fehler und wo er hingehört (wir, plan, push).
const ui = {
  einladen: false, umbenennen: false, verlassen: false, geraet: false, hilfe: false, entfernen: '', fehler: '', fehlerOrt: '', laeuft: false,
  einladungVon: null, offen: new Set(),
  zeitenWoche: '', // Montag der Woche in „Wann hat … Zeit?“
};
// Reiter Ideen: offene Formulare („bereich|schlüssel“), aufgeklappte Kategorien, letzte Meldung
const uiIdeen = {
  neu: false, planen: '', bewerten: '', offen: new Set(), saisonAlle: false, meldung: null, fehler: '',
};
let installEreignis = null;

/**
 * Einladung oder Zugang aus dem Link übernehmen, Reiter aus der Adresse
 * lesen. Code und Schlüssel verschwinden danach aus der Adresszeile.
 */
function adresseLesen() {
  const h = decodeURIComponent(location.hash.slice(1));
  const einladung = h.match(/^einladung=([a-z0-9-]+)$/i);
  const zugang = /^geraet=/i.test(h) ? zugangLesen(h) : null;
  if (einladung || zugang) {
    const st = aktuell();
    const code = einladung ? codeLesen(einladung[1]) : '';
    if (code && !(st.gemeinsam && st.gemeinsam.code === code && !st.gemeinsam.raus)) st.einladung = code;
    if (zugang) st.zugang = `${zugang.code}.${zugang.person}${zugang.schluessel ? `.${zugang.schluessel}` : ''}`;
    speichern();
    history.replaceState(null, '', `${location.pathname}${location.search}#wir`);
    return 'wir';
  }
  if (SEITEN.includes(h)) return h;
  return ALTE_REITER[h] || null;
}

/** Wer zum Einladungslink einlädt – für die Begrüßung. Ohne Netz eben ohne Namen. */
async function einladungPruefen() {
  const code = aktuell().einladung;
  if (!code || (ui.einladungVon && ui.einladungVon.code === code)) return;
  try {
    ui.einladungVon = { code, ...(await einladungAnsehen(code)) };
    if (reiter === 'wir' && geladen && !wirEingabeOffen()) zeichnen({ behalteScroll: true });
  } catch { /* dann ohne */ }
}

/** Die Reiter, die unten stehen, in der Reihenfolge der Leiste – Einstellungen zuletzt und immer. */
const sichtbareReiter = () => [...INHALTS_REITER.filter((r) => !aktuell().reiterAus.includes(r)), 'einstellungen'];

/** Womit die App aufgeht, wenn die Adresse nichts sagt: der erste Reiter, der an ist. */
const startReiter = () => sichtbareReiter()[0];

/** Der Reiter steht in der Adresse, damit Neuladen ihn behält – ohne neuen Eintrag im Verlauf. Der Start-Reiter braucht keinen. */
function adresseSetzen(r) {
  history.replaceState(null, '', r === startReiter() ? location.pathname + location.search : `#${r}`);
}

function leisteAktualisieren() {
  const st = aktuell();
  const sichtbar = sichtbareReiter();
  const leiste = $('.reiterleiste');
  leiste.querySelectorAll('[data-reiter]').forEach((b) => {
    b.hidden = !sichtbar.includes(b.dataset.reiter);
    // Über einen Link in einem ausgeblendeten Reiter: Dann ist unten keiner markiert.
    if (b.dataset.reiter === reiter && !b.hidden) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  // Für die Schriftgröße: fünf Reiter brauchen etwas kleinere Beschriftungen.
  leiste.dataset.anzahl = String(sichtbar.length);
  // Der Punkt gehört zu „Wir“ – ist der Reiter aus, gibt es ihn nicht, auch nicht anderswo.
  const neu = neuesterAndererHaken();
  $('#wir-neu').hidden = !(sichtbar.includes('wir') && st.gemeinsam && neu && neu > (st.gesehen.andere || '') && reiter !== 'wir');
}

/**
 * Woran sich ein Knopf nach dem Neuzeichnen wiederfinden lässt: id oder
 * seine data-Attribute. So bleibt der Fokus, wo er war – wichtig für alle,
 * die mit der Tastatur unterwegs sind.
 */
function fokusSchluessel(el) {
  const ansicht = $('#ansicht');
  if (!el || el === ansicht || !ansicht.contains(el)) return '';
  if (el.id) return `#${CSS.escape(el.id)}`;
  const teile = ['aktion', 'filter', 'ifilter', 'kalAnsicht', 'reiter', 'chip', 'person', 'idee', 'bereich', 'plan', 'wert', 'km', 'bock', 'mitwem', 'auf', 'tag']
    .filter((a) => el.dataset && el.dataset[a] !== undefined)
    .map((a) => `[data-${a.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}="${CSS.escape(el.dataset[a])}"]`);
  return teile.join('');
}

function zeichnen({ nachOben = false, behalteScroll = false } = {}) {
  const st = aktuell();
  const h = heute();
  const y = window.scrollY;
  const fokus = fokusSchluessel(document.activeElement);
  if (reiter !== 'karte') karteVergessen();
  let html;
  if (reiter === 'einstellungen') {
    html = einstellungenAnsicht(st, ui, {
      p: daten.programm, ideenStand: daten.ideenStand, datenFehler: daten.fehler, installierbar: Boolean(installEreignis),
    });
  } else if (!geladen) html = '<div class="leer"><p>Lädt …</p></div>';
  else if (reiter === 'karte') html = landkarteGeruest(st, raum);
  else if (reiter === 'ideen') html = ideenAnsicht(ideenListe, Boolean(daten.ideen), st, h, uiIdeen);
  else if (reiter === 'wir') html = wirAnsicht(daten.programm, ideenListe, st, h, ui);
  else {
    const datum = prog.datum || h;
    html = (daten.programm ? ansichtSchalter(prog.ansicht) : '')
      + (prog.ansicht === 'liste' ? programmAnsicht(daten.programm, st, h, montag(datum)) : kalenderAnsicht(daten.programm, st, h, prog));
  }
  $('#ansicht').innerHTML = html;
  if (geladen && reiter === 'karte') landkarteZeichnen(daten.programm, st, h, raum, ideenListe);
  if (reiter === 'wir' && st.gemeinsam) {
    const neu = neuesterAndererHaken();
    if (neu && neu !== st.gesehen.andere) {
      st.gesehen.andere = neu;
      speichern();
    }
  }
  leisteAktualisieren();
  blattAuffrischen();
  if (fokus && !blattArt() && !nachOben) {
    const wieder = document.querySelector(`#ansicht ${fokus}`);
    if (wieder) wieder.focus({ preventScroll: true });
  }
  if (nachOben) window.scrollTo(0, 0);
  else if (behalteScroll) window.scrollTo(0, y);
}

function wechseln(neu) {
  if (!SEITEN.includes(neu)) return;
  blattSchliessen();
  // Was in den Einstellungen offen war, geht beim Verlassen zu.
  if (reiter === 'einstellungen' && neu !== 'einstellungen') Object.assign(ui, { umbenennen: false, verlassen: false, geraet: false, hilfe: false });
  reiter = neu;
  ui.fehler = '';
  ui.fehlerOrt = '';
  ui.entfernen = '';
  Object.assign(uiIdeen, {
    neu: false, planen: '', bewerten: '', meldung: null, fehler: '',
  });
  adresseSetzen(neu);
  zeichnen({ nachOben: true });
  $('#ansicht').focus({ preventScroll: true });
}

// --- Gemeinsamer Plan: abgleichen, wenn sich etwas tut, und jede Minute

let syncUhr = null;
const fingerabdruck = () => {
  const st = aktuell();
  return JSON.stringify([st.gemeinsam && st.gemeinsam.stand, Object.keys(st.bock).sort(), st.warteschlange.length]);
};

/** Steht gerade ein Formular im Reiter Ideen offen? Dann nicht dazwischen neu zeichnen. */
const ideenFormularOffen = () => reiter === 'ideen' && Boolean(uiIdeen.neu || uiIdeen.planen || uiIdeen.bewerten);
/** Tippt man gerade in ein Feld? Dann auch nicht – die Eingabe ginge verloren. */
const wirEingabeOffen = () => Boolean(document.activeElement && document.activeElement.matches('#ansicht input, #ansicht textarea, #ansicht select'));

/** Abgleichen. In den Einstellungen zeichnet nur ein Tipp auf „Jetzt abgleichen“ neu – oder wenn sich etwas getan hat. */
async function abgleichJetzt({ manuell = false } = {}) {
  einladungPruefen();
  if (!aktuell().gemeinsam) return;
  const vorher = fingerabdruck();
  await abgleichen();
  if (!geladen && reiter !== 'einstellungen') return;
  if (ideenFormularOffen() || wirEingabeOffen() || blattArt()) { leisteAktualisieren(); return; }
  if (reiter === 'karte') landkarteAuffrischen();
  else if (vorher !== fingerabdruck() || reiter === 'wir' || (reiter === 'einstellungen' && manuell)) zeichnen({ behalteScroll: true });
  leisteAktualisieren();
}

function abgleichSpaeter(ms = 600) {
  clearTimeout(syncUhr);
  syncUhr = setTimeout(abgleichJetzt, ms);
}

/**
 * Etwas mit dem Server tun und solange „Einen Moment …“ zeigen. Ein Fehler
 * steht dort, wo man getippt hat (`ort`: wir, plan, push); `danach` läuft
 * nur, wenn es geklappt hat – statt des Neuzeichnens.
 */
async function mitWarten(aufgabe, { ort = 'wir', danach = null } = {}) {
  ui.laeuft = true;
  ui.fehler = '';
  ui.fehlerOrt = ort;
  zeichnen({ behalteScroll: true });
  let ok = false;
  try {
    await aufgabe();
    ok = true;
  } catch (e) {
    ui.fehler = e && e.message && !/fetch|network|abort/i.test(e.message) ? e.message : 'Keine Verbindung zum Server. Später noch einmal versuchen.';
  } finally {
    ui.laeuft = false;
    if (ok && danach) danach();
    else zeichnen({ behalteScroll: true });
  }
}

const wert = (sel) => ($(sel) ? $(sel).value.trim() : '');

async function kopieren(text, knopf) {
  try {
    await navigator.clipboard.writeText(text);
    const vorher = knopf.textContent;
    knopf.textContent = 'Kopiert ✓';
    setTimeout(() => { knopf.textContent = vorher; }, 2000);
  } catch {
    // Ohne Zwischenablage: den Text im Feld zeigen und markieren, zum Kopieren von Hand.
    const feld = $(knopf.dataset.feld || '#einladungslink');
    if (feld) {
      const huelle = feld.closest('details');
      if (huelle) huelle.open = true;
      feld.select();
    }
  }
}

/** Den Bezugspunkt übernehmen (standort.js) – nur hier auf dem Gerät. */
function standortSetzen({ art, name, geo }) {
  const st = aktuell();
  st.standort = {
    art, name, geo, zeit: new Date().toISOString(),
  };
  Object.assign(standortUi, { fehler: '', treffer: [] });
  if (art === 'adresse') standortUi.eingabe = '';
  speichern();
}

/** Standort bestimmen oder Adresse suchen: solange es läuft, steht das da; ein Fehler als Satz. */
function standortHolen(aufgabe, was) {
  Object.assign(standortUi, { laeuft: was, fehler: '', treffer: [] });
  zeichnen({ behalteScroll: true });
  aufgabe()
    .catch((e) => { standortUi.fehler = e && e.message ? e.message : 'Das hat nicht geklappt.'; })
    .finally(() => {
      standortUi.laeuft = '';
      zeichnen({ behalteScroll: true });
    });
}

/** Nur eines der Felder unter „Wir“ bzw. in den Einstellungen ist offen. */
function wirFeld(name) {
  const offen = ui[name];
  Object.assign(ui, {
    einladen: false, umbenennen: false, verlassen: false, geraet: false, hilfe: false,
  });
  ui[name] = !offen;
  zeichnen({ behalteScroll: true });
}

// --- Filter: das Blatt von unten, die Chips, Zurücksetzen

/** Was im Blatt steht – je nach Reiter, mit der Zahl der Treffer für den Knopf unten. */
function blattBauen() {
  const st = aktuell();
  const h = heute();
  if (reiter === 'ideen') {
    return ideenBlatt(st.ideenFilter, uiIdeen.saisonAlle, anzahl(ideenZahl(ideenListe, st, h, uiIdeen), 'Idee', 'Ideen'));
  }
  if (reiter === 'karte') {
    return programmBlatt(daten.programm, st, { karte: true, zahlText: anzahl(kartenZahl(daten.programm, st, h, raum, ideenListe), 'Eintrag', 'Einträge') });
  }
  const n = prog.ansicht === 'liste' ? listenZahl(daten.programm, st, h, montag(prog.datum || h)) : kalenderZahl(daten.programm, st, h, prog);
  return programmBlatt(daten.programm, st, { zahlText: anzahl(n, 'Termin', 'Termine') });
}

/** Nach einer Wahl: speichern, die Seite dahinter neu, das Blatt mit. Die Karte bleibt stehen, nur Kopf und Marker kommen neu. */
function filterGeaendert() {
  speichern();
  if (reiter === 'karte') {
    const kopf = $('#karte-kopf');
    if (kopf) kopf.innerHTML = karteKopf(aktuell(), raum);
    landkarteZeichnen(daten.programm, aktuell(), heute(), raum, ideenListe);
    blattAuffrischen();
  } else {
    zeichnen({ behalteScroll: true });
  }
}

/** Alle Filter des Reiters zurück – die Reihenfolge am Tag bleibt, sie ist kein Filter. */
function filterZuruecksetzen() {
  const st = aktuell();
  if (reiter === 'ideen') {
    st.ideenFilter = LEERER_IDEENFILTER();
    uiIdeen.saisonAlle = false;
  } else {
    st.filter = { ...LEERER_FILTER(), nachEntfernung: st.filter.nachEntfernung };
    if (reiter === 'karte') Object.assign(st, { karteBock: false, karteIdeen: false });
  }
  filterGeaendert();
}

/** Einen Chip wegnehmen: sein Filter geht zurück. */
function chipWeg(k) {
  const st = aktuell();
  const f = st.filter;
  const fi = st.ideenFilter;
  const [art, rest] = k.includes(':') ? k.split(':') : ['', k];
  if (reiter === 'ideen') {
    if (art === 'w') fi.wirkung = fi.wirkung.filter((w) => w !== rest);
    else if (art === 'wo') fi.wo = '';
    else if (art === 'x' && Object.hasOwn(fi, rest)) fi[rest] = false;
    else if (k === 'saison') uiIdeen.saisonAlle = false;
  } else if (k === 'art' || k === 'region' || k === 'kategorie') f[k] = '';
  else if (k === 'umkreis') f.umkreis = 0;
  else if (k === 'karte-bock') st.karteBock = false;
  else if (k === 'karte-ideen') st.karteIdeen = false;
  else if (SCHALTER.some(([s]) => s === k)) f[k] = false;
  filterGeaendert();
  // Der Chip ist weg – der Fokus geht auf den Filter-Knopf.
  const knopf = $('#ansicht [data-aktion="filter-auf"]');
  if (knopf) knopf.focus({ preventScroll: true });
}

function aktion(name, z) {
  const st = aktuell();
  const h = heute();
  switch (name) {
    case 'reiter-an': {
      // Einstellungen → Reiter unten: einen der vier ein- oder ausblenden. Der letzte bleibt.
      const r = z.dataset.wert;
      if (!INHALTS_REITER.includes(r) || z.getAttribute('aria-disabled') === 'true') break;
      const aus = st.reiterAus.includes(r) ? st.reiterAus.filter((x) => x !== r) : [...st.reiterAus, r];
      if (aus.length >= INHALTS_REITER.length) break;
      st.reiterAus = INHALTS_REITER.filter((x) => aus.includes(x));
      speichern();
      zeichnen({ behalteScroll: true });
      break;
    }
    case 'filter-auf':
      blattOeffnen(reiter, blattBauen, '#ansicht [data-aktion="filter-auf"]');
      break;
    case 'blatt-zu':
      blattSchliessen();
      break;
    case 'blatt-zuruecksetzen':
    case 'filter-weg':
    case 'ideen-filter-weg':
      filterZuruecksetzen();
      break;
    case 'chip-weg':
      chipWeg(z.dataset.chip || '');
      break;
    case 'art':
      if (ARTEN.includes(z.dataset.wert)) st.filter.art = z.dataset.wert;
      filterGeaendert();
      break;
    case 'umkreis': {
      const km = Number(z.dataset.km);
      st.filter.umkreis = UMKREISE.includes(km) ? km : 0;
      filterGeaendert();
      break;
    }
    case 'reihenfolge':
      st.filter.nachEntfernung = z.dataset.wert === 'entfernung';
      filterGeaendert();
      break;
    case 'karte-bock':
      st.karteBock = !st.karteBock;
      filterGeaendert();
      break;
    case 'karte-ideen':
      st.karteIdeen = !st.karteIdeen;
      filterGeaendert();
      break;
    case 'saison-alle':
      uiIdeen.saisonAlle = !uiIdeen.saisonAlle;
      filterGeaendert();
      break;
    case 'standort-festlegen':
      // Aus dem Filter-Blatt: in die Einstellungen, gleich zu „Mein Standort“ (steht unter „Reiter unten“).
      wechseln('einstellungen');
      $('#e-standort')?.scrollIntoView({ block: 'start' });
      break;
    case 'vergangene':
      st.vergangeneTage = !st.vergangeneTage;
      speichern();
      zeichnen({ behalteScroll: true });
      break;
    case 'woche-zurueck':
    case 'woche-vor': {
      const { erste, letzte } = wochenBereich(daten.programm, h);
      const jetzt = montag(prog.datum || h);
      const neu = plusTage(jetzt < erste ? erste : (jetzt > letzte ? letzte : jetzt), name === 'woche-vor' ? 7 : -7);
      prog.datum = neu < erste ? erste : (neu > letzte ? letzte : neu);
      zeichnen({ nachOben: true });
      break;
    }
    case 'kal-zurueck':
    case 'kal-vor':
      if (z.dataset.datum) { prog.datum = z.dataset.datum; zeichnen(); }
      break;
    case 'kal-heute':
      prog.datum = h;
      zeichnen({ nachOben: true });
      break;
    case 'standort-geraet':
      standortHolen(() => geraetStandort().then((geo) => standortSetzen({ art: 'geraet', name: 'Dein Standort', geo })), 'geraet');
      break;
    case 'standort-suchen': {
      const text = wert('#standort-adresse');
      standortUi.eingabe = text;
      if (!text) {
        standortUi.fehler = 'Tipp eine Adresse oder einen Ort ein, etwa „Wandsbeker Marktstraße 1“ oder „Rahlstedt“.';
        standortUi.treffer = [];
        zeichnen({ behalteScroll: true });
        break;
      }
      standortHolen(() => adresseSuchen(text).then((treffer) => {
        if (!treffer.length) throw new Error(`Nichts gefunden für „${text}“. Mit Stadt probieren, etwa „${text}, Hamburg“.`);
        if (treffer.length === 1) standortSetzen({ art: 'adresse', ...treffer[0] });
        else standortUi.treffer = treffer;
      }), 'suche');
      break;
    }
    case 'standort-waehlen': {
      const t = standortUi.treffer[Number(z.dataset.nr)];
      if (t) standortSetzen({ art: 'adresse', ...t });
      zeichnen({ behalteScroll: true });
      break;
    }
    case 'standort-weg':
      st.standort = null;
      st.filter.umkreis = 0;
      st.filter.nachEntfernung = false;
      Object.assign(standortUi, { fehler: '', treffer: [], eingabe: '' });
      speichern();
      zeichnen({ behalteScroll: true });
      break;
    case 'vorbei-weg':
      for (const [k, v] of Object.entries(st.bock)) if (vorbei(v, h)) bockWeg(k);
      zeichnen({ behalteScroll: true });
      if (st.gemeinsam) abgleichSpaeter(100);
      break;
    case 'starten': {
      const name2 = wert('#wir-name');
      if (!name2) { ui.fehler = 'Bitte deinen Namen eintragen.'; zeichnen(); break; }
      mitWarten(async () => { await planStarten(name2); ui.einladen = true; });
      break;
    }
    case 'beitreten': {
      const name2 = wert('#wir-name');
      if (!name2) { ui.fehler = 'Bitte deinen Namen eintragen.'; zeichnen(); break; }
      mitWarten(() => beitreten(st.einladung, name2));
      break;
    }
    case 'beitreten-code': {
      const text = wert('#wir-code');
      const zugang = zugangLesen(text);
      const name2 = wert('#wir-name-code');
      if (zugang) { mitWarten(() => zugangUebernehmen(zugang)); break; }
      const m = text.match(/einladung=([a-z0-9-]+)/i);
      const code = codeLesen(m ? m[1] : text);
      if (!code) { ui.fehler = 'Der Code hat 12 Zeichen, etwa abcd-efgh-jkmn.'; zeichnen(); break; }
      if (!name2) { ui.fehler = 'Bitte deinen Namen eintragen.'; zeichnen(); break; }
      mitWarten(() => beitreten(code, name2));
      break;
    }
    case 'einfuegen':
      navigator.clipboard.readText().then((text) => {
        const feld = $('#wir-code');
        const m = String(text).match(/einladung=([a-z0-9-]+)/i);
        if (feld) feld.value = zugangLesen(text) ? String(text).trim() : (codeLesen(m ? m[1] : text) || String(text).trim());
      }).catch(() => { /* abgelehnt – dann von Hand */ });
      break;
    case 'code-kopieren':
      kopieren(z.dataset.code, z);
      break;
    case 'einladen':
    case 'umbenennen':
    case 'verlassen':
    case 'geraet':
    case 'hilfe':
      ui.fehler = '';
      wirFeld(name);
      break;
    case 'zeiten-zurueck':
    case 'zeiten-vor':
      ui.zeitenWoche = z.dataset.woche || '';
      zeichnen({ behalteScroll: true });
      break;
    case 'hilfe-weg':
      st.hilfeWeg = true;
      ui.hilfe = false;
      speichern();
      zeichnen({ behalteScroll: true });
      break;
    case 'abgleichen':
      abgleichJetzt({ manuell: true });
      break;
    case 'push-an':
      mitWarten(() => pushEinschalten(), { ort: 'push' });
      break;
    case 'push-aus':
      mitWarten(() => pushAusschalten(), { ort: 'push' });
      break;
    case 'name-speichern': {
      const name2 = wert('#wir-neuname');
      if (!name2) break;
      mitWarten(async () => { await umbenennen(name2); ui.umbenennen = false; }, { ort: 'plan' });
      break;
    }
    case 'verlassen-ja':
      // Danach geht es nach „Wir“: Dort steht jetzt, wie man einen neuen Plan startet. Ist
      // „Wir“ ausgeblendet, bleibt man hier – der Abschnitt zeigt dann den Weg dorthin.
      mitWarten(async () => { await verlassen(); ui.verlassen = false; }, {
        ort: 'plan', danach: () => (sichtbareReiter().includes('wir') ? wechseln('wir') : zeichnen({ behalteScroll: true })),
      });
      break;
    case 'zugang-uebernehmen':
      mitWarten(async () => {
        await zugangUebernehmen(st.zugang);
        Object.assign(ui, {
          einladen: false, umbenennen: false, verlassen: false, geraet: false,
        });
      });
      break;
    case 'zugang-weg':
      st.zugang = '';
      speichern();
      ui.fehler = '';
      zeichnen({ behalteScroll: true });
      break;
    case 'wieder-beitreten':
      mitWarten(() => wiederBeitreten());
      break;
    case 'vergessen':
      planVergessen();
      ui.fehler = '';
      zeichnen({ nachOben: true });
      break;
    case 'entfernen':
      ui.entfernen = ui.entfernen === z.dataset.person ? '' : z.dataset.person;
      zeichnen({ behalteScroll: true });
      break;
    case 'entfernen-ja':
      mitWarten(async () => { await entfernen(z.dataset.person); ui.entfernen = ''; });
      break;
    case 'installieren':
      if (installEreignis) {
        const e = installEreignis;
        installEreignis = null;
        e.prompt();
        zeichnen({ behalteScroll: true });
      }
      break;
    default:
      ideenAktion(name, z);
  }
}

/** Ein Feld im selben Formular wie der Knopf. */
const imFormular = (z, sel) => {
  const f = z.closest('.formular');
  return f ? f.querySelector(sel) : null;
};

/** Wer eingeladen ist, wählt im Formular, mit wem – sonst bleibt es leer. */
function mitWemIm(z, klasse) {
  if (rolle() !== 'mitglied') return '';
  const f = z.closest('.formular');
  const gewaehlt = f && f.querySelector(`${klasse}:checked`);
  return gewaehlt && gewaehlt.value === 'andere' ? 'andere' : 'gastgeber';
}

function melden(text, rueckgaengig = null) {
  uiIdeen.meldung = { text, rueckgaengig };
}

function ideenAktion(name, z) {
  const st = aktuell();
  const h = heute();
  const neuZeichnen = () => zeichnen({ behalteScroll: true });
  switch (name) {
    case 'idee-neu':
      uiIdeen.neu = !uiIdeen.neu;
      uiIdeen.fehler = '';
      neuZeichnen();
      break;
    case 'idee-speichern': {
      const titel = (imFormular(z, '.idee-titel')?.value || '').trim();
      if (!titel) { uiIdeen.fehler = 'Was ist die Idee? Ein paar Worte reichen.'; neuZeichnen(); break; }
      const x = neueIdee({
        titel: titel.slice(0, 80),
        text: (imFormular(z, '.idee-text')?.value || '').trim().slice(0, 300),
        wo: imFormular(z, '.idee-wo')?.value || 'hamburg',
        wirkung: [...(z.closest('.formular')?.querySelectorAll('.idee-wirkung:checked') || [])].map((c) => c.value),
        urheber: st.gemeinsam ? st.gemeinsam.ich.name : '',
      });
      bockUmschalten(x, mitWemIm(z, '.idee-mitwem'));
      uiIdeen.neu = false;
      uiIdeen.fehler = '';
      melden(`Gespeichert: ${x.titel}`, { bock: x.schluessel });
      neuZeichnen();
      if (st.gemeinsam) abgleichSpaeter();
      break;
    }
    case 'planen': {
      const hier = `${z.dataset.bereich}|${z.dataset.idee}`;
      uiIdeen.planen = uiIdeen.planen === hier ? '' : hier;
      uiIdeen.bewerten = '';
      neuZeichnen();
      break;
    }
    case 'plan-speichern': {
      const idee = eintragZu(z.dataset.idee);
      const datum = imFormular(z, '.plan-datum')?.value || '';
      if (!idee || !/^\d{4}-\d{2}-\d{2}$/.test(datum) || datum < h) break;
      const ort = imFormular(z, '.plan-ort')?.value;
      const plan = planEintrag(idee, datum, imFormular(z, '.plan-zeit')?.value || '', ort ? Number(ort) : null);
      if (!meinBock(plan.schluessel)) bockUmschalten(plan, mitWemIm(z, '.plan-mitwem'));
      uiIdeen.planen = '';
      melden(`Eingeplant: ${idee.titel}, ${wochentagKurz(datum)} ${tagMonat(datum)} – steht im Programm.`, { bock: plan.schluessel });
      neuZeichnen();
      if (st.gemeinsam) abgleichSpaeter();
      break;
    }
    case 'plan-weg':
      bockWeg(z.dataset.plan);
      neuZeichnen();
      if (st.gemeinsam) abgleichSpaeter();
      break;
    case 'gemacht': {
      const hier = `${z.dataset.bereich}|${z.dataset.plan || z.dataset.idee}`;
      uiIdeen.bewerten = uiIdeen.bewerten === hier ? '' : hier;
      uiIdeen.planen = '';
      neuZeichnen();
      break;
    }
    case 'gemacht-abbrechen':
      uiIdeen.bewerten = '';
      neuZeichnen();
      break;
    case 'gemacht-speichern': {
      const plan = z.dataset.plan || '';
      const gewaehlt = z.closest('.formular')?.querySelector('input[type="radio"]:checked');
      const bewertung = gewaehlt ? Number(gewaehlt.value) : 0;
      const flow = Boolean(imFormular(z, '.gemacht-flow')?.checked);
      const datum = plan ? plan.slice(2, 12) : (imFormular(z, '.gemacht-datum')?.value || h);
      const titel = (eintragZu(plan) || eintragZu(z.dataset.idee) || {}).titel || '';
      const stelle = gemachtSpeichern({
        schluessel: z.dataset.idee, titel, datum: datum > h ? h : datum, bewertung, flow, plan,
      });
      uiIdeen.bewerten = '';
      melden(`Gemacht: ${titel}${bewertung ? ` ${BEWERTUNG[bewertung][0]}` : ''}${flow ? ' ⚡' : ''}`, { verlauf: stelle });
      neuZeichnen();
      break;
    }
    case 'rueckgaengig': {
      const r = uiIdeen.meldung && uiIdeen.meldung.rueckgaengig;
      if (r && r.verlauf !== undefined) gemachtWeg(r.verlauf);
      if (r && r.bock) {
        bockWeg(r.bock);
        if (st.gemeinsam) abgleichSpaeter();
      }
      uiIdeen.meldung = null;
      neuZeichnen();
      break;
    }
    case 'meldung-weg':
      uiIdeen.meldung = null;
      neuZeichnen();
      break;
    default:
  }
}

/** Filter im Reiter Ideen: „w:flow“ (Wirkung), „wo:hamburg“, „x:kostenlos“. */
function ideenFilterUmschalten(wahl) {
  const f = aktuell().ideenFilter;
  const [art, k] = wahl.split(':');
  if (art === 'w') f.wirkung = f.wirkung.includes(k) ? f.wirkung.filter((w) => w !== k) : [...f.wirkung, k];
  else if (art === 'wo') f.wo = f.wo === k ? '' : k;
  else if (art === 'x' && Object.hasOwn(f, k)) f[k] = !f[k];
  filterGeaendert();
}

/** Aus der Karte zu einer Idee: Reiter Ideen, Kategorie auf, hinscrollen. */
function zuIdee(schluessel) {
  const x = ideenListe.find((i) => i.schluessel === schluessel);
  if (x) uiIdeen.offen.add(x.kat);
  wechseln('ideen');
  const ziel = document.getElementById(ideeAnker(schluessel));
  if (ziel) ziel.scrollIntoView({ block: 'start' });
}

/** Im Programm die Ansicht wechseln – und merken. */
function ansichtWechseln(ansicht) {
  prog.ansicht = ansicht;
  aktuell().programmAnsicht = ansicht;
  speichern();
}

/** Einen Tag in der Tagesansicht öffnen. */
function zuKalenderTag(tag) {
  prog.datum = tag;
  ansichtWechseln('tag');
  zeichnen({ nachOben: true });
}

/**
 * In die Liste springen – zu einer Woche (der Montag; ein gewählter Tag in
 * dieser Woche bleibt gewählt) oder zu einem Tag (aus der Karte).
 */
function zuListe(datum, anker = '') {
  reiter = 'programm';
  adresseSetzen('programm');
  if (!prog.datum || montag(prog.datum) !== montag(datum) || datum !== montag(datum)) prog.datum = datum;
  ansichtWechseln('liste');
  zeichnen({ nachOben: true });
  const ziel = anker ? document.getElementById(anker) : null;
  if (ziel) ziel.scrollIntoView();
}

document.addEventListener('click', (ev) => {
  const z = ev.target.closest('[data-reiter], [data-bock], [data-auf], [data-filter], [data-ifilter], [data-aktion], [data-zu-eintrag], [data-kal-ansicht], [data-tag], [data-zu-woche], [data-zu-tag], [data-zu-idee]');
  if (!z || z.disabled) return;
  const st = aktuell();
  if (z.dataset.auf !== undefined) {
    // Eine Karte auf- oder zuklappen – ohne Neuzeichnen, der Rest steht schon da.
    const auf = aufklappen(z.dataset.auf);
    const karte = z.closest('.karte');
    if (karte) karte.classList.toggle('auf', auf);
    z.setAttribute('aria-expanded', String(auf));
    return;
  }
  if (z.dataset.reiter) {
    if (z.dataset.kalWechsel) ansichtWechseln(z.dataset.kalWechsel);
    wechseln(z.dataset.reiter);
  } else if (z.dataset.bock) {
    const eintrag = eintragZu(z.dataset.bock);
    if (!eintrag) return;
    bockUmschalten(eintrag, z.dataset.mitwem || '');
    // Alle Knöpfe desselben Eintrags neu – auch in der offenen Liste der Karte.
    document.querySelectorAll('[data-bock-feld]').forEach((feld) => {
      if (feld.dataset.bockFeld === z.dataset.bock) feld.outerHTML = bockKnopf(eintrag);
    });
    if (reiter === 'karte') landkarteAuffrischen();
    else if ((reiter === 'programm' && prog.ansicht !== 'liste') || reiter === 'wir' || reiter === 'ideen') zeichnen({ behalteScroll: true });
    else if (reiter === 'programm') {
      // In der Liste nur die Tagesleiste – ihre Punkte zeigen, wer Bock hat.
      const leiste = $('#ansicht .tagleiste');
      if (leiste) leiste.outerHTML = tagesleisteNeu(daten.programm, st, heute(), montag(prog.datum || heute()));
    }
    leisteAktualisieren();
    if (st.gemeinsam) abgleichSpaeter();
  } else if (z.dataset.ifilter !== undefined) {
    ideenFilterUmschalten(z.dataset.ifilter);
  } else if (z.dataset.zuIdee) {
    zuIdee(z.dataset.zuIdee);
  } else if (z.dataset.filter) {
    st.filter[z.dataset.filter] = !st.filter[z.dataset.filter];
    filterGeaendert();
  } else if (z.dataset.zuEintrag) {
    // Ein Chip in der Wochenansicht: den Tag öffnen und zur Karte scrollen.
    zuKalenderTag(z.dataset.tag);
    const ziel = document.getElementById(z.dataset.zuEintrag);
    if (ziel) ziel.scrollIntoView({ block: 'center' });
  } else if (z.dataset.kalAnsicht) {
    ansichtWechseln(z.dataset.kalAnsicht);
    zeichnen({ nachOben: true });
  } else if (z.dataset.tag) {
    zuKalenderTag(z.dataset.tag);
  } else if (z.dataset.zuWoche) {
    zuListe(z.dataset.zuWoche);
  } else if (z.dataset.zuTag) {
    zuListe(z.dataset.zuTag, `tag-${z.dataset.zuTag}`);
  } else if (z.dataset.aktion) {
    aktion(z.dataset.aktion, z);
  }
});

document.addEventListener('change', (ev) => {
  const st = aktuell();
  if (ev.target.id === 'f-region') st.filter.region = ev.target.value;
  else if (ev.target.id === 'f-kategorie') st.filter.kategorie = ev.target.value;
  else if (ev.target.id === 'k-raum') {
    if (ZEITRAEUME.some(([k]) => k === ev.target.value)) raum = ev.target.value;
    landkarteZeichnen(daten.programm, st, heute(), raum, ideenListe);
    return;
  } else return;
  filterGeaendert();
});

// Enter oder Leertaste auf einer Kopfzeile klappt die Karte auf.
document.addEventListener('keydown', (ev) => {
  if ((ev.key !== 'Enter' && ev.key !== ' ') || !ev.target.matches || !ev.target.matches('[data-auf]')) return;
  ev.preventDefault();
  ev.target.click();
});

// Enter im Adressfeld des Standorts sucht.
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter' || !ev.target.matches || !ev.target.matches('#standort-adresse')) return;
  ev.preventDefault();
  const knopf = document.querySelector('[data-aktion="standort-suchen"]');
  if (knopf && !knopf.disabled) knopf.click();
});

// Enter in einem Eingabefeld drückt den Hauptknopf daneben.
document.addEventListener('keydown', (ev) => {
  const felder = '.einrichten input, .einladung input, .formular input, .einstellung-feld input';
  if (ev.key !== 'Enter' || !ev.target.matches || !ev.target.matches(felder)) return;
  const knopf = ev.target.closest('.einrichten, .einladung, .formular, .einstellung-feld').querySelector('.knopf.haupt');
  if (knopf) {
    ev.preventDefault();
    knopf.click();
  }
});

// Aufgeklappte Kategorien im Reiter Ideen und Abschnitte unter „Wir“ merken,
// damit Neuzeichnen sie offen lässt. Nur, was man selbst antippt – nicht, was
// ein Filter aufklappt.
document.addEventListener('click', (ev) => {
  const summary = ev.target.closest && ev.target.closest('details.kategorie > summary, details[data-offen] > summary');
  if (!summary) return;
  const d = summary.parentElement;
  if (d.classList.contains('aufklappbar')) { abschnittUmschalten(d.dataset.offen, !d.open); return; }
  const [menge, k] = d.dataset.kat ? [uiIdeen.offen, d.dataset.kat] : [ui.offen, d.dataset.offen];
  if (d.open) menge.delete(k); // klappt gleich zu
  else menge.add(k);
}, true);

// #programm, #karte, #ideen, #wir und #einstellungen öffnen die Seite direkt; #tag-… sind Anker.
window.addEventListener('hashchange', () => {
  const r = adresseLesen();
  if (r && r !== reiter) wechseln(r);
  else if (r === 'wir') zeichnen();
  einladungPruefen();
});

// Chrome & Co. bieten „Installieren“ an – der Knopf dafür steht in den Einstellungen.
window.addEventListener('beforeinstallprompt', (ev) => {
  ev.preventDefault();
  installEreignis = ev;
  if (reiter === 'einstellungen') zeichnen({ behalteScroll: true });
});
window.addEventListener('appinstalled', () => {
  installEreignis = null;
  if (reiter === 'einstellungen') zeichnen({ behalteScroll: true });
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') abgleichJetzt();
});
window.addEventListener('online', () => abgleichJetzt());
setInterval(() => {
  if (document.visibilityState === 'visible') abgleichJetzt();
}, 60000);

// Offline-Betrieb, nur über http(s). Nach einer neuen Fassung einmal neu
// laden – aber nur, wenn vorher schon der eigene Worker die Seite hatte (beim
// allerersten Besuch gibt es noch keinen, ein Neuladen brächte nichts).
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  const eigenerWorker = new URL('./sw.js', location.href).href;
  const hatteWorker = navigator.serviceWorker.controller?.scriptURL === eigenerWorker;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hatteWorker) return;
    try {
      if (sessionStorage.getItem('freizeit.neugeladen')) return;
      sessionStorage.setItem('freizeit.neugeladen', '1');
    } catch { return; }
    location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* dann ohne Offline-Betrieb */ });
  });
}

laden();
prog.ansicht = ANSICHTEN.some(([k]) => k === aktuell().programmAnsicht) ? aktuell().programmAnsicht : 'liste';
reiter = adresseLesen() || startReiter();
zeichnen();
ladeAlles().then((d) => {
  daten = d;
  ideenListe = alleIdeen(d.ideen || [], d.programm);
  geladen = true;
  zeichnen();
  abgleichJetzt();
});
