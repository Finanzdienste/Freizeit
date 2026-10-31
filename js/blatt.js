/*
 * Das Blatt von unten: die Filter eines Reiters, über der Seite.
 *
 * Ein Dialog (role="dialog", aria-modal) über einem abgedunkelten
 * Hintergrund. Er schließt mit ✕, mit Escape, mit einem Tipp daneben und mit
 * dem Knopf unten („135 Termine zeigen“). Solange er offen ist, ist der Rest
 * der Seite inert: Tab bleibt im Blatt, Vorleser lesen nur das Blatt. Beim
 * Schließen geht der Fokus zurück auf den Knopf, der es geöffnet hat.
 *
 * Jede Wahl gilt sofort. app.js zeichnet die Seite dahinter neu und ruft
 * blattAuffrischen(): Der Inhalt wird neu gebaut, das Element mit dem Fokus
 * (gefunden über data-fokus oder id) und die Scrollposition bleiben.
 */

/** Das offene Blatt: { art, bauen, ausloeser } – bauen() gibt { titel, inhalt, fuss }. */
let offen = null;

const ort = () => document.getElementById('blatt-ort');
const rest = () => document.querySelectorAll('.kopf, #ansicht, .reiterleiste');

/** Welches Blatt offen ist ('programm', 'karte', 'ideen') – oder ''. */
export const blattArt = () => (offen ? offen.art : '');

/**
 * Öffnen. `ausloeser` ist ein Selektor für den Knopf, der nach dem Schließen
 * den Fokus bekommt – das Element selbst gibt es nach dem Neuzeichnen nicht mehr.
 */
export function blattOeffnen(art, bauen, ausloeser = '') {
  const b = bauen();
  offen = { art, bauen, ausloeser };
  ort().innerHTML = `<div class="blatt-schleier" data-aktion="blatt-zu"></div>
    <section class="blatt" id="blatt" role="dialog" aria-modal="true" aria-labelledby="blatt-titel" tabindex="-1">
      <div class="blatt-kopf"><h2 id="blatt-titel">${b.titel}</h2><button type="button" class="blatt-x" data-aktion="blatt-zu" aria-label="Schließen">✕</button></div>
      <div class="blatt-inhalt">${b.inhalt}</div>
      <div class="blatt-fuss">${b.fuss}</div>
    </section>`;
  rest().forEach((el) => { el.inert = true; });
  document.body.classList.add('blatt-auf');
  const blatt = document.getElementById('blatt');
  // Ein Bild später einfahren lassen, damit der Übergang greift.
  window.requestAnimationFrame(() => blatt.classList.add('offen'));
  blatt.focus({ preventScroll: true });
  const knopf = ausloeser && document.querySelector(ausloeser);
  if (knopf) knopf.setAttribute('aria-expanded', 'true');
}

/** Den Inhalt neu bauen – nach jeder Wahl. Fokus und Scrollposition bleiben. */
export function blattAuffrischen() {
  const blatt = document.getElementById('blatt');
  if (!offen || !blatt) return;
  const b = offen.bauen();
  const aktiv = document.activeElement;
  const drin = Boolean(aktiv && aktiv !== blatt && blatt.contains(aktiv));
  const fokus = drin ? (aktiv.dataset.fokus || aktiv.id || '') : '';
  const inhalt = blatt.querySelector('.blatt-inhalt');
  const y = inhalt.scrollTop;
  blatt.querySelector('#blatt-titel').innerHTML = b.titel;
  inhalt.innerHTML = b.inhalt;
  blatt.querySelector('.blatt-fuss').innerHTML = b.fuss;
  inhalt.scrollTop = y;
  if (!drin || blatt.contains(document.activeElement)) return;
  const neu = fokus && (blatt.querySelector(`[data-fokus="${CSS.escape(fokus)}"]`) || document.getElementById(fokus));
  (neu || blatt).focus({ preventScroll: true });
}

export function blattSchliessen() {
  if (!offen) return;
  const { ausloeser } = offen;
  offen = null;
  ort().innerHTML = '';
  rest().forEach((el) => { el.inert = false; });
  document.body.classList.remove('blatt-auf');
  const knopf = ausloeser && document.querySelector(ausloeser);
  if (knopf) {
    knopf.setAttribute('aria-expanded', 'false');
    knopf.focus({ preventScroll: true });
  }
}

document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape' || !offen) return;
  ev.preventDefault();
  blattSchliessen();
});
