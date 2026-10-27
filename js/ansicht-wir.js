/*
 * Reiter „Wir“: die Bock-Haken – eigene und die der anderen im gemeinsamen
 * Plan – und das Einrichten des Plans.
 *
 * Ohne Plan ist das die eigene Bock-Liste (wie früher die Merkliste). Mit Plan
 * stehen oben die Treffer (ihr beide habt Bock), darunter alles nach Datum,
 * mit farbigen Namen. Ein Haken trägt einen Schnappschuss seines Eintrags mit
 * sich; fällt der Eintrag aus den Daten (vorbei, neuer Montagslauf), steht er
 * trotzdem vollständig da.
 *
 * Einladen: Der Link trägt den Code hinter # (#einladung=…). Auf dem iPhone
 * hat die App auf dem Home-Bildschirm einen eigenen Speicher, getrennt von
 * Safari – deshalb steht dort der Code zum Abschreiben bzw. Einfügen.
 */
import { esc, anzahl, sichererLink } from './text.js';
import { karte, alleEintraege, wannKurz } from './karte.js';
import { meinBock } from './speicher.js';
import { andere, hakenDerAnderen, syncStatus, einladungsLink, person } from './gemeinsam.js';
import { istApple } from './teilen.js';
import { planAusSchnappschuss, ideeAusSchnappschuss } from './ideen.js';

/** Läuft die App vom Home-Bildschirm (und nicht im Browser)? */
export const alsApp = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

/** Wann ist ein Eintrag vorbei? Termine am Tag danach, Laufendes nach dem letzten Tag. */
export const vorbei = (e, heute) => (e.datum ? e.datum < heute : Boolean(e.bis) && e.bis < heute);

const sortiert = (liste) => [...liste].sort((a, b) => {
  const s = (e) => `${e.datum || e.von || '9999'} ${String(e.zeit || '').match(/\d{1,2}:\d{2}/)?.[0].padStart(5, '0') || '99:99'}`;
  return s(a).localeCompare(s(b));
});

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

function iPhoneSchritte(code) {
  return `<ol class="schritte">
    <li>Unten auf <b>Teilen</b> tippen (Quadrat mit Pfeil) und <b>„Zum Home-Bildschirm“</b> wählen.</li>
    <li>Die App <b>Freizeit</b> vom Home-Bildschirm öffnen.</li>
    <li>Dort unter <b>Wir</b> diesen Code einfügen: <code class="code">${esc(code)}</code>
      <button type="button" class="knopf klein" data-aktion="code-kopieren" data-code="${esc(code)}">Code kopieren</button></li>
  </ol>
  <p class="fein">Warum zweimal? Das iPhone trennt die App auf dem Home-Bildschirm von Safari – sie kennt den Link nicht.</p>`;
}

function einrichten(st, ui) {
  const kannEinfuegen = Boolean(navigator.clipboard && navigator.clipboard.readText);
  const fehler = ui.fehler ? `<div class="fehlerbox" role="alert">${esc(ui.fehler)}</div>` : '';
  const warte = ui.laeuft ? ' disabled' : '';
  if (st.einladung) {
    const imBrowserAufIPhone = istApple() && !alsApp();
    return `<section class="einrichten">
      <h3>Du bist eingeladen</h3>
      <p>Ihr plant zusammen: Hakt an, worauf ihr Bock habt – die anderen sehen es.</p>
      ${imBrowserAufIPhone ? `<h4>Erst auf den Home-Bildschirm</h4>${iPhoneSchritte(st.einladung)}<h4>Oder gleich hier im Browser</h4>` : ''}
      <label class="feld-label">Dein Name<input id="wir-name" class="eingabe" maxlength="30" autocomplete="given-name" enterkeyhint="go"></label>
      ${fehler}
      <button type="button" class="knopf haupt" data-aktion="beitreten"${warte}>${ui.laeuft ? 'Einen Moment …' : 'Beitreten'}</button>
      <p class="fein">Code: <code class="code">${esc(st.einladung)}</code></p>
    </section>`;
  }
  const codeKarte = `<section class="einrichten">
      <h3>Ich habe einen Code</h3>
      <label class="feld-label">Code<input id="wir-code" class="eingabe code" placeholder="abcd-efgh-jkmn" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" inputmode="text"></label>
      ${kannEinfuegen ? '<button type="button" class="knopf klein" data-aktion="einfuegen">Aus der Zwischenablage einfügen</button>' : ''}
      <label class="feld-label">Dein Name<input id="wir-name-code" class="eingabe" maxlength="30" autocomplete="given-name"></label>
      <button type="button" class="knopf haupt" data-aktion="beitreten-code"${warte}>Beitreten</button>
    </section>`;
  const startKarte = `<section class="einrichten">
      <h3>Gemeinsam planen</h3>
      <p>Starte einen gemeinsamen Plan und schick den Link per WhatsApp. Ihr seht dann gegenseitig, worauf ihr Bock habt.</p>
      <label class="feld-label">Dein Name<input id="wir-name" class="eingabe" maxlength="30" autocomplete="given-name"></label>
      <button type="button" class="knopf haupt" data-aktion="starten"${warte}>${ui.laeuft ? 'Einen Moment …' : 'Plan starten'}</button>
    </section>`;
  // Auf dem iPhone kommt man fast immer mit einem Code hierher – der zuerst.
  return `${fehler}${istApple() ? codeKarte + startKarte : startKarte + codeKarte}
    <p class="fein">Gespeichert werden die Namen und die Haken bei Supabase, im Projekt von Tobi. Sehen kann sie nur, wer den Code hat.</p>`;
}

function kopf(st, ui) {
  const g = st.gemeinsam;
  const s = syncStatus();
  const leute = g.stand.personen.length ? g.stand.personen : [g.ich];
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
  const link = einladungsLink(g.code);
  const waText = `Lass uns zusammen planen, was wir unternehmen! Öffne den Link: ${link}\n\nAuf dem iPhone: in Safari öffnen → Teilen → „Zum Home-Bildschirm“, dann in der App unter „Wir“ den Code eingeben: ${g.code}`;
  return `<header class="woche-kopf">
    <h2 class="abschnitt-titel">Wir</h2>
    <div class="leute">${chips}</div>
    <div class="fein syncstatus">${esc(zeile)}${s.fehler ? ` · <span class="warn-text">${esc(s.fehler)}</span>` : ''}</div>
    ${ui.fehler ? `<div class="fehlerbox" role="alert">${esc(ui.fehler)}</div>` : ''}
    <div class="aktionen">
      <button type="button" class="knopf" data-aktion="einladen" aria-expanded="${Boolean(ui.einladen)}">Einladen</button>
      <button type="button" class="knopf" data-aktion="abgleichen">Jetzt abgleichen</button>
      <button type="button" class="knopf" data-aktion="umbenennen" aria-expanded="${Boolean(ui.umbenennen)}">Name ändern</button>
      <button type="button" class="knopf" data-aktion="verlassen" aria-expanded="${Boolean(ui.verlassen)}">Verlassen</button>
    </div>
    ${ui.einladen ? `<div class="einladung">
      <p>Schick diesen Link an deine Begleitung:</p>
      <input class="eingabe" id="einladungslink" readonly value="${esc(link)}">
      <div class="aktionen">
        <a class="knopf haupt" href="https://wa.me/?text=${esc(encodeURIComponent(waText))}" target="_blank" rel="noopener">Per WhatsApp schicken</a>
        <button type="button" class="knopf" data-aktion="code-kopieren" data-code="${esc(link)}">Link kopieren</button>
      </div>
      <p class="fein">Code zum Abschreiben: <code class="code">${esc(g.code)}</code> – wer ihn hat, sieht und setzt eure Haken.</p>
    </div>` : ''}
    ${ui.umbenennen ? `<div class="einladung">
      <label class="feld-label">Dein Name<input id="wir-neuname" class="eingabe" maxlength="30" value="${esc(g.ich.name)}"></label>
      <button type="button" class="knopf haupt" data-aktion="name-speichern">Speichern</button>
    </div>` : ''}
    ${ui.verlassen ? `<div class="einladung">
      <p>Wirklich verlassen? Deine Haken verschwinden dann für die anderen; hier auf dem Gerät bleiben sie.</p>
      <button type="button" class="knopf warnknopf" data-aktion="verlassen-ja">Ja, verlassen</button>
      <button type="button" class="knopf" data-aktion="verlassen">Abbrechen</button>
    </div>` : ''}
  </header>
  ${g.stand.personen.length <= 1 ? '<div class="banner">Noch bist du allein in diesem Plan. Tipp auf „Einladen“ und schick den Link.</div>' : ''}`;
}

export function wirAnsicht(p, ideen, st, heute, ui = {}) {
  const alle = eintraegeMitHaken(p, ideen, st);
  // Ideen haben kein Datum – sie stehen im Reiter Ideen unter „Wollen wir mal“.
  const ideenMitHaken = alle.filter((e) => e.quelle === 'idee');
  const datiert = alle.filter((e) => e.quelle !== 'idee');
  const kommend = sortiert(datiert.filter((e) => !vorbei(e, heute)));
  const alt = sortiert(datiert.filter((e) => vorbei(e, heute)));
  const karten = (es) => es.map((e) => karte(e, { zeitSpalte: true, zeitText: wannKurz(e) })).join('');
  const ideenZeile = ideenMitHaken.length
    ? `<p class="fein">Außerdem ${anzahl(ideenMitHaken.length, 'Idee', 'Ideen')} mit Bock – im Reiter <button type="button" class="textknopf" data-reiter="ideen">Ideen</button> unter „Wollen wir mal“.</p>` : '';

  if (!st.gemeinsam) {
    return `<header class="woche-kopf"><h2 class="abschnitt-titel">Wir</h2>
      <p class="fein">Teile deine Bock-Haken mit deiner Begleitung: Ihr seht gegenseitig, worauf ihr Bock habt – und wo ihr beide wollt.</p></header>
      ${einrichten(st, ui)}
      <section class="abschnitt"><h2 class="abschnitt-titel">Deine Bock-Liste</h2>
        ${kommend.length ? karten(kommend) : '<div class="leer-klein">Noch keine Haken. Tippe bei einem Termin auf „Bock“.</div>'}
        ${ideenZeile}
      </section>
      ${alt.length ? `<section class="abschnitt vorbei-liste"><div class="zeile"><h2 class="monat">Vorbei</h2><button type="button" class="knopf" data-aktion="vorbei-weg">Vorbei entfernen</button></div>${karten(alt)}</section>` : ''}`;
  }

  const treffer = [...kommend, ...ideenMitHaken].filter((e) => meinBock(e.schluessel) && andere(e.schluessel).length);
  const g = st.gemeinsam;
  const andereNamen = g.stand.personen.filter((x) => x.id !== g.ich.id).map((x) => x.name);
  return `${kopf(st, ui)}
    ${treffer.length ? `<section class="abschnitt"><h2 class="abschnitt-titel">Ihr habt beide Bock</h2>${karten(treffer)}</section>` : ''}
    <section class="abschnitt">
      <h2 class="abschnitt-titel">Alle Haken</h2>
      ${kommend.length ? `<p class="fein">${anzahl(kommend.length, 'Eintrag', 'Einträge')} vor euch. Farbig: wer außer dir Bock hat.</p>${karten(kommend)}`
    : `<div class="leer-klein">Noch keine Haken. Tippe bei einem Termin auf „Bock“${andereNamen.length ? ` – ${esc(andereNamen.join(' und '))} ${andereNamen.length === 1 ? 'sieht' : 'sehen'} es dann` : ''}.</div>`}
      ${ideenZeile}
    </section>
    ${alt.length ? `<details class="abschnitt vorbei-liste"><summary class="monat">Vorbei (${alt.length})</summary>
      <div class="zeile"><span class="fein">Deine eigenen vergangenen Haken lassen sich wegräumen.</span><button type="button" class="knopf" data-aktion="vorbei-weg">Vorbei entfernen</button></div>
      ${karten(alt)}</details>` : ''}`;
}

export { person };
