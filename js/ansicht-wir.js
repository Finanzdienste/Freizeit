/*
 * Reiter „Wir“: der gemeinsame Plan – einrichten, und was die anderen wollen.
 *
 * Ohne Plan steht hier die eigene Bock-Liste und der Weg in einen Plan:
 * selbst einen starten (dann ist man Gastgeber) oder mit Code bzw. Link
 * beitreten.
 *
 * Der Gastgeber sieht hier seinen Überblick: wo ihr zusammen Bock habt, was
 * jemand mit ihm machen will, was die anderen ohne ihn vorhaben, und das
 * alles noch einmal je Person. Wer eingeladen ist, sieht, worauf der
 * Gastgeber Bock hat, und seine eigenen Haken – von den anderen nichts.
 * Jeder Eintrag steht dabei nur einmal, im ersten Abschnitt, der passt.
 *
 * Ein Haken trägt einen Schnappschuss seines Eintrags mit sich; fällt der
 * Eintrag aus den Daten (vorbei, neuer Montagslauf), steht er trotzdem
 * vollständig da.
 *
 * Einladen: Der Link trägt den Code hinter # (#einladung=…). Auf dem iPhone
 * hat die App auf dem Home-Bildschirm einen eigenen Speicher, getrennt von
 * Safari – deshalb steht dort der Code zum Abschreiben bzw. Einfügen. Mit dem
 * Link „Weiteres Gerät“ (#geraet=…) ist man auf einem zweiten Gerät dieselbe
 * Person, der Gastgeber samt Schlüssel.
 */
import { esc, anzahl, sichererLink } from './text.js';
import { karte, alleEintraege, wannKurz } from './karte.js';
import { montag, wochentagKurz, tagMonat } from './zeit.js';
import { meinBock } from './speicher.js';
import {
  andere, hakenDerAnderen, syncStatus, einladungsLink, zugangsLink, zugangLesen, person, rolle, gastgeberName, mitWem,
} from './gemeinsam.js';
import { istApple } from './teilen.js';
import { pushAn, pushHindernis } from './push.js';
import { zeitenWochen, belegung } from './zeiten.js';
import { planAusSchnappschuss, ideeAusSchnappschuss } from './ideen.js';

/** Läuft die App vom Home-Bildschirm (und nicht im Browser)? */
export const alsApp = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

/** Wann ist ein Eintrag vorbei? Termine am Tag danach, Laufendes nach dem letzten Tag. */
export const vorbei = (e, heute) => (e.datum ? e.datum < heute : Boolean(e.bis) && e.bis < heute);

/** Nach Tag und Uhrzeit; Ideen (ohne Tag) danach – die mit den meisten Leuten zuerst. */
function sortiert(liste, zahl = () => 0) {
  const s = (e) => `${e.datum || e.von || '9999'} ${String(e.zeit || '').match(/\d{1,2}:\d{2}/)?.[0].padStart(5, '0') || '99:99'}`;
  return [...liste].sort((a, b) => s(a).localeCompare(s(b)) || zahl(b) - zahl(a) || String(a.titel).localeCompare(String(b.titel), 'de'));
}

/** Alle Einträge mit Haken: frisch aus den Daten, sonst aus dem Schnappschuss. */
function eintraegeMitHaken(p, ideen, st) {
  const frisch = alleEintraege(p, ideen);
  const schnapp = new Map();
  for (const [k, v] of Object.entries(st.bock)) schnapp.set(k, v);
  for (const b of hakenDerAnderen()) if (!schnapp.has(b.eintrag) && b.daten) schnapp.set(b.eintrag, b.daten);
  return [...schnapp.keys()].map((k) => {
    if (frisch.has(k)) return frisch.get(k);
    const s = schnapp.get(k) || {};
    if (k.startsWith('p:')) return planAusSchnappschuss(k, s);
    if (k.startsWith('e:') || k.startsWith('i:')) return ideeAusSchnappschuss(k, s);
    return { ...s, schluessel: k, titel: String(s.titel || 'Eintrag'), link: sichererLink(s.link), quelle: s.quelle || 'termin' };
  }).filter(Boolean);
}

const karten = (es) => es.map((e) => karte(e, { zeitSpalte: true, zeitText: wannKurz(e) })).join('');

/** Was mit dem Einladungslink per WhatsApp mitgeht – vom Gastgeber, in der ersten Person. */
export function einladungsText(name, link, code) {
  return `Hey! Ich hab mir eine kleine Freizeit-App gebaut: Da steht drin, was in Hamburg und Umgebung los ist – Konzerte, Theater, Märkte, Ausflüge, gut einen Monat im Voraus – plus Ideen für alles ohne Termin.

Hak einfach an, worauf du Bock hast: „Mit ${name}“ oder „Allein/mit anderen“. Dann seh ich, wo wir zusammen hinwollen, und wir müssen nicht ewig hin und her schreiben. Deine Haken sehe nur ich. Keine Anmeldung, nur dein Name.

${link}

iPhone: Link in Safari öffnen → Teilen → „Zum Home-Bildschirm“, dann in der App unter „Wir“ den Code eingeben: ${code}`;
}

function abschnitt(id, titel, text, inhalt) {
  return `<section class="abschnitt" id="${id}"><h2 class="abschnitt-titel">${esc(titel)}</h2>${text ? `<p class="fein">${text}</p>` : ''}${inhalt}</section>`;
}

function ideenZeile(n) {
  return n ? `<p class="fein">Außerdem ${anzahl(n, 'Idee', 'Ideen')} mit Bock – im Reiter <button type="button" class="textknopf" data-reiter="ideen">Ideen</button> unter „Wollen wir mal“.</p>` : '';
}

function vorbeiListe(alt, ui) {
  if (!alt.length) return '';
  return `<details class="abschnitt vorbei-liste" data-offen="vorbei"${ui.offen && ui.offen.has('vorbei') ? ' open' : ''}><summary class="monat">Vorbei (${alt.length})</summary>
    <div class="zeile"><span class="fein">Deine vergangenen Haken lassen sich wegräumen.</span><button type="button" class="knopf" data-aktion="vorbei-weg">Vorbei entfernen</button></div>
    ${karten(alt)}</details>`;
}

// --- Ohne Plan: einrichten

function iPhoneSchritte(code) {
  return `<ol class="schritte">
    <li>Unten auf <b>Teilen</b> tippen (Quadrat mit Pfeil) und <b>„Zum Home-Bildschirm“</b> wählen.</li>
    <li>Die App <b>Freizeit</b> vom Home-Bildschirm öffnen.</li>
    <li>Dort unter <b>Wir</b> diesen Code einfügen: <code class="code">${esc(code)}</code>
      <button type="button" class="knopf klein" data-aktion="code-kopieren" data-code="${esc(code)}">Code kopieren</button></li>
  </ol>
  <p class="fein">Warum zweimal? Das iPhone trennt die App auf dem Home-Bildschirm von Safari – sie kennt den Link nicht.</p>`;
}

function einladungKarte(st, ui) {
  const von = ui.einladungVon && ui.einladungVon.code === st.einladung ? ui.einladungVon : null;
  const name = von && von.name ? esc(von.name) : '';
  const fehler = ui.fehler ? `<div class="fehlerbox" role="alert">${esc(ui.fehler)}</div>` : '';
  const gibtsNicht = von && !von.da && !ui.fehler
    ? '<div class="fehlerbox" role="alert">Zu diesem Link gibt es keinen Plan (mehr). Ist er vollständig angekommen?</div>' : '';
  const imBrowserAufIPhone = istApple() && !alsApp();
  return `<section class="einrichten" id="einladung-karte">
    <h3>${name ? `${name} lädt dich ein` : 'Du bist eingeladen'}</h3>
    <p><b>Freizeit</b> zeigt, was in Hamburg und Umgebung los ist – Konzerte, Theater, Märkte, Ausflüge, gut einen Monat im Voraus –, dazu Ideen für alles ohne Termin.</p>
    <p>Gib deinen Namen ein und hak an, worauf du Bock hast – <b>mit ${name || 'dem, der dich eingeladen hat'}</b> oder <b>allein/mit anderen</b>.
      ${name ? `Deine Haken sieht nur ${name}, und du siehst, worauf ${name} Bock hat` : 'Deine Haken sieht nur, wer dich eingeladen hat'} – sonst niemand.</p>
    ${imBrowserAufIPhone ? `<h4>Erst auf den Home-Bildschirm</h4>${iPhoneSchritte(st.einladung)}<h4>Oder gleich hier im Browser</h4>` : ''}
    <label class="feld-label">Dein Name<input id="wir-name" class="eingabe" maxlength="30" autocomplete="given-name" enterkeyhint="go"></label>
    ${fehler}${gibtsNicht}
    <button type="button" class="knopf haupt" data-aktion="beitreten"${ui.laeuft ? ' disabled' : ''}>${ui.laeuft ? 'Einen Moment …' : 'Los geht\'s'}</button>
    <p class="fein">Code: <code class="code">${esc(st.einladung)}</code></p>
  </section>`;
}

function einrichten(st, ui) {
  if (st.einladung) return einladungKarte(st, ui);
  const kannEinfuegen = Boolean(navigator.clipboard && navigator.clipboard.readText);
  const fehler = ui.fehler ? `<div class="fehlerbox" role="alert">${esc(ui.fehler)}</div>` : '';
  const warte = ui.laeuft ? ' disabled' : '';
  const codeKarte = `<section class="einrichten">
      <h3>Ich habe einen Code</h3>
      <label class="feld-label">Code oder Link<input id="wir-code" class="eingabe code" placeholder="abcd-efgh-jkmn" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" inputmode="text"></label>
      ${kannEinfuegen ? '<button type="button" class="knopf klein" data-aktion="einfuegen">Aus der Zwischenablage einfügen</button>' : ''}
      <label class="feld-label">Dein Name<input id="wir-name-code" class="eingabe" maxlength="30" autocomplete="given-name"></label>
      <button type="button" class="knopf haupt" data-aktion="beitreten-code"${warte}>Beitreten</button>
      <p class="fein">Mit dem Link „Weiteres Gerät“ von deinem anderen Gerät brauchst du keinen Namen.</p>
    </section>`;
  const startKarte = `<section class="einrichten">
      <h3>Gemeinsam planen</h3>
      <p>Starte einen Plan und schick den Link an deine Leute – einzeln oder in eine Gruppe. Du bist dann Gastgeber: Du siehst, worauf alle Bock haben, die anderen nur deine Haken und ihre eigenen.</p>
      <label class="feld-label">Dein Name<input id="wir-name" class="eingabe" maxlength="30" autocomplete="given-name"></label>
      <button type="button" class="knopf haupt" data-aktion="starten"${warte}>${ui.laeuft ? 'Einen Moment …' : 'Plan starten'}</button>
    </section>`;
  // Auf dem iPhone kommt man fast immer mit einem Code hierher – der zuerst.
  return `${fehler}${istApple() ? codeKarte + startKarte : startKarte + codeKarte}
    <p class="fein">Gespeichert werden die Namen und die Haken bei Supabase, im Projekt von Tobi. Herein kommt nur, wer den Code hat – und alles sieht nur, wer den Plan gestartet hat.</p>`;
}

/** Ein Link „Weiteres Gerät“ wartet darauf, übernommen zu werden. */
function zugangKarte(st, ui) {
  const z = zugangLesen(st.zugang);
  if (!z) return '';
  const g = st.gemeinsam;
  const geht = !g || Boolean(g.raus) || (g.code === z.code && (rolle() !== 'gastgeber' || g.ich.id === z.person));
  return `<section class="einrichten" id="zugang-karte">
    <h3>Zugang von deinem anderen Gerät</h3>
    <p>Mit diesem Link bist du hier dieselbe Person wie dort${z.schluessel ? ' – als Gastgeber' : ''}.</p>
    ${geht ? (g && !g.raus && g.ich.id !== z.person ? '<p class="fein">Wer du auf diesem Gerät bisher im Plan warst, vergisst es dabei.</p>' : '')
    : `<p class="fein">Dieses Gerät ist schon in einem Plan${rolle() === 'gastgeber' ? ' – als Gastgeber' : ''}. Verlass ihn hier erst, dann geht es.</p>`}
    ${ui.fehler ? `<div class="fehlerbox" role="alert">${esc(ui.fehler)}</div>` : ''}
    <div class="aktionen">
      ${geht ? `<button type="button" class="knopf haupt" data-aktion="zugang-uebernehmen"${ui.laeuft ? ' disabled' : ''}>Übernehmen</button>` : ''}
      <button type="button" class="knopf" data-aktion="zugang-weg">Nicht jetzt</button>
    </div>
  </section>`;
}

// --- Mit Plan

/** Die belegten Zeiten des Gastgebers stehen im Programm (Ansicht Woche) – hier nur der Verweis. */
function zeitenHinweis(heute) {
  if (!zeitenWochen().some((w) => w >= montag(heute))) return '';
  const { stand } = belegung();
  const standText = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(stand) ? ` (Stand ${wochentagKurz(stand.slice(0, 10))} ${tagMonat(stand.slice(0, 10))}, ${stand.slice(11)} Uhr)` : '';
  const n = esc(gastgeberName() || 'der Gastgeber');
  return `<p class="fein zeiten-hinweis">${rolle() === 'gastgeber' ? 'Deine belegten Zeiten aus dem Kalender' : `Wann ${n} Zeit hat`}${standText}: im <button type="button" class="textknopf" data-reiter="programm" data-kal-wechsel="woche">Programm, Ansicht Woche</button> – und an jeder Karte.</p>`;
}

/**
 * „So funktioniert's“: Eingeladene sehen die Karte nach dem Beitreten, bis
 * sie „Alles klar“ tippen; danach (und für den Gastgeber) über „So geht's“.
 */
function hilfeKarte(st) {
  const gastgeber = rolle() === 'gastgeber';
  const n = esc(gastgeberName() || 'dem Gastgeber');
  const punkte = gastgeber ? [
    `<b>Einladen:</b> Deine Leute bekommen den Link, geben ihren Namen ein und sehen an jedem Termin zwei Knöpfe: „Mit ${n}“ und „Allein/mit anderen“.`,
    '<b>Erklärt:</b> Wer den Link öffnet, bekommt erst eine kurze Einladung und nach dem Beitreten diese Erklärung in seiner Fassung.',
    '<b>Hier unter „Wir“</b> siehst du, was wer will: Zusammen, Wollen mit dir, Ohne dich und pro Person.',
    '<b>Wer sieht was:</b> Alle Haken siehst nur du. Die anderen sehen deine und ihre eigenen, voneinander nichts.',
  ] : [
    '<b>Programm:</b> was in Hamburg und Umgebung los ist, gut einen Monat im Voraus – als Liste, Monat, Woche oder Tag. <b>Karte:</b> dasselbe nach Ort.',
    `<b>Mit ${n}</b> an einem Termin heißt: Das würd ich gern mit dir machen. <b>Allein/mit anderen</b> heißt: Hab ich vor, aber ohne dich. Dieselbe Wahl noch einmal nimmt den Haken weg.`,
    '<b>Ideen:</b> alles ohne festen Termin, von Tischtennis bis Bügelperlen. Auch da kannst du Bock sagen oder dir einen Tag einplanen.',
    `<b>Wir:</b> Hier siehst du, wo ihr beide Bock habt und worauf ${n} Bock hat.`,
    `<b>Wann hat ${n} Zeit?</b> An jedem Termin steht es dabei, und in den Ansichten Woche und Tag sind belegte Zeiten grau – ohne zu verraten, was ${n} da macht.`,
    `<b>Wer sieht was:</b> Deine Haken sieht nur ${n}. Die anderen Eingeladenen sehen nichts von dir – und du nichts von ihnen.`,
    ...(alsApp() ? [] : [istApple()
      ? '<b>Als App aufs iPhone:</b> Teilen → „Zum Home-Bildschirm“. Die App dort kennt diesen Plan nicht – tipp vorher unter „Wir“ auf „Weiteres Gerät“, kopier den Link und füg ihn in der App unter „Ich habe einen Code“ ein.'
      : '<b>Als App:</b> im Browser-Menü „App installieren“ bzw. „Zum Startbildschirm“ – dann ist Freizeit ein Symbol wie jede andere App.']),
  ];
  return `<section class="einrichten hilfe" id="hilfe-karte">
    <h3>${gastgeber ? 'So funktioniert\'s für deine Leute' : 'So funktioniert\'s'}</h3>
    <ul class="hilfe-liste">${punkte.map((x) => `<li>${x}</li>`).join('')}</ul>
    <div class="aktionen"><button type="button" class="knopf haupt" data-aktion="hilfe-weg">Alles klar</button></div>
  </section>`;
}

/** Aus dem Plan gefallen: herausgenommen, aufgelöst oder ohne Schlüssel. */
function rausKarte(st, ui) {
  const g = st.gemeinsam;
  const name = esc(gastgeberName() || 'Der Gastgeber');
  const [titel, text] = {
    aufgeloest: ['Der Plan ist aufgelöst', rolle() === 'gastgeber'
      ? 'Du hast den Plan auf einem anderen Gerät aufgelöst.'
      : `${name} hat den gemeinsamen Plan aufgelöst.`],
    weg: ['Du bist nicht mehr dabei', `Du bist nicht mehr im Plan von ${name} – herausgenommen, oder auf einem anderen Gerät gegangen.`],
    schluessel: ['Hier fehlt dein Schlüssel', 'Du bist Gastgeber dieses Plans, aber auf diesem Gerät fehlt dein Schlüssel. Öffne auf dem Gerät, auf dem du den Plan gestartet hast, unter „Wir“ → „Weiteres Gerät“ den Link – dann hier.'],
  }[g.raus] || ['Nicht mehr im Plan', ''];
  return `<section class="einrichten" id="raus-karte">
    <h3>${esc(titel)}</h3>
    <p>${text} Deine Haken bleiben hier auf dem Gerät.</p>
    ${ui.fehler ? `<div class="fehlerbox" role="alert">${esc(ui.fehler)}</div>` : ''}
    <div class="aktionen">
      ${g.raus === 'weg' ? `<button type="button" class="knopf haupt" data-aktion="wieder-beitreten"${ui.laeuft ? ' disabled' : ''}>Wieder beitreten</button>` : ''}
      <button type="button" class="knopf" data-aktion="vergessen">Plan vergessen</button>
    </div>
  </section>`;
}

function kopf(st, ui) {
  const g = st.gemeinsam;
  const gastgeber = rolle() === 'gastgeber';
  const name = gastgeberName();
  const s = syncStatus();
  const leute = g.stand.personen.length ? g.stand.personen : [g.ich];
  const andereLeute = leute.filter((x) => x.id !== g.ich.id);
  const chips = leute.map((x, i) => {
    const ich = x.id === g.ich.id;
    return `<span class="person ${ich ? 'ich' : `p${i % 4}`}">${esc(x.name)}${ich ? ' (du)' : ''}</span>`;
  }).join('');
  const zeit = s.zuletzt ? new Date(s.zuletzt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '';
  const warten = st.warteschlange.length;
  const zeile = [
    s.laeuft ? 'gleicht ab …' : (zeit ? `abgeglichen ${zeit} Uhr` : ''),
    s.offline ? 'gerade offline' : '',
    warten ? `${anzahl(warten, 'Änderung wartet', 'Änderungen warten')}` : '',
  ].filter(Boolean).join(' · ');
  const wer = gastgeber
    ? `Du bist Gastgeber${andereLeute.length ? ` – ${anzahl(andereLeute.length, 'Person', 'Leute')} dabei` : ''}. Alle Haken siehst nur du.`
    : `Du planst mit ${esc(name || 'dem Gastgeber')}: Ihr seht gegenseitig eure Haken – sonst niemand.`;
  const link = einladungsLink(g.code);
  const waText = einladungsText(g.ich.name, link, g.code);
  const knopf = (aktion, text, offen, klasse = 'knopf') => `<button type="button" class="${klasse}" data-aktion="${aktion}" aria-expanded="${Boolean(offen)}">${text}</button>`;
  // Ein Knopf vorn, der Rest im Menü „Mehr“.
  const menue = `<details class="menue">
      <summary class="knopf" aria-label="Mehr">Mehr</summary>
      <div class="menue-liste">
        <button type="button" data-aktion="abgleichen">Jetzt abgleichen</button>
        ${gastgeber ? knopf('hilfe', 'So geht\'s', ui.hilfe, '') : ''}
        ${knopf('umbenennen', 'Name ändern', ui.umbenennen, '')}
        ${knopf('geraet', 'Weiteres Gerät', ui.geraet, '')}
        ${knopf('verlassen', gastgeber ? 'Plan auflösen' : 'Plan verlassen', ui.verlassen, 'warn-text')}
      </div>
    </details>`;
  return `<header class="woche-kopf">
    <h2 class="abschnitt-titel">Wir</h2>
    <p class="fein">${wer}</p>
    <div class="leute">${chips}</div>
    <div class="fein syncstatus">${[zeile ? esc(zeile) : '', s.fehler ? `<span class="warn-text">${esc(s.fehler)}</span>` : ''].filter(Boolean).join(' · ')}</div>
    ${ui.fehler ? `<div class="fehlerbox" role="alert">${esc(ui.fehler)}</div>` : ''}
    <div class="aktionen">
      ${gastgeber ? knopf('einladen', 'Einladen', ui.einladen, 'knopf haupt') : knopf('hilfe', 'So geht\'s', ui.hilfe)}
      ${menue}
    </div>
    ${gastgeber ? pushZeile() : ''}
    ${gastgeber && ui.einladen ? `<div class="einladung">
      <p>Schick diesen Link an deine Leute – einzeln oder in eine Gruppe. Jeder gibt seinen Namen ein und hakt an, worauf er Bock hat: mit dir oder allein/mit anderen.</p>
      <input class="eingabe" id="einladungslink" readonly value="${esc(link)}">
      <div class="aktionen">
        <a class="knopf haupt" href="https://wa.me/?text=${esc(encodeURIComponent(waText))}" target="_blank" rel="noopener">Per WhatsApp schicken</a>
        <button type="button" class="knopf" data-aktion="code-kopieren" data-code="${esc(waText)}" data-feld="#einladungstext">Text kopieren</button>
        <button type="button" class="knopf" data-aktion="code-kopieren" data-code="${esc(link)}" data-feld="#einladungslink">Nur Link</button>
      </div>
      <details class="einladung-text"><summary class="fein">Diesen Text schickt WhatsApp mit</summary>
        <textarea class="eingabe" id="einladungstext" readonly rows="9">${esc(waText)}</textarea>
      </details>
      <p class="fein">Code zum Abschreiben: <code class="code">${esc(g.code)}</code> – wer ihn hat, kann eintreten. Alle Haken siehst trotzdem nur du.</p>
    </div>` : ''}
    ${ui.umbenennen ? `<div class="einladung">
      <label class="feld-label">Dein Name<input id="wir-neuname" class="eingabe" maxlength="30" value="${esc(g.ich.name)}"></label>
      <button type="button" class="knopf haupt" data-aktion="name-speichern">Speichern</button>
    </div>` : ''}
    ${ui.geraet ? `<div class="einladung">
      <p>Öffne diesen Link auf deinem anderen Gerät – oder füg ihn dort in der App unter „Wir“ bei „Ich habe einen Code“ ein. Dann bist du dort dieselbe Person${gastgeber ? ', auch als Gastgeber' : ''}.</p>
      <input class="eingabe" id="geraetlink" readonly value="${esc(zugangsLink(g))}">
      <div class="aktionen"><button type="button" class="knopf" data-aktion="code-kopieren" data-code="${esc(zugangsLink(g))}" data-feld="#geraetlink">Link kopieren</button></div>
      <p class="fein warn-text">Nur für dich: Wer diesen Link hat, ist im Plan du${gastgeber ? ' – und sieht alle Haken' : ''}.</p>
    </div>` : ''}
    ${ui.verlassen ? `<div class="einladung">
      <p>${gastgeber
    ? `Wirklich auflösen? Der Plan ist dann für alle weg${andereLeute.length ? ` – ${anzahl(andereLeute.length, 'Person', 'Leute')} mit allen ihren Haken` : ''}. Deine eigenen Haken bleiben hier auf dem Gerät.`
    : 'Wirklich verlassen? Deine Haken verschwinden dann für die anderen; hier auf dem Gerät bleiben sie.'}</p>
      <button type="button" class="knopf warnknopf" data-aktion="verlassen-ja">${gastgeber ? 'Ja, auflösen' : 'Ja, verlassen'}</button>
      <button type="button" class="knopf" data-aktion="verlassen">Abbrechen</button>
    </div>` : ''}
  </header>
  ${gastgeber && !andereLeute.length && !ui.einladen ? '<div class="banner">Noch ist niemand dabei. Tipp auf „Einladen“ und schick den Link an deine Leute.</div>' : ''}`;
}

/**
 * Push für den Gastgeber (push.js): an, ausschaltbar – oder der Knopf zum
 * Anschalten. Steht etwas im Weg, steht das da statt des Knopfs; ein
 * Browser, der es gar nicht kann, bekommt keine Zeile.
 */
function pushZeile() {
  if (pushAn()) {
    return `<div class="push-zeile fein" data-push="an">🔔 Du bekommst Bescheid, wenn jemand dazukommt oder anhakt.
      <button type="button" class="textknopf" data-aktion="push-aus">Ausschalten</button></div>`;
  }
  const h = pushHindernis();
  if (h.grund === 'browser') return '';
  if (h.grund) return `<div class="push-zeile fein" data-push="${esc(h.grund)}">🔔 ${esc(h.text)}</div>`;
  return `<div class="push-zeile" data-push="aus">
      <button type="button" class="knopf" data-aktion="push-an">🔔 Bescheid sagen</button>
      <span class="fein">wenn jemand dazukommt oder anhakt – auch bei geschlossener App</span></div>`;
}

/** Je Person: wie viel mit dir, wie viel ohne dich, die Liste – und herausnehmen. */
function proPerson(st, nachSchluessel, heute, ui) {
  const g = st.gemeinsam;
  const leute = g.stand.personen.filter((x) => x.id !== g.ich.id);
  if (!leute.length) return '';
  const zeilen = leute.map((x) => {
    const p = person(x.id);
    const haken = hakenDerAnderen().filter((b) => b.person === x.id)
      .map((b) => ({ e: nachSchluessel.get(b.eintrag), wie: mitWem(b.daten) }))
      .filter((h) => h.e && !vorbei(h.e, heute));
    const reihe = sortiert(haken.map((h) => h.e));
    const wie = new Map(haken.map((h) => [h.e.schluessel, h.wie]));
    const mit = haken.filter((h) => h.wie === 'gastgeber').length;
    const zahlen = haken.length ? `${mit} mit dir · ${haken.length - mit} ohne dich` : 'noch nichts angehakt';
    const liste = reihe.length ? `<ul class="person-liste">${reihe.map((e) => `<li><span class="wann">${esc(wannKurz(e))}</span><span class="was">${esc(e.titel)}</span><span class="marke ${wie.get(e.schluessel) === 'gastgeber' ? 'mit-dir' : 'rand'}">${wie.get(e.schluessel) === 'gastgeber' ? 'mit dir' : 'ohne dich'}</span></li>`).join('')}</ul>` : '';
    const frage = ui.entfernen === x.id ? `<div class="einladung">
        <p>${esc(x.name)} aus dem Plan nehmen? Die Haken sind dann für dich weg. Über den Link kann ${esc(x.name)} wieder beitreten.</p>
        <div class="aktionen"><button type="button" class="knopf warnknopf" data-aktion="entfernen-ja" data-person="${esc(x.id)}">Ja, herausnehmen</button>
        <button type="button" class="knopf" data-aktion="entfernen" data-person="${esc(x.id)}">Abbrechen</button></div>
      </div>` : '';
    const auf = (ui.offen && ui.offen.has(`person:${x.id}`)) || ui.entfernen === x.id;
    return `<details class="person-zeile" data-offen="person:${esc(x.id)}"${auf ? ' open' : ''}>
      <summary><span class="person p${p ? p.nr % 4 : 0}">${esc(x.name)}</span><span class="fein">${zahlen}</span></summary>
      ${liste}
      <div class="aktionen"><button type="button" class="textknopf" data-aktion="entfernen" data-person="${esc(x.id)}" aria-expanded="${ui.entfernen === x.id}">Aus dem Plan nehmen</button></div>
      ${frage}
    </details>`;
  }).join('');
  return abschnitt('wir-personen', 'Pro Person', 'Was jeder angehakt hat, noch einmal einzeln.', zeilen);
}

function gastgeberUeberblick(alle, st, heute, ui) {
  const offen = alle.filter((e) => !vorbei(e, heute)).map((e) => {
    const sie = andere(e.schluessel);
    return { e, ich: meinBock(e.schluessel), mit: sie.filter((x) => x.mitwem === 'gastgeber'), ohne: sie.filter((x) => x.mitwem === 'andere') };
  });
  const zahl = new Map(offen.map((i) => [i.e.schluessel, i.mit.length + i.ohne.length]));
  const wieViele = (e) => zahl.get(e.schluessel) || 0;
  const zusammen = sortiert(offen.filter((i) => i.ich && i.mit.length).map((i) => i.e), wieViele);
  const wollen = sortiert(offen.filter((i) => !i.ich && i.mit.length).map((i) => i.e), wieViele);
  const ohne = sortiert(offen.filter((i) => !i.ich && !i.mit.length && i.ohne.length).map((i) => i.e), wieViele);
  const deine = offen.filter((i) => i.ich && !i.mit.length);
  const deineTermine = sortiert(deine.filter((i) => i.e.quelle !== 'idee').map((i) => i.e));
  const leute = st.gemeinsam.stand.personen.length - 1;
  const nichts = leute > 0 && !zusammen.length && !wollen.length && !ohne.length
    ? '<div class="leer-klein">Noch hat keiner etwas angehakt. Sobald jemand Bock auf etwas hat, steht es hier.</div>' : '';
  return `${nichts}
    ${zusammen.length ? abschnitt('wir-zusammen', 'Zusammen', 'Hier wollt ihr zusammen hin – du und wer mit dir will.', karten(zusammen)) : ''}
    ${wollen.length ? abschnitt('wir-mit-dir', 'Wollen mit dir', 'Jemand will das mit dir machen. Tipp auf „Bock“, wenn du auch willst.', karten(wollen)) : ''}
    ${ohne.length ? abschnitt('wir-ohne-dich', 'Ohne dich', 'Was deine Leute allein oder mit anderen vorhaben.', karten(ohne)) : ''}
    ${proPerson(st, new Map(alle.map((e) => [e.schluessel, e])), heute, ui)}
    ${abschnitt('wir-deine', 'Deine Haken', deineTermine.length ? 'Worauf du Bock hast und noch keiner mit dir.' : '',
    `${deineTermine.length ? karten(deineTermine) : '<div class="leer-klein">Was du anhakst und noch keiner mit dir will, steht hier.</div>'}
      ${ideenZeile(deine.length - deineTermine.length)}`)}`;
}

function mitgliedAnsicht(alle, st, heute) {
  const name = gastgeberName() || 'dem Gastgeber';
  const offen = alle.filter((e) => !vorbei(e, heute)).map((e) => ({
    e, ich: meinBock(e.schluessel), wie: mitWem(st.bock[e.schluessel]), er: andere(e.schluessel).length > 0,
  }));
  const zusammen = sortiert(offen.filter((i) => i.ich && i.wie === 'gastgeber' && i.er).map((i) => i.e));
  const seine = sortiert(offen.filter((i) => !i.ich && i.er).map((i) => i.e));
  const deine = offen.filter((i) => i.ich && !(i.wie === 'gastgeber' && i.er));
  const deineTermine = sortiert(deine.filter((i) => i.e.quelle !== 'idee').map((i) => i.e));
  const n = esc(name);
  return `${zusammen.length ? abschnitt('wir-zusammen', `Du und ${name}`, 'Hier wollt ihr beide hin.', karten(zusammen)) : ''}
    ${seine.length ? abschnitt('wir-seine', `${name} hat Bock auf`, `Tipp auf „Mit ${n}“, wenn du dabei bist – oder auf „Allein/mit anderen“.`, karten(seine)) : ''}
    ${abschnitt('wir-deine', 'Deine Haken', deineTermine.length ? `Mit ${n} oder allein/mit anderen – wie du es angetippt hast.` : '',
    `${deineTermine.length ? karten(deineTermine) : `<div class="leer-klein">Noch keine Haken. Tippe bei einem Termin auf „Mit ${n}“ oder „Allein/mit anderen“.</div>`}
      ${ideenZeile(deine.length - deineTermine.length)}`)}`;
}

export function wirAnsicht(p, ideen, st, heute, ui = {}) {
  const alle = eintraegeMitHaken(p, ideen, st);
  const eigene = alle.filter((e) => meinBock(e.schluessel));
  const alt = sortiert(eigene.filter((e) => e.quelle !== 'idee' && vorbei(e, heute)));
  const zugang = st.zugang ? zugangKarte(st, ui) : '';
  const g = st.gemeinsam;

  if (!g || g.raus) {
    const kommend = sortiert(eigene.filter((e) => e.quelle !== 'idee' && !vorbei(e, heute)));
    const ideenZahl = eigene.filter((e) => e.quelle === 'idee').length;
    // Wer gerade eingeladen ist, soll erst einmal nur eintreten.
    const eingeladen = !g && Boolean(st.einladung);
    return `<header class="woche-kopf"><h2 class="abschnitt-titel">Wir</h2>
      ${g || eingeladen ? '' : '<p class="fein">Lade deine Leute ein: Jeder hakt an, worauf er Bock hat – mit dir oder allein/mit anderen. Du siehst alles, die anderen deine Haken und ihre eigenen.</p>'}</header>
      ${zugang}
      ${g ? rausKarte(st, ui) : einrichten(st, ui)}
      ${eingeladen && !kommend.length && !ideenZahl ? '' : abschnitt('wir-deine', 'Deine Bock-Liste', '', `${kommend.length ? karten(kommend) : '<div class="leer-klein">Noch keine Haken. Tippe bei einem Termin auf „Bock“.</div>'}
        ${ideenZeile(ideenZahl)}`)}
      ${vorbeiListe(alt, ui)}`;
  }

  const hilfe = ui.hilfe || (rolle() === 'mitglied' && !st.hilfeWeg) ? hilfeKarte(st) : '';
  return `${kopf(st, ui)}
    ${zugang}
    ${hilfe}
    ${zeitenHinweis(heute)}
    ${rolle() === 'gastgeber' ? gastgeberUeberblick(alle, st, heute, ui) : mitgliedAnsicht(alle, st, heute)}
    ${vorbeiListe(alt, ui)}`;
}

export { person };
