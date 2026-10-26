/*
 * Freizeit – was in Hamburg und Umgebung los ist, mit den Konzerten deiner
 * Künstler, auf Kalender und Karte, und gemeinsam mit deiner Begleitung.
 *
 * Einstieg: Daten laden, Reiter zeichnen, Knöpfe verdrahten, den gemeinsamen
 * Plan abgleichen. Die Daten schreibt ein geplanter Lauf montags früh nach
 * daten/; die App selbst ändert sie nie.
 */
import { laden, speichern, aktuell, bockUmschalten, bockWeg, LEERER_FILTER } from './speicher.js';
import { ladeAlles } from './daten.js';
import { heute, standText, montag, monatVon, monatPlus, plusTage } from './zeit.js';
import { esc } from './text.js';
import { programmAnsicht, wochenBereich } from './ansicht-programm.js';
import { kalenderAnsicht, monatsBereich } from './ansicht-kalender.js';
import { landkarteGeruest, landkarteZeichnen, landkarteAuffrischen } from './ansicht-landkarte.js';
import { wirAnsicht, vorbei, alsApp } from './ansicht-wir.js';
import { eintragZu, vergessen } from './karte.js';
import { istApple } from './teilen.js';
import {
  planStarten, beitreten, codeLesen, abgleichen, umbenennen, verlassen, neuesterAndererHaken,
} from './gemeinsam.js';

const REITER = ['programm', 'kalender', 'karte', 'wir'];
// Adressen aus der ersten Fassung (Lesezeichen) landen sinnvoll.
const ALTE_REITER = { woche: 'programm', konzerte: 'programm', merkliste: 'wir' };
const $ = (s) => document.querySelector(s);

let daten = { programm: null, fehler: [] };
let geladen = false;
let reiter = 'programm';
let woche = null; // Montag der gezeigten Woche im Programm
let monat = null; // „2026-11“ im Kalender
let gewaehlt = null; // gewählter Tag im Kalender
let raum = 'woche'; // Zeitraum auf der Karte
const ui = { einladen: false, umbenennen: false, verlassen: false, fehler: '', laeuft: false };
let installEreignis = null;

/** Einladung aus dem Link übernehmen, Reiter aus der Adresse lesen. */
function adresseLesen() {
  const h = decodeURIComponent(location.hash.slice(1));
  const einladung = h.match(/^einladung=([a-z0-9-]+)$/i);
  if (einladung) {
    const code = codeLesen(einladung[1]);
    const st = aktuell();
    if (code && !(st.gemeinsam && st.gemeinsam.code === code)) {
      st.einladung = code;
      speichern();
    }
    history.replaceState(null, '', `${location.pathname}${location.search}#wir`);
    return 'wir';
  }
  if (REITER.includes(h)) return h;
  return ALTE_REITER[h] || null;
}

function leisteAktualisieren() {
  const st = aktuell();
  document.querySelectorAll('[data-reiter]').forEach((b) => {
    if (b.dataset.reiter === reiter) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  const neu = neuesterAndererHaken();
  $('#wir-neu').hidden = !(st.gemeinsam && neu && neu > (st.gesehen.andere || '') && reiter !== 'wir');
  const p = daten.programm;
  $('#stand').textContent = p && p.stand ? `Stand ${standText(p.stand)}` : '';
}

function installHinweis(st) {
  if (alsApp() || st.installHinweisWeg) return '';
  const weg = '<button type="button" class="textknopf" data-aktion="hinweis-weg" aria-label="Hinweis schließen">✕</button>';
  if (istApple()) {
    return `<div class="banner hinweis-install"><span>Als App auf den Home-Bildschirm: unten auf <b>Teilen</b> tippen, dann <b>„Zum Home-Bildschirm“</b>.</span>${weg}</div>`;
  }
  if (installEreignis) {
    return `<div class="banner hinweis-install"><span>Freizeit lässt sich als App installieren.</span><button type="button" class="knopf klein" data-aktion="installieren">Installieren</button>${weg}</div>`;
  }
  return '';
}

function zeichnen({ nachOben = false, behalteScroll = false } = {}) {
  const st = aktuell();
  const h = heute();
  const y = window.scrollY;
  if (reiter !== 'karte') vergessen();
  let html;
  if (!geladen) html = '<div class="leer"><p>Lädt …</p></div>';
  else if (reiter === 'kalender') html = kalenderAnsicht(daten.programm, st, h, monat || monatVon(h), gewaehlt);
  else if (reiter === 'karte') html = landkarteGeruest(st, raum);
  else if (reiter === 'wir') html = wirAnsicht(daten.programm, st, h, ui);
  else html = installHinweis(st) + programmAnsicht(daten.programm, st, h, woche || montag(h));
  if (geladen && daten.fehler.length && reiter !== 'wir') {
    html += `<details class="datenfehler"><summary>Hinweise zu den Daten (${daten.fehler.length})</summary><ul>${daten.fehler.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></details>`;
  }
  $('#ansicht').innerHTML = html;
  if (geladen && reiter === 'karte') landkarteZeichnen(daten.programm, st, h, raum);
  if (reiter === 'wir' && st.gemeinsam) {
    const neu = neuesterAndererHaken();
    if (neu && neu !== st.gesehen.andere) {
      st.gesehen.andere = neu;
      speichern();
    }
  }
  leisteAktualisieren();
  if (nachOben) window.scrollTo(0, 0);
  else if (behalteScroll) window.scrollTo(0, y);
}

function wechseln(neu) {
  if (!REITER.includes(neu)) return;
  reiter = neu;
  ui.fehler = '';
  // Der Reiter steht in der Adresse, damit Neuladen ihn behält – ohne neuen
  // Eintrag im Verlauf.
  history.replaceState(null, '', neu === 'programm' ? location.pathname + location.search : `#${neu}`);
  zeichnen({ nachOben: true });
  $('#ansicht').focus({ preventScroll: true });
}

// --- Gemeinsamer Plan: abgleichen, wenn sich etwas tut, und jede Minute

let syncUhr = null;
const fingerabdruck = () => {
  const st = aktuell();
  return JSON.stringify([st.gemeinsam && st.gemeinsam.stand, Object.keys(st.bock).sort(), st.warteschlange.length]);
};

async function abgleichJetzt() {
  if (!aktuell().gemeinsam) return;
  const vorher = fingerabdruck();
  await abgleichen();
  if (!geladen) return;
  if (reiter === 'karte') landkarteAuffrischen();
  else if (vorher !== fingerabdruck() || reiter === 'wir') zeichnen({ behalteScroll: true });
  leisteAktualisieren();
}

function abgleichSpaeter(ms = 600) {
  clearTimeout(syncUhr);
  syncUhr = setTimeout(abgleichJetzt, ms);
}

async function mitWarten(aufgabe) {
  ui.laeuft = true;
  ui.fehler = '';
  zeichnen({ behalteScroll: true });
  try {
    await aufgabe();
  } catch (e) {
    ui.fehler = e && e.message && !/fetch|network|abort/i.test(e.message) ? e.message : 'Keine Verbindung zum Server. Später noch einmal versuchen.';
  } finally {
    ui.laeuft = false;
    zeichnen({ behalteScroll: true });
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
    const feld = $('#einladungslink');
    if (feld) feld.select();
  }
}

function aktion(name, z) {
  const st = aktuell();
  const h = heute();
  switch (name) {
    case 'vergangene':
      st.vergangeneTage = !st.vergangeneTage;
      speichern();
      zeichnen({ behalteScroll: true });
      break;
    case 'woche-zurueck':
    case 'woche-vor': {
      const { erste, letzte } = wochenBereich(daten.programm, h);
      const jetzt = woche || erste;
      const neu = plusTage(jetzt < erste ? erste : (jetzt > letzte ? letzte : jetzt), name === 'woche-vor' ? 7 : -7);
      woche = neu < erste ? erste : (neu > letzte ? letzte : neu);
      zeichnen({ nachOben: true });
      break;
    }
    case 'woche-heute':
      woche = null;
      zeichnen({ nachOben: true });
      break;
    case 'monat-zurueck':
    case 'monat-vor': {
      const { erster, letzter } = monatsBereich(daten.programm, h);
      const jetzt = monat || erster;
      const neu = monatPlus(jetzt, name === 'monat-vor' ? 1 : -1);
      monat = neu < erster ? erster : (neu > letzter ? letzter : neu);
      gewaehlt = null;
      zeichnen();
      break;
    }
    case 'filter-weg':
      st.filter = LEERER_FILTER();
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
      const code = wert('#wir-code');
      const name2 = wert('#wir-name-code');
      if (!codeLesen(code)) { ui.fehler = 'Der Code hat 12 Zeichen, etwa abcd-efgh-jkmn.'; zeichnen(); break; }
      if (!name2) { ui.fehler = 'Bitte deinen Namen eintragen.'; zeichnen(); break; }
      mitWarten(() => beitreten(code, name2));
      break;
    }
    case 'einfuegen':
      navigator.clipboard.readText().then((text) => {
        const feld = $('#wir-code');
        const m = String(text).match(/einladung=([a-z0-9-]+)/i);
        if (feld) feld.value = codeLesen(m ? m[1] : text) || String(text).trim();
      }).catch(() => { /* abgelehnt – dann von Hand */ });
      break;
    case 'code-kopieren':
      kopieren(z.dataset.code, z);
      break;
    case 'einladen':
      ui.einladen = !ui.einladen;
      ui.umbenennen = false;
      ui.verlassen = false;
      zeichnen({ behalteScroll: true });
      break;
    case 'abgleichen':
      abgleichJetzt();
      break;
    case 'umbenennen':
      ui.umbenennen = !ui.umbenennen;
      ui.einladen = false;
      ui.verlassen = false;
      zeichnen({ behalteScroll: true });
      break;
    case 'name-speichern': {
      const name2 = wert('#wir-neuname');
      if (!name2) break;
      mitWarten(async () => { await umbenennen(name2); ui.umbenennen = false; });
      break;
    }
    case 'verlassen':
      ui.verlassen = !ui.verlassen;
      ui.einladen = false;
      ui.umbenennen = false;
      zeichnen({ behalteScroll: true });
      break;
    case 'verlassen-ja':
      mitWarten(async () => { await verlassen(); ui.verlassen = false; });
      break;
    case 'installieren':
      if (installEreignis) {
        installEreignis.prompt();
        installEreignis = null;
        zeichnen({ behalteScroll: true });
      }
      break;
    case 'hinweis-weg':
      st.installHinweisWeg = true;
      speichern();
      zeichnen({ behalteScroll: true });
      break;
    default:
  }
}

function zuTag(tag) {
  reiter = 'programm';
  history.replaceState(null, '', location.pathname + location.search);
  woche = montag(tag);
  zeichnen({ nachOben: true });
  const ziel = document.getElementById(`tag-${tag}`);
  if (ziel) ziel.scrollIntoView();
}

document.addEventListener('click', (ev) => {
  const z = ev.target.closest('[data-reiter], [data-bock], [data-filter], [data-aktion], [data-tag], [data-raum], [data-zu-woche], [data-zu-tag]');
  if (!z || z.disabled) return;
  const st = aktuell();
  if (z.dataset.reiter) {
    wechseln(z.dataset.reiter);
  } else if (z.dataset.bock) {
    const eintrag = eintragZu(z.dataset.bock);
    if (!eintrag) return;
    const an = bockUmschalten(eintrag);
    document.querySelectorAll('[data-bock]').forEach((b) => {
      if (b.dataset.bock !== z.dataset.bock) return;
      b.setAttribute('aria-pressed', String(an));
      b.textContent = an ? 'Bock ✓' : 'Bock';
    });
    if (reiter === 'karte') landkarteAuffrischen();
    else if (reiter === 'kalender' || reiter === 'wir') zeichnen({ behalteScroll: true });
    leisteAktualisieren();
    if (st.gemeinsam) abgleichSpaeter();
  } else if (z.dataset.filter) {
    st.filter[z.dataset.filter] = !st.filter[z.dataset.filter];
    speichern();
    zeichnen({ behalteScroll: true });
  } else if (z.dataset.tag) {
    gewaehlt = z.dataset.tag;
    zeichnen({ behalteScroll: true });
    const t = $('#kal-tag');
    if (t && t.getBoundingClientRect().top > window.innerHeight * 0.6) t.scrollIntoView({ block: 'start' });
  } else if (z.dataset.raum) {
    raum = z.dataset.raum;
    document.querySelectorAll('[data-raum]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.raum === raum)));
    landkarteZeichnen(daten.programm, st, heute(), raum);
  } else if (z.dataset.zuWoche) {
    reiter = 'programm';
    history.replaceState(null, '', location.pathname + location.search);
    woche = z.dataset.zuWoche;
    zeichnen({ nachOben: true });
  } else if (z.dataset.zuTag) {
    zuTag(z.dataset.zuTag);
  } else if (z.dataset.aktion) {
    aktion(z.dataset.aktion, z);
  }
});

document.addEventListener('change', (ev) => {
  const st = aktuell();
  if (ev.target.id === 'f-region') st.filter.region = ev.target.value;
  else if (ev.target.id === 'f-kategorie') st.filter.kategorie = ev.target.value;
  else return;
  speichern();
  zeichnen({ behalteScroll: true });
});

// Enter im Namensfeld drückt den Hauptknopf daneben.
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter' || !ev.target.matches || !ev.target.matches('.einrichten input, .einladung input')) return;
  const knopf = ev.target.closest('.einrichten, .einladung').querySelector('.knopf.haupt');
  if (knopf) knopf.click();
});

// #programm, #kalender, #karte und #wir öffnen den Reiter direkt; #tag-… sind Anker.
window.addEventListener('hashchange', () => {
  const r = adresseLesen();
  if (r && r !== reiter) wechseln(r);
  else if (r === 'wir') zeichnen();
});

window.addEventListener('beforeinstallprompt', (ev) => {
  ev.preventDefault();
  installEreignis = ev;
  if (reiter === 'programm' && geladen) zeichnen({ behalteScroll: true });
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
reiter = adresseLesen() || 'programm';
zeichnen();
ladeAlles().then((d) => {
  daten = d;
  geladen = true;
  zeichnen();
  abgleichJetzt();
});
