/*
 * Freizeit – was in Hamburg und Umgebung los ist, mit den Konzerten deiner
 * Künstler, auf Kalender und Karte, Ideen für alles ohne Termin, und
 * gemeinsam mit deinen Leuten.
 *
 * Einstieg: Daten laden, Reiter zeichnen, Knöpfe verdrahten, den gemeinsamen
 * Plan abgleichen. Das Programm schreibt ein geplanter Lauf montags früh nach
 * daten/, den Ideen-Katalog pflegt man von Hand; die App selbst ändert
 * beides nie.
 */
import {
  laden, speichern, aktuell, bockUmschalten, bockWeg, meinBock, gemachtSpeichern, gemachtWeg, LEERER_FILTER, LEERER_IDEENFILTER,
} from './speicher.js';
import { ladeAlles } from './daten.js';
import { heute, standText, montag, plusTage, wochentagKurz, tagMonat } from './zeit.js';
import { esc } from './text.js';
import { programmAnsicht, wochenBereich } from './ansicht-programm.js';
import { kalenderAnsicht, ANSICHTEN } from './ansicht-kalender.js';
import { landkarteGeruest, landkarteZeichnen, landkarteAuffrischen } from './ansicht-landkarte.js';
import { ideenAnsicht, ideeAnker } from './ansicht-ideen.js';
import { wirAnsicht, vorbei, alsApp } from './ansicht-wir.js';
import { alleIdeen, planEintrag, neueIdee, BEWERTUNG } from './ideen.js';
import { eintragZu, vergessen as karteVergessen, bockKnopf } from './karte.js';
import { istApple } from './teilen.js';
import {
  planStarten, beitreten, codeLesen, zugangLesen, zugangUebernehmen, einladungAnsehen, abgleichen, umbenennen, verlassen,
  vergessen as planVergessen, wiederBeitreten, entfernen, neuesterAndererHaken, rolle,
} from './gemeinsam.js';

const REITER = ['programm', 'kalender', 'karte', 'ideen', 'wir'];
// Adressen aus der ersten Fassung (Lesezeichen) landen sinnvoll.
const ALTE_REITER = { woche: 'programm', konzerte: 'programm', merkliste: 'wir' };
const $ = (s) => document.querySelector(s);

let daten = { programm: null, ideen: null, fehler: [] };
let ideenListe = []; // Katalog und Ausflugsziele aus dem Programm (ideen.js, alleIdeen)
let geladen = false;
let reiter = 'programm';
let woche = null; // Montag der gezeigten Woche im Programm
const kal = { ansicht: 'monat', datum: '' }; // Kalender: Monat/Woche/Tag und der gewählte Tag
let raum = 'woche'; // Zeitraum auf der Karte
// Reiter Wir: offene Felder, die Person, die gleich herausgenommen wird, wer zu
// einem Einladungslink einlädt, aufgeklappte Abschnitte (data-offen)
const ui = {
  einladen: false, umbenennen: false, verlassen: false, geraet: false, hilfe: false, entfernen: '', fehler: '', laeuft: false, einladungVon: null, offen: new Set(),
  zeitenWoche: '', // Montag der Woche in „Wann hat … Zeit?“
};
// Reiter Ideen: offene Formulare („bereich|schlüssel“), aufgeklappte Kategorien, letzte Meldung
const uiIdeen = { neu: false, planen: '', bewerten: '', offen: new Set(), saisonAlle: false, meldung: null, fehler: '' };
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
  if (REITER.includes(h)) return h;
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
  if (reiter !== 'karte') karteVergessen();
  let html;
  if (!geladen) html = '<div class="leer"><p>Lädt …</p></div>';
  else if (reiter === 'kalender') html = kalenderAnsicht(daten.programm, st, h, kal);
  else if (reiter === 'karte') html = landkarteGeruest(st, raum);
  else if (reiter === 'ideen') html = ideenAnsicht(ideenListe, Boolean(daten.ideen), st, h, uiIdeen);
  else if (reiter === 'wir') html = wirAnsicht(daten.programm, ideenListe, st, h, ui);
  else html = installHinweis(st) + programmAnsicht(daten.programm, st, h, woche || montag(h));
  if (geladen && daten.fehler.length && reiter !== 'wir') {
    html += `<details class="datenfehler"><summary>Hinweise zu den Daten (${daten.fehler.length})</summary><ul>${daten.fehler.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></details>`;
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
  if (nachOben) window.scrollTo(0, 0);
  else if (behalteScroll) window.scrollTo(0, y);
}

function wechseln(neu) {
  if (!REITER.includes(neu)) return;
  reiter = neu;
  ui.fehler = '';
  ui.entfernen = '';
  Object.assign(uiIdeen, { neu: false, planen: '', bewerten: '', meldung: null, fehler: '' });
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

/** Steht gerade ein Formular im Reiter Ideen offen? Dann nicht dazwischen neu zeichnen. */
const ideenFormularOffen = () => reiter === 'ideen' && Boolean(uiIdeen.neu || uiIdeen.planen || uiIdeen.bewerten);
/** Tippt man gerade in ein Feld? Dann auch nicht – die Eingabe ginge verloren. */
const wirEingabeOffen = () => Boolean(document.activeElement && document.activeElement.matches('#ansicht input, #ansicht textarea, #ansicht select'));

async function abgleichJetzt() {
  einladungPruefen();
  if (!aktuell().gemeinsam) return;
  const vorher = fingerabdruck();
  await abgleichen();
  if (!geladen) return;
  if (ideenFormularOffen() || wirEingabeOffen()) { leisteAktualisieren(); return; }
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
    // Ohne Zwischenablage: den Text im Feld zeigen und markieren, zum Kopieren von Hand.
    const feld = $(knopf.dataset.feld || '#einladungslink');
    if (feld) {
      const huelle = feld.closest('details');
      if (huelle) huelle.open = true;
      feld.select();
    }
  }
}

/** Nur eines der Felder unter „Wir“ ist offen. */
function wirFeld(name) {
  const offen = ui[name];
  Object.assign(ui, { einladen: false, umbenennen: false, verlassen: false, geraet: false, hilfe: false });
  ui[name] = !offen;
  zeichnen({ behalteScroll: true });
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
    case 'kal-zurueck':
    case 'kal-vor':
      if (z.dataset.datum) { kal.datum = z.dataset.datum; zeichnen(); }
      break;
    case 'kal-heute':
      kal.datum = h;
      zeichnen();
      break;
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
      abgleichJetzt();
      break;
    case 'name-speichern': {
      const name2 = wert('#wir-neuname');
      if (!name2) break;
      mitWarten(async () => { await umbenennen(name2); ui.umbenennen = false; });
      break;
    }
    case 'verlassen-ja':
      mitWarten(async () => { await verlassen(); ui.verlassen = false; });
      break;
    case 'zugang-uebernehmen':
      mitWarten(async () => {
        await zugangUebernehmen(st.zugang);
        Object.assign(ui, { einladen: false, umbenennen: false, verlassen: false, geraet: false });
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
      melden(`Eingeplant: ${idee.titel}, ${wochentagKurz(datum)} ${tagMonat(datum)} – steht im Kalender.`, { bock: plan.schluessel });
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
    case 'saison-alle':
      uiIdeen.saisonAlle = !uiIdeen.saisonAlle;
      neuZeichnen();
      break;
    case 'ideen-filter-weg':
      st.ideenFilter = LEERER_IDEENFILTER();
      speichern();
      neuZeichnen();
      break;
    case 'karte-ideen':
      st.karteIdeen = !st.karteIdeen;
      speichern();
      z.setAttribute('aria-pressed', String(st.karteIdeen));
      landkarteZeichnen(daten.programm, st, h, raum, ideenListe);
      break;
    default:
  }
}

/** Filter im Reiter Ideen: „w:flow“ (Wirkung), „wo:hamburg“, „x:kostenlos“. */
function ideenFilterUmschalten(wert) {
  const f = aktuell().ideenFilter;
  const [art, k] = wert.split(':');
  if (art === 'w') f.wirkung = f.wirkung.includes(k) ? f.wirkung.filter((w) => w !== k) : [...f.wirkung, k];
  else if (art === 'wo') f.wo = f.wo === k ? '' : k;
  else if (art === 'x' && Object.hasOwn(f, k)) f[k] = !f[k];
  speichern();
  zeichnen({ behalteScroll: true });
}

/** Aus der Karte zu einer Idee: Reiter Ideen, Kategorie auf, hinscrollen. */
function zuIdee(schluessel) {
  const x = ideenListe.find((i) => i.schluessel === schluessel);
  if (x) uiIdeen.offen.add(x.kat);
  wechseln('ideen');
  const ziel = document.getElementById(ideeAnker(schluessel));
  if (ziel) ziel.scrollIntoView({ block: 'start' });
}

/** Im Kalender einen Tag öffnen (Tagesansicht). */
function zuKalenderTag(tag) {
  kal.datum = tag;
  kal.ansicht = 'tag';
  zeichnen({ nachOben: true });
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
  const z = ev.target.closest('[data-reiter], [data-bock], [data-filter], [data-ifilter], [data-aktion], [data-zu-eintrag], [data-kal-ansicht], [data-tag], [data-raum], [data-zu-woche], [data-zu-tag], [data-zu-idee]');
  if (!z || z.disabled) return;
  const st = aktuell();
  if (z.dataset.reiter) {
    if (z.dataset.kalWechsel) { kal.ansicht = z.dataset.kalWechsel; st.kalenderAnsicht = kal.ansicht; speichern(); }
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
    else if (reiter === 'kalender' || reiter === 'wir' || reiter === 'ideen') zeichnen({ behalteScroll: true });
    leisteAktualisieren();
    if (st.gemeinsam) abgleichSpaeter();
  } else if (z.dataset.ifilter !== undefined) {
    ideenFilterUmschalten(z.dataset.ifilter);
  } else if (z.dataset.zuIdee) {
    zuIdee(z.dataset.zuIdee);
  } else if (z.dataset.filter) {
    st.filter[z.dataset.filter] = !st.filter[z.dataset.filter];
    speichern();
    zeichnen({ behalteScroll: true });
  } else if (z.dataset.zuEintrag) {
    // Ein Chip in der Wochenansicht: den Tag öffnen und zur Karte scrollen.
    zuKalenderTag(z.dataset.tag);
    const ziel = document.getElementById(z.dataset.zuEintrag);
    if (ziel) ziel.scrollIntoView({ block: 'center' });
  } else if (z.dataset.kalAnsicht) {
    kal.ansicht = z.dataset.kalAnsicht;
    st.kalenderAnsicht = kal.ansicht;
    speichern();
    zeichnen({ nachOben: true });
  } else if (z.dataset.tag) {
    zuKalenderTag(z.dataset.tag);
  } else if (z.dataset.raum) {
    raum = z.dataset.raum;
    document.querySelectorAll('[data-raum]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.raum === raum)));
    landkarteZeichnen(daten.programm, st, heute(), raum, ideenListe);
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

// Enter in einem Eingabefeld drückt den Hauptknopf daneben.
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter' || !ev.target.matches || !ev.target.matches('.einrichten input, .einladung input, .formular input')) return;
  const knopf = ev.target.closest('.einrichten, .einladung, .formular').querySelector('.knopf.haupt');
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
  const [menge, k] = d.dataset.kat ? [uiIdeen.offen, d.dataset.kat] : [ui.offen, d.dataset.offen];
  if (d.open) menge.delete(k); // klappt gleich zu
  else menge.add(k);
}, true);

// #programm, #kalender, #karte, #ideen und #wir öffnen den Reiter direkt; #tag-… sind Anker.
window.addEventListener('hashchange', () => {
  const r = adresseLesen();
  if (r && r !== reiter) wechseln(r);
  else if (r === 'wir') zeichnen();
  einladungPruefen();
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
kal.ansicht = ANSICHTEN.some(([k]) => k === aktuell().kalenderAnsicht) ? aktuell().kalenderAnsicht : 'monat';
reiter = adresseLesen() || 'programm';
zeichnen();
ladeAlles().then((d) => {
  daten = d;
  ideenListe = alleIdeen(d.ideen || [], d.programm);
  geladen = true;
  zeichnen();
  abgleichJetzt();
});
