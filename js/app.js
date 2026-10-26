/*
 * Freizeit – was in Hamburg und Umgebung los ist, die Konzerte deiner
 * Künstler und deine Merkliste.
 *
 * Einstieg: Daten laden, Reiter zeichnen, Knöpfe verdrahten. Die Daten
 * schreiben geplante Läufe montags (Woche) und samstags (Konzerte) nach
 * daten/; die App selbst ändert sie nie.
 */
import { laden, speichern, aktuell, merken, entfernen } from './speicher.js';
import { ladeAlles } from './daten.js';
import { heute, standText } from './zeit.js';
import { esc } from './text.js';
import { wocheAnsicht } from './ansicht-woche.js';
import { konzerteAnsicht } from './ansicht-konzerte.js';
import { merklisteAnsicht, vorbei } from './ansicht-merkliste.js';
import { eintragZu, vergessen } from './karte.js';

const REITER = ['woche', 'konzerte', 'merkliste'];
const $ = (s) => document.querySelector(s);

let daten = { woche: null, konzerte: { stand: '', konzerte: [] }, fehler: [] };
let reiter = REITER.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'woche';
let geladen = false;

function leisteAktualisieren() {
  const st = aktuell();
  const h = heute();
  document.querySelectorAll('[data-reiter]').forEach((b) => {
    if (b.dataset.reiter === reiter) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  const offen = st.merkliste.filter((m) => !vorbei(m, h)).length;
  $('#merkzahl').textContent = offen ? String(offen) : '';
  const k = daten.konzerte;
  const neu = Boolean(k.stand) && k.stand !== st.gesehen.konzerte && k.konzerte.some((x) => x.datum >= h);
  $('#konzerte-neu').hidden = !neu;
  const w = daten.woche;
  $('#stand').textContent = w && w.stand ? `Stand ${standText(w.stand)}` : '';
}

function zeichnen({ nachOben = false } = {}) {
  const st = aktuell();
  const h = heute();
  vergessen();
  let html;
  if (!geladen) html = '<div class="leer"><p>Lädt …</p></div>';
  else if (reiter === 'konzerte') html = konzerteAnsicht(daten.konzerte, h);
  else if (reiter === 'merkliste') html = merklisteAnsicht(st.merkliste, h);
  else html = wocheAnsicht(daten.woche, st, h);
  if (geladen && daten.fehler.length && reiter !== 'merkliste') {
    html += `<details class="datenfehler"><summary>Hinweise zu den Daten (${daten.fehler.length})</summary><ul>${daten.fehler.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></details>`;
  }
  $('#ansicht').innerHTML = html;
  if (reiter === 'konzerte' && daten.konzerte.stand && st.gesehen.konzerte !== daten.konzerte.stand) {
    st.gesehen.konzerte = daten.konzerte.stand;
    speichern();
  }
  leisteAktualisieren();
  if (nachOben) window.scrollTo(0, 0);
}

function wechseln(neu) {
  if (!REITER.includes(neu)) return;
  reiter = neu;
  // Der Reiter steht in der Adresse, damit Neuladen ihn behält – ohne einen
  // neuen Eintrag im Verlauf.
  history.replaceState(null, '', neu === 'woche' ? location.pathname + location.search : `#${neu}`);
  zeichnen({ nachOben: true });
  $('#ansicht').focus({ preventScroll: true });
}

document.addEventListener('click', (ev) => {
  const z = ev.target.closest('[data-reiter], [data-merken], [data-entfernen], [data-filter], [data-aktion]');
  if (!z) return;
  const st = aktuell();
  if (z.dataset.reiter) {
    wechseln(z.dataset.reiter);
  } else if (z.dataset.merken) {
    const eintrag = eintragZu(z.dataset.merken);
    if (!eintrag) return;
    const an = merken(eintrag);
    z.setAttribute('aria-pressed', String(an));
    z.textContent = an ? 'Gemerkt' : 'Merken';
    leisteAktualisieren();
  } else if (z.dataset.entfernen) {
    entfernen(z.dataset.entfernen);
    zeichnen();
  } else if (z.dataset.filter) {
    st.filter[z.dataset.filter] = !st.filter[z.dataset.filter];
    speichern();
    zeichnen();
  } else if (z.dataset.aktion === 'vergangene') {
    st.vergangeneTage = !st.vergangeneTage;
    speichern();
    zeichnen();
  } else if (z.dataset.aktion === 'vorbei-weg') {
    const h = heute();
    st.merkliste = st.merkliste.filter((m) => !vorbei(m, h));
    speichern();
    zeichnen();
  }
});

document.addEventListener('change', (ev) => {
  const st = aktuell();
  if (ev.target.id === 'f-region') st.filter.region = ev.target.value;
  else if (ev.target.id === 'f-kategorie') st.filter.kategorie = ev.target.value;
  else return;
  speichern();
  zeichnen();
});

// #konzerte und #merkliste öffnen den Reiter direkt (z. B. von einem
// Lesezeichen). Andere Sprungmarken (#tag-…) sind Anker in der Seite.
window.addEventListener('hashchange', () => {
  const h = location.hash.slice(1);
  if (REITER.includes(h) && h !== reiter) wechseln(h);
});

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
zeichnen();
ladeAlles().then((d) => {
  daten = d;
  geladen = true;
  zeichnen();
});
