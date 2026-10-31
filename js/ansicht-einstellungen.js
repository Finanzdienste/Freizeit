/*
 * Einstellungen (der Reiter ganz rechts, Adresse #einstellungen): alles, was
 * man einmal einstellt und dann in Ruhe lässt – an einem Ort, statt verstreut
 * über die Reiter.
 *
 *   Reiter unten       Programm, Karte, Ideen, Wir einzeln an oder aus;
 *                      Einstellungen ist immer da, einer der vier bleibt an
 *   Mein Standort      Bezugspunkt für Entfernungen: das Gerät oder eine
 *                      Adresse (standort.js). Umkreis und Reihenfolge stehen
 *                      im Filter.
 *   Mitteilungen       nur der Gastgeber: Push an oder aus (push.js)
 *   Gemeinsamer Plan   Abgleich, Name, weiteres Gerät, „So geht's“,
 *                      Verlassen bzw. Auflösen – ohne Plan der Weg zu „Wir“
 *   App                Installieren, Stand des Programms und des Katalogs,
 *                      Hinweise zu den Daten
 */
import { esc, anzahl } from './text.js';
import { standText, wochentagKurz, tagMonat } from './zeit.js';
import { standortUi } from './standort.js';
import { pushAn, pushHindernis } from './push.js';
import { syncStatus, zugangsLink, rolle } from './gemeinsam.js';
import { istApple, alsApp } from './teilen.js';
import { hilfeKarte } from './ansicht-wir.js';
import { INHALTS_REITER } from './speicher.js';

/** Wie die Reiter unten heißen – dieselben Wörter wie in der Leiste (index.html). */
const REITER_NAMEN = {
  programm: 'Programm', karte: 'Karte', ideen: 'Ideen', wir: 'Wir',
};

const fehlerBox = (ui, ort) => (ui.fehler && ui.fehlerOrt === ort ? `<div class="fehlerbox" role="alert">${esc(ui.fehler)}</div>` : '');

/** Eine Zeile, die etwas aufklappt (Name ändern, Weiteres Gerät …). */
const zeilenKnopf = (aktion, text, offen, warn = false) => `<button type="button" class="zeilen-knopf${warn ? ' warn-text' : ''}" data-aktion="${aktion}" aria-expanded="${Boolean(offen)}"><span>${esc(text)}</span><span class="pfeil-rechts" aria-hidden="true"></span></button>`;

const abschnitt = (id, titel, inhalt, unter = '') => `<section class="einstellung" id="${id}" aria-labelledby="${id}-titel">
    <h2 class="einstellung-titel" id="${id}-titel">${esc(titel)}</h2>
    <div class="e-gruppe">${inhalt}</div>
    ${unter ? `<p class="fein e-unter">${unter}</p>` : ''}
  </section>`;

/**
 * Welche Reiter unten stehen: je ein Schalter (die ganze Zeile tippt), in der
 * Reihenfolge der Leiste. Der letzte, der noch an ist, lässt sich nicht
 * abschalten – er bleibt bedienbar (aria-disabled statt disabled), damit man
 * auch mit Tastatur und Vorleser erfährt, warum.
 */
function reiterTeil(st) {
  const an = INHALTS_REITER.filter((r) => !st.reiterAus.includes(r));
  const zeilen = INHALTS_REITER.map((r) => {
    const ist = an.includes(r);
    const letzter = ist && an.length === 1;
    return `<button type="button" class="schalter-zeile" role="switch" aria-checked="${ist}" data-aktion="reiter-an" data-wert="${r}"${letzter ? ' aria-disabled="true"' : ''}>
      <span class="schalter-name">${REITER_NAMEN[r]}${letzter ? '<span class="fein">Einer bleibt immer an</span>' : ''}</span>
      <span class="kippschalter" aria-hidden="true"></span></button>`;
  }).join('');
  return abschnitt('e-reiter', 'Reiter unten', `${zeilen}
    <div class="e-zeile"><span>Einstellungen</span><span class="fein">immer da</span></div>`,
  'Die App öffnet mit dem ersten, der an ist. Was du ausblendest, bleibt über Links erreichbar – etwa aus einer Mitteilung.');
}

/** Der Bezugspunkt: was gilt, „Mein Standort“, die Adresssuche – samt Meldungen. */
function standortTeil(st) {
  const s = st.standort;
  const ui = standortUi;
  const laeuft = Boolean(ui.laeuft);
  const zeit = s && s.art === 'geraet' && /T\d{2}:\d{2}/.test(s.zeit)
    ? new Date(s.zeit).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '';
  const jetzt = s
    ? `<div class="e-zeile standort-jetzt">
        <span class="standort-name">📍 ${esc(s.name)}${zeit ? ` <span class="fein">· bestimmt ${zeit} Uhr</span>` : ''}</span>
        <button type="button" class="textknopf" data-aktion="standort-weg">Löschen</button>
      </div>`
    : '<div class="e-zeile fein">Noch kein Standort – dann gibt es keine Entfernungen und keinen Umkreis.</div>';
  const wahl = `<div class="e-zeile standort-wahl">
      <button type="button" class="knopf" data-aktion="standort-geraet"${laeuft ? ' disabled' : ''}>${s && s.art === 'geraet' ? 'Standort neu bestimmen' : 'Mein Standort'}</button>
      <div class="standort-suche">
        <input id="standort-adresse" class="eingabe" type="search" placeholder="Adresse oder Ort" aria-label="Adresse oder Ort" enterkeyhint="search" maxlength="200" value="${esc(ui.eingabe)}">
        <button type="button" class="knopf" data-aktion="standort-suchen"${laeuft ? ' disabled' : ''}>Suchen</button>
      </div>
      ${ui.laeuft ? `<p class="fein" role="status">${ui.laeuft === 'geraet' ? 'Standort wird bestimmt …' : 'Suche läuft …'}</p>` : ''}
      ${ui.fehler ? `<p class="standort-fehler" role="alert">${esc(ui.fehler)}</p>` : ''}
      ${ui.treffer.length ? `<div class="standort-treffer" role="group" aria-label="Treffer">
        <span class="fein">Welcher Ort ist gemeint?</span>
        ${ui.treffer.map((t, i) => `<button type="button" class="treffer-knopf" data-aktion="standort-waehlen" data-nr="${i}">${esc(t.name)}</button>`).join('')}
      </div>` : ''}
    </div>`;
  return abschnitt('e-standort', 'Mein Standort', jetzt + wahl,
    'Luftlinie. Dein Standort bleibt auf dem Gerät; eine eingetippte Adresse geht zum Suchen an OpenStreetMap. Umkreis und Reihenfolge stellst du im Filter ein.');
}

/**
 * Push für den Gastgeber (push.js): an, ausschaltbar – oder der Knopf zum
 * Anschalten. Steht etwas im Weg, steht das da statt des Knopfs; ein
 * Browser, der es gar nicht kann, bekommt eine Zeile, die das sagt.
 */
function mitteilungenTeil(ui) {
  let zeile;
  if (pushAn()) {
    zeile = `<div class="e-zeile push-zeile" data-push="an"><span>🔔 Du bekommst Bescheid, wenn jemand dazukommt oder anhakt.</span>
      <button type="button" class="textknopf" data-aktion="push-aus">Ausschalten</button></div>`;
  } else {
    const h = pushHindernis();
    if (h.grund === 'browser') zeile = `<div class="e-zeile fein">${esc(h.text)}</div>`;
    else if (h.grund) zeile = `<div class="e-zeile push-zeile fein" data-push="${esc(h.grund)}">🔔 ${esc(h.text)}</div>`;
    else {
      zeile = `<div class="e-zeile push-zeile" data-push="aus">
        <button type="button" class="knopf" data-aktion="push-an"${ui.laeuft ? ' disabled' : ''}>🔔 Bescheid sagen</button>
        <span class="fein">wenn jemand dazukommt oder anhakt – auch bei geschlossener App</span></div>`;
    }
  }
  return abschnitt('e-mitteilungen', 'Mitteilungen', zeile + fehlerBox(ui, 'push'));
}

function planTeil(st, ui) {
  const g = st.gemeinsam;
  if (!g || g.raus) {
    const text = g ? 'Du bist nicht mehr in diesem Plan – was jetzt geht, steht unter „Wir“.' : 'Noch kein gemeinsamer Plan. Unter „Wir“ startest du einen oder trittst mit Code bei.';
    return abschnitt('e-plan', 'Gemeinsamer Plan', `<div class="e-zeile"><span class="fein">${text}</span>
      <button type="button" class="knopf" data-reiter="wir">Zu „Wir“</button></div>`);
  }
  const gastgeber = rolle() === 'gastgeber';
  const s = syncStatus();
  const zeit = s.zuletzt ? new Date(s.zuletzt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '';
  const andere = Math.max(0, g.stand.personen.length - 1);
  const stand = [
    `${esc(g.ich.name)}${gastgeber ? ' · Gastgeber' : ''}`,
    s.laeuft ? 'gleicht ab …' : (zeit ? `abgeglichen ${zeit} Uhr` : 'noch nicht abgeglichen'),
    s.offline ? 'gerade offline' : '',
  ].filter(Boolean).join(' · ');
  const panel = (inhalt) => `<div class="e-zeile einstellung-feld">${inhalt}</div>`;
  return abschnitt('e-plan', 'Gemeinsamer Plan', `
    <div class="e-zeile abgleich"><span class="fein">${stand}</span>
      <button type="button" class="knopf klein" data-aktion="abgleichen"${s.laeuft ? ' disabled' : ''}>Jetzt abgleichen</button></div>
    ${zeilenKnopf('umbenennen', 'Name ändern', ui.umbenennen)}
    ${ui.umbenennen ? panel(`<label class="feld-label">Dein Name<input id="wir-neuname" class="eingabe" maxlength="30" value="${esc(g.ich.name)}"></label>
      <div class="aktionen"><button type="button" class="knopf haupt" data-aktion="name-speichern">Speichern</button></div>`) : ''}
    ${zeilenKnopf('geraet', 'Weiteres Gerät', ui.geraet)}
    ${ui.geraet ? panel(`<p>Öffne diesen Link auf deinem anderen Gerät – oder füg ihn dort in der App unter „Wir“ bei „Ich habe einen Code“ ein. Dann bist du dort dieselbe Person${gastgeber ? ', auch als Gastgeber' : ''}.</p>
      <input class="eingabe" id="geraetlink" readonly value="${esc(zugangsLink(g))}">
      <div class="aktionen"><button type="button" class="knopf" data-aktion="code-kopieren" data-code="${esc(zugangsLink(g))}" data-feld="#geraetlink">Link kopieren</button></div>
      <p class="fein warn-text">Nur für dich: Wer diesen Link hat, ist im Plan du${gastgeber ? ' – und sieht alle Haken' : ''}.</p>`) : ''}
    ${zeilenKnopf('hilfe', 'So geht\'s', ui.hilfe)}
    ${ui.hilfe ? `<div class="e-zeile">${hilfeKarte()}</div>` : ''}
    ${zeilenKnopf('verlassen', gastgeber ? 'Plan auflösen' : 'Plan verlassen', ui.verlassen, true)}
    ${ui.verlassen ? panel(`<p>${gastgeber
    ? `Wirklich auflösen? Der Plan ist dann für alle weg${andere ? ` – ${anzahl(andere, 'Person', 'Leute')} mit allen ihren Haken` : ''}. Deine eigenen Haken bleiben hier auf dem Gerät.`
    : 'Wirklich verlassen? Deine Haken verschwinden dann für die anderen; hier auf dem Gerät bleiben sie.'}</p>
      <div class="aktionen"><button type="button" class="knopf warnknopf" data-aktion="verlassen-ja"${ui.laeuft ? ' disabled' : ''}>${gastgeber ? 'Ja, auflösen' : 'Ja, verlassen'}</button>
      <button type="button" class="knopf" data-aktion="verlassen">Abbrechen</button></div>`) : ''}
    ${fehlerBox(ui, 'plan')}`);
}

/** Installieren (wenn der Browser es anbietet, sonst der Weg dorthin), Stand der Daten, Hinweise. */
function appTeil(p, ideenStand, datenFehler, installierbar) {
  let installieren;
  if (alsApp()) installieren = '<div class="e-zeile fein">Läuft als App vom Home-Bildschirm.</div>';
  else if (installierbar) {
    installieren = `<div class="e-zeile"><span>Freizeit als App installieren – mit eigenem Symbol, ohne Browserleiste.</span>
      <button type="button" class="knopf haupt" data-aktion="installieren">Installieren</button></div>`;
  } else if (istApple()) {
    installieren = '<div class="e-zeile install-weg">Als App auf den Home-Bildschirm: unten auf <b>Teilen</b> tippen, dann <b>„Zum Home-Bildschirm“</b>.</div>';
  } else {
    installieren = '<div class="e-zeile install-weg fein">Als App: im Browser-Menü „App installieren“ bzw. „Zum Startbildschirm“.</div>';
  }
  const programm = p && p.stand
    ? `Stand ${esc(standText(p.stand))}${p.bis ? ` · bis ${esc(`${wochentagKurz(p.bis)} ${tagMonat(p.bis)}`)}` : ''}`
    : 'noch nicht geladen';
  const fehler = datenFehler.length
    ? `<details class="e-zeile datenfehler"><summary>Hinweise zu den Daten (${datenFehler.length})</summary><ul>${datenFehler.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></details>` : '';
  return abschnitt('e-app', 'App', `${installieren}
    <div class="e-zeile" id="stand"><span>Programm</span><span class="fein">${programm}</span></div>
    ${ideenStand ? `<div class="e-zeile"><span>Ideen-Katalog</span><span class="fein">Stand ${esc(standText(ideenStand))}</span></div>` : ''}
    ${fehler}`, 'Das neue Programm kommt montags gegen 7 Uhr.');
}

/**
 * @param {object} o  p (Programm), ideenStand, datenFehler, installierbar (der Browser bietet „Installieren“ an)
 */
export function einstellungenAnsicht(st, ui, {
  p = null, ideenStand = '', datenFehler = [], installierbar = false,
} = {}) {
  return `<header class="seiten-kopf">
    <h1 class="seiten-titel">Einstellungen</h1>
  </header>
  ${reiterTeil(st)}
  ${standortTeil(st)}
  ${st.gemeinsam && !st.gemeinsam.raus && rolle() === 'gastgeber' ? mitteilungenTeil(ui) : ''}
  ${planTeil(st, ui)}
  ${appTeil(p, ideenStand, datenFehler, installierbar)}`;
}
