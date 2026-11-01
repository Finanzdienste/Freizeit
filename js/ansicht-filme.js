/*
 * IMDb Top 250 – eine eigene Seite im Programm, erreichbar unten bei „Was
 * immer geht“ (die Tür) und über #filme. Oben zurück, Suche (Titel, Original,
 * Regie, Jahr, Genre), Auswahl (Alle · Mit Bock · was die anderen wollen) und
 * Genre; darunter die Filme nach Platz. Zugeklappt: Platz, Titel, Original,
 * Jahr, Länge, Genre, wer Bock hat und der Bock-Knopf; aufgeklappt die
 * Beschreibung, Regie und der Link zu IMDb.
 *
 * Beim Tippen in die Suche wird nur die Liste neu gezeichnet (filmListeNeu),
 * damit das Feld den Fokus behält.
 */
import { esc } from './text.js';
import {
  kopfzeile, werZeile, bockKnopf, istAuf, merkeEintrag,
} from './karte.js';
import { meinBock } from './speicher.js';
import { andere, rolle, gastgeberName } from './gemeinsam.js';
import {
  laengeText, genres, filmeFiltern, filmeZahl,
} from './filme.js';

const datumText = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? `${Number(iso.slice(8))}.${Number(iso.slice(5, 7))}.${iso.slice(0, 4)}` : '');
const andereBock = (k) => andere(k).length > 0;

/** Anker eines Films – für Sprünge aus „Wir“. */
export const filmAnker = (schluessel) => `film-${schluessel.replace(/[^a-z0-9-]/gi, '-')}`;

function filmKarte(f) {
  merkeEintrag(f);
  const wer = werZeile(f);
  const unter = [f.original, String(f.jahr), laengeText(f.laenge), f.genre.join(', ')].filter(Boolean).join(' · ');
  const klassen = ['karte', 'film', istAuf(f.schluessel) ? 'auf' : '', wer.treffer ? 'treffer' : ''].filter(Boolean).join(' ');
  return `<article class="${klassen}" id="${filmAnker(f.schluessel)}">
    <div class="film-platz${f.platz <= 10 ? ' top' : ''}"><span class="sr">Platz </span>${f.platz}</div>
    <div class="inhalt">
      ${kopfzeile(f)}
      <div class="unter">${esc(unter)}</div>
      ${wer.html}
      <div class="mehr">
        ${f.beschreibung ? `<p>${esc(f.beschreibung)}</p>` : ''}
        ${f.regie ? `<div class="film-regie">Regie: ${esc(f.regie)}</div>` : ''}
      </div>
      <div class="aktionen">
        ${bockKnopf(f)}
        <a class="quelle mehr" href="${esc(f.link)}" target="_blank" rel="noopener">Bei IMDb ansehen</a>
      </div>
    </div>
  </article>`;
}

/** Die gefilterte Liste und ihr Zähler – auch für das Neuzeichnen beim Tippen. */
export function filmListeNeu(filme, ui) {
  const liste = filmeFiltern(filme, ui, meinBock, andereBock);
  const zahl = liste.length === filme.length ? filmeZahl(liste.length) : `${filmeZahl(liste.length)} von ${filme.length}`;
  const html = liste.length
    ? liste.map(filmKarte).join('')
    : '<div class="leer-klein">Kein Film passt. <button type="button" class="textknopf" data-aktion="filme-alle">Alle zeigen</button></div>';
  return { html, zahl };
}

/** Die Tür unten bei „Was immer geht“. */
export function filmeTuer(filme) {
  if (!filme.length) return '';
  const meine = filme.filter((f) => meinBock(f.schluessel)).length;
  const fremde = filme.filter((f) => andereBock(f.schluessel)).length;
  const wer = rolle() === 'mitglied' ? (gastgeberName() || 'Der Gastgeber') : 'Deine Leute';
  const bock = [meine ? `${meine} mit deinem Bock` : '', fremde ? `${fremde}× will ${rolle() === 'mitglied' ? esc(wer) : 'wer mit dir'}` : ''].filter(Boolean).join(' · ');
  return `<button type="button" class="filme-tuer" data-aktion="filme-auf">
    <span class="ft-zahl" aria-hidden="true">${filme.length}</span>
    <span class="ft-text">
      <span class="ft-titel">IMDb Top 250</span>
      <span class="ft-unter">${esc(filme.slice(0, 3).map((f) => f.titel).join(', '))} …</span>
      <span class="ft-bock">${bock || 'Sag Bock, welche ihr zusammen gucken wollt'}</span>
    </span>
    <span class="ft-pfeil" aria-hidden="true">›</span>
  </button>`;
}

/**
 * Die Seite.
 * @param {object[]} filme  Einträge aus filme.js (filmEintraege)
 * @param {object} info     { stand, quelle }
 * @param {object} ui       { suche, genre, nur }
 */
export function filmeAnsicht(filme, info, st, ui) {
  const zurueck = '<button type="button" class="pfeil" data-aktion="filme-zu" aria-label="Zurück zum Programm">‹</button>';
  if (!filme.length) {
    return `<section class="filme-seite"><header class="filme-kopf">${zurueck}<h2 id="filme-titel">IMDb Top 250</h2></header>
      <div class="leer"><p>Die Filmliste ließ sich nicht laden. Ohne Netz zeigt die App sie erst, wenn sie einmal geladen war.</p></div></section>`;
  }
  const imPlan = Boolean(st.gemeinsam && !st.gemeinsam.raus);
  const mitglied = imPlan && rolle() === 'mitglied';
  const g = gastgeberName() || 'Gastgeber';
  const nBock = filme.filter((f) => meinBock(f.schluessel)).length;
  const nAndere = filme.filter((f) => andereBock(f.schluessel)).length;
  const optionen = [['alle', 'Alle'], ['bock', `Mit Bock${nBock ? ` ${nBock}` : ''}`]];
  if (imPlan) optionen.push(['andere', mitglied ? `${g} will${nAndere ? ` ${nAndere}` : ''}` : `Mit dir${nAndere ? ` ${nAndere}` : ''}`]);
  const nur = optionen.some(([k]) => k === ui.nur) ? ui.nur : 'alle';
  const hinweis = mitglied
    ? `Tipp bei einem Film auf „Mit ${esc(g)} gucken“, wenn du ihn mit ${esc(g)} sehen willst.`
    : (imPlan ? 'Deine Leute sagen hier, welche Filme sie mit dir gucken wollen – unter „Mit dir“.' : 'Sag Bock bei den Filmen, die du sehen willst.');
  const { html, zahl } = filmListeNeu(filme, { ...ui, nur });
  return `<section class="filme-seite" aria-labelledby="filme-titel">
    <header class="filme-kopf">
      ${zurueck}
      <div class="filme-titelblock">
        <h2 id="filme-titel">IMDb Top 250</h2>
        <p class="fein">${info.stand ? `Stand ${datumText(info.stand)}` : 'Die besten Filme laut IMDb'} · Bilder über den Link zu IMDb</p>
      </div>
    </header>
    <p class="fein filme-hinweis">${hinweis}</p>
    <div class="filme-werkzeug">
      <input type="search" id="filme-suche" class="eingabe" placeholder="Titel, Regie, Jahr oder Genre" value="${esc(ui.suche || '')}" aria-label="Filme durchsuchen" enterkeyhint="search" autocomplete="off">
      <div class="filme-zeile">
        <div class="segmente" role="group" aria-label="Auswahl">${optionen.map(([k, t]) => `<button type="button" class="segment" data-aktion="filme-nur" data-wert="${k}" aria-pressed="${nur === k}">${esc(t)}</button>`).join('')}</div>
        <select id="filme-genre" class="filme-genre" aria-label="Genre"><option value="">Alle Genres</option>${genres(filme).map((x) => `<option value="${esc(x)}"${ui.genre === x ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>
      </div>
    </div>
    <p class="zaehler" id="filme-zahl">${zahl}</p>
    <div class="filmliste" id="filmliste">${html}</div>
  </section>`;
}
