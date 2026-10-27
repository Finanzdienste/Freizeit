/*
 * Reiter „Ideen“: alles ohne festen Termin – zum Stöbern, Bock-Haken,
 * Einplanen und Abhaken.
 *
 * Oben steht, was gerade zählt: Eingeplantes (mit „Wie war's?“, sobald der
 * Tag vorbei ist), Ideen mit Bock („Wollen wir mal“) und „Tut dir gut“ – was
 * du nach dem Machen am besten bewertet hast und wobei die Zeit verflog.
 * Darunter die Filter nach Wirkung und Rahmen und der Katalog nach
 * Kategorien, eingeklappt, bis man filtert oder eine aufmacht.
 *
 * Eine Idee kann mehrmals auf der Seite stehen (etwa unter „Wollen wir mal“
 * und in ihrer Kategorie). Deshalb trägt jeder Knopf seinen Bereich mit, und
 * die Formulare (Einplanen, Wie war's?) gehen nur an der Stelle auf, an der
 * man getippt hat. Gelesen werden ihre Felder erst beim Speichern, relativ
 * zum Knopf – so muss zwischendurch nichts neu gezeichnet werden.
 */
import { esc, anzahl, DRAUSSEN } from './text.js';
import { plusTage, wochentag } from './zeit.js';
import {
  KATEGORIEN, WIRKUNG, WO, DAUER, BEWERTUNG, passtIdee, ideenFilterAn, inSaison, saisonText,
  geplante, eigeneIdeen, ideenMitBock, bilanz, tutGut, vorZeit,
} from './ideen.js';
import { karte, merkeEintrag, bockKnopf, werZeile, wannKurz } from './karte.js';
import { meinBock } from './speicher.js';
import { treffer, rolle, gastgeberName } from './gemeinsam.js';

const EXTRA = [['drinnen', 'drinnen'], ['draussen', 'draußen'], ['kostenlos', 'kostenlos'], ['kurz', 'bis 2 Std.'], ['zuZweit', 'zu zweit']];
const MIT_TEXT = { allein: 'allein', 'zu zweit': 'zu zweit', gruppe: 'in der Gruppe' };
const mitText = (mit) => (mit.length === 3 ? 'allein oder gemeinsam' : mit.map((m) => MIT_TEXT[m]).join(' oder '));

/** Anker einer Idee in ihrer Kategorie – für „bei den Ideen“ aus der Karte. */
export const ideeAnker = (schluessel) => `idee-${schluessel.replace(/[^a-z0-9-]/gi, '-')}`;

/** Vorschlag fürs Einplanen: der nächste Samstag, am Wochenende heute. */
function vorschlagTag(heute) {
  let d = heute;
  while (!/^(Samstag|Sonntag)$/.test(wochentag(d))) d = plusTage(d, 1);
  return d;
}

/**
 * Wer eingeladen ist, sagt beim Einplanen und bei eigenen Ideen gleich dazu,
 * ob mit dem Gastgeber oder ohne ihn – wie mit den zwei Bock-Knöpfen.
 */
function mitWemWahl(name, klasse) {
  if (rolle() !== 'mitglied') return '';
  const g = esc(gastgeberName() || 'Gastgeber');
  return `<fieldset class="checks mitwem-wahl"><legend>Mit wem?</legend>
    <label class="check"><input type="radio" name="${esc(name)}" class="${klasse}" value="gastgeber" checked> Mit ${g}</label>
    <label class="check"><input type="radio" name="${esc(name)}" class="${klasse}" value="andere"> Allein/mit anderen</label>
  </fieldset>`;
}

/** Was nach dem Einplanen wer sieht – je nach Rolle im Plan. */
function wohinPlan() {
  const r = rolle();
  if (r === 'gastgeber') return 'Steht dann im Programm – deine Leute sehen es und können Bock dazu sagen.';
  if (r === 'mitglied') return `Steht dann in deinem Programm. ${esc(gastgeberName() || 'Der Gastgeber')} sieht es – mit dir oder als Info, je nachdem, was du wählst.`;
  return 'Steht dann im Programm – in Liste, Monat, Woche und Tag.';
}

function planenForm(x, bereich, heute) {
  return `<div class="formular" data-form="planen">
    <div class="zeile-felder">
      <label class="feld-label">Tag<input type="date" class="eingabe plan-datum" value="${vorschlagTag(heute)}" min="${heute}" max="${plusTage(heute, 400)}"></label>
      <label class="feld-label">Uhrzeit (optional)<input type="time" class="eingabe plan-zeit"></label>
    </div>
    ${x.orte.length > 1 ? `<label class="feld-label">Wo<select class="plan-ort"><option value="">noch offen</option>${x.orte.map((o, i) => `<option value="${i}">${esc(o.name)}${o.teil ? ` (${esc(o.teil)})` : ''}</option>`).join('')}</select></label>` : ''}
    ${mitWemWahl(`plan-mitwem-${bereich}-${x.schluessel}`, 'plan-mitwem')}
    <p class="fein">${wohinPlan()}</p>
    <div class="aktionen">
      <button type="button" class="knopf haupt" data-aktion="plan-speichern" data-idee="${esc(x.schluessel)}" data-bereich="${bereich}">Einplanen</button>
      <button type="button" class="knopf" data-aktion="planen" data-idee="${esc(x.schluessel)}" data-bereich="${bereich}">Abbrechen</button>
    </div>
  </div>`;
}

/** „Wie war's?“ – Gesichter als Radioknöpfe, ein Haken für Flow, der Tag. */
function bewertenForm(ideeSchluessel, heute, plan = '') {
  return `<div class="formular bewerten" data-form="bewerten">
    <div class="frage">Wie war's?</div>
    <div class="gesichter" role="radiogroup" aria-label="Wie war's?">
      ${[1, 2, 3].map((w) => `<label class="gesicht"><input type="radio" name="bewertung-${esc(plan || ideeSchluessel)}" value="${w}"><span>${BEWERTUNG[w][0]}<small>${BEWERTUNG[w][1]}</small></span></label>`).join('')}
    </div>
    <label class="check"><input type="checkbox" class="gemacht-flow"> ⚡ Zeit verflogen – war voll drin</label>
    ${plan ? '' : `<label class="feld-label">Wann<input type="date" class="eingabe gemacht-datum" value="${heute}" max="${heute}"></label>`}
    <div class="aktionen">
      <button type="button" class="knopf haupt" data-aktion="gemacht-speichern" data-idee="${esc(ideeSchluessel)}"${plan ? ` data-plan="${esc(plan)}"` : ''}>Speichern</button>
      <button type="button" class="knopf" data-aktion="gemacht-abbrechen">Abbrechen</button>
    </div>
    <p class="fein">Bleibt nur auf diesem Gerät – daraus wird „Tut dir gut“.</p>
  </div>`;
}

const marke = (t, art) => `<span class="marke ${art}">${esc(t)}</span>`;

/** Eine Idee als Karte. `bereich` sagt, in welchem Abschnitt sie steht. */
export function ideeKarte(x, ctx, bereich) {
  merkeEintrag(x);
  const { heute, ui, bil } = ctx;
  const b = bil.get(x.schluessel);
  const wer = werZeile(x);
  const hier = `${bereich}|${x.schluessel}`;
  const unter = [WO[x.wo], DAUER[x.dauer], x.mit.length ? mitText(x.mit) : ''].filter(Boolean).join(' · ');
  const marken = [
    ...x.wirkung.map((w) => marke(WIRKUNG[w], `wirkung ${w}`)),
    x.kostenlos ? marke('kostenlos', 'frei') : '',
    x.preis ? `<span class="preis">${esc(x.preis)}</span>` : '',
    x.draussen ? marke(DRAUSSEN[x.draussen] || x.draussen, 'rand') : '',
    saisonText(x.saison) ? marke(`Saison ${saisonText(x.saison)}`, 'rand') : '',
    x.hohwacht ? marke('Hohwacht-Kombi', 'hohwacht') : '',
    x.eigene ? marke(`Eigene Idee${x.urheber ? ` von ${x.urheber}` : ''}`, 'eigen') : '',
  ].filter(Boolean).join('');
  const orte = x.orte.length ? `<ul class="orte">${x.orte.map((o) => `<li>
      ${o.link ? `<a href="${esc(o.link)}" target="_blank" rel="noopener">${esc(o.name)}</a>` : `<span class="ort-name">${esc(o.name)}</span>`}${o.teil ? ` <span class="teil">${esc(o.teil)}</span>` : ''}
      ${o.info ? `<div class="ort-info">${esc(o.info)}</div>` : ''}</li>`).join('')}</ul>` : '';
  const schnitt = b && b.bewertet ? BEWERTUNG[Math.round(b.summe / b.bewertet)][0] : '';
  const verlauf = b ? `<div class="verlauf">✓ ${b.n}× gemacht · zuletzt ${esc(vorZeit(b.zuletzt, heute))}${schnitt ? ` · ${schnitt}` : ''}${b.flow ? ` · ⚡ ${b.flow}× Flow` : ''}</div>` : '';
  const klassen = ['karte', 'ohne-zeit', 'idee', wer.treffer ? 'treffer' : '', x.wirkung.includes('flow') ? 'flow' : ''].filter(Boolean).join(' ');
  return `<article class="${klassen}"${bereich === 'kat' ? ` id="${ideeAnker(x.schluessel)}"` : ''}><div class="inhalt">
    <h3>${esc(x.titel)}</h3>
    ${unter ? `<div class="unter">${esc(unter)}</div>` : ''}
    ${x.beschreibung ? `<p>${esc(x.beschreibung)}</p>` : ''}
    ${marken ? `<div class="marken">${marken}</div>` : ''}
    ${x.ziel ? `<div class="ziel"><b>${x.wirkung.includes('flow') ? '⚡ Flow-Ziel' : 'Ziel'}:</b> ${esc(x.ziel)}</div>` : ''}
    ${x.braucht ? `<div class="braucht"><b>Braucht:</b> ${esc(x.braucht)}</div>` : ''}
    ${orte}
    ${x.zeiten ? `<div class="braucht"><b>Zeiten:</b> ${esc(x.zeiten)}</div>` : ''}
    ${x.anreise ? `<div class="anreise">Anreise: ${esc(x.anreise)}</div>` : ''}
    ${verlauf}
    ${wer.html}
    <div class="aktionen">
      ${bockKnopf(x)}
      <button type="button" class="knopf" data-aktion="planen" data-idee="${esc(x.schluessel)}" data-bereich="${bereich}" aria-expanded="${ui.planen === hier}">Einplanen</button>
      <button type="button" class="knopf" data-aktion="gemacht" data-idee="${esc(x.schluessel)}" data-bereich="${bereich}" aria-expanded="${ui.bewerten === hier}">Gemacht</button>
      ${x.link ? `<a class="quelle" href="${esc(x.link)}" target="_blank" rel="noopener">Info</a>` : ''}
    </div>
    ${ui.planen === hier ? planenForm(x, bereich, heute) : ''}
    ${ui.bewerten === hier ? bewertenForm(x.schluessel, heute) : ''}
  </div></article>`;
}

/** Ein eingeplanter Tag, der vorbei ist: Wie war's? */
function frageKarte(e, ctx) {
  merkeEintrag(e);
  const hier = `plan|${e.schluessel}`;
  return `<article class="karte frage-karte">
    <div class="zeit">${esc(wannKurz(e))}</div>
    <div class="inhalt">
      <h3>${esc(e.titel)}</h3>
      <div class="aktionen">
        <button type="button" class="knopf haupt" data-aktion="gemacht" data-idee="${esc(e.idee)}" data-plan="${esc(e.schluessel)}" data-bereich="plan" aria-expanded="${ctx.ui.bewerten === hier}">Wie war's?</button>
        <button type="button" class="textknopf" data-aktion="plan-weg" data-plan="${esc(e.schluessel)}">Hat nicht geklappt</button>
      </div>
      ${ctx.ui.bewerten === hier ? bewertenForm(e.idee, ctx.heute, e.schluessel) : ''}
    </div>
  </article>`;
}

function neuForm(st, ui) {
  return `<div class="formular" data-form="idee">
    <label class="feld-label">Was?<input class="eingabe idee-titel" maxlength="80" placeholder="z. B. Kanu fahren auf der Wandse" enterkeyhint="done"></label>
    <label class="feld-label">Notiz (optional)<textarea class="eingabe idee-text" maxlength="300" rows="2"></textarea></label>
    <label class="feld-label">Wo<select class="idee-wo">${Object.entries(WO).map(([k, t]) => `<option value="${k}"${k === 'hamburg' ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
    <fieldset class="checks"><legend>Was bringt's? (optional)</legend>
      ${Object.entries(WIRKUNG).map(([k, t]) => `<label class="check"><input type="checkbox" class="idee-wirkung" value="${k}"> ${esc(t)}</label>`).join('')}
    </fieldset>
    ${mitWemWahl('idee-mitwem', 'idee-mitwem')}
    ${ui.fehler ? `<div class="fehlerbox" role="alert">${esc(ui.fehler)}</div>` : ''}
    <div class="aktionen">
      <button type="button" class="knopf haupt" data-aktion="idee-speichern">Speichern</button>
      <button type="button" class="knopf" data-aktion="idee-neu">Abbrechen</button>
    </div>
    <p class="fein">${{
    gastgeber: 'Deine Leute im Plan sehen die Idee und können Bock darauf haben.',
    mitglied: `${esc(gastgeberName() || 'Der Gastgeber')} sieht deine Idee.`,
  }[rolle()] || 'Im gemeinsamen Plan sehen auch die anderen deine Ideen.'}</p>
  </div>`;
}

function filterLeiste(f, zahl, saisonWeg, ui) {
  const an = ideenFilterAn(f);
  return `<div class="filter ideen-filter" id="ideen-filter">
    <div class="filterzeile">${Object.entries(WIRKUNG).map(([k, t]) => `<button type="button" class="schalter${k === 'flow' ? ' flow' : ''}" data-ifilter="w:${k}" aria-pressed="${f.wirkung.includes(k)}">${esc(t)}</button>`).join('')}</div>
    <div class="filterzeile">${[['', 'Überall'], ...Object.entries(WO)].map(([k, t]) => `<button type="button" class="schalter" data-ifilter="wo:${k}" aria-pressed="${f.wo === k}">${t}</button>`).join('')}</div>
    <div class="filterzeile">${EXTRA.map(([k, t]) => `<button type="button" class="schalter" data-ifilter="x:${k}" aria-pressed="${Boolean(f[k])}">${t}</button>`).join('')}</div>
    <div class="zaehler" id="ideen-zaehler">${anzahl(zahl, 'Idee', 'Ideen')}${an ? ' · <button type="button" class="textknopf" data-aktion="ideen-filter-weg">Filter zurücksetzen</button>' : ''}${saisonWeg ? ` · ${saisonWeg} außerhalb der Saison <button type="button" class="textknopf" data-aktion="saison-alle">zeigen</button>` : (ui.saisonAlle ? ' · <button type="button" class="textknopf" data-aktion="saison-alle">nur, was jetzt Saison hat</button>' : '')}</div>
    <p class="fein">⚡ Flow: fordert dich genau richtig, mit klarem Ziel – die Zeit verfliegt. Produktiv: du lernst oder schaffst etwas.</p>
  </div>`;
}

/**
 * @param {object[]} alle       Ideen aus dem Katalog (und Ausflugsziele aus dem Programm)
 * @param {boolean} geladen     ob der Katalog geladen werden konnte
 * @param {object} ui           neu, planen, bewerten, offen (Set), saisonAlle, meldung, fehler
 */
export function ideenAnsicht(alle, geladen, st, heute, ui) {
  const f = st.ideenFilter;
  const monat = Number(heute.slice(5, 7));
  const ctx = { heute, ui, bil: bilanz(st.verlauf) };
  const eigene = eigeneIdeen(st);
  const filterAktiv = ideenFilterAn(f);

  const meldung = ui.meldung ? `<div class="meldung" role="status"><span>${esc(ui.meldung.text)}</span><span class="meldung-knoepfe">${ui.meldung.rueckgaengig ? '<button type="button" class="knopf klein" data-aktion="rueckgaengig">Rückgängig</button>' : ''}<button type="button" class="textknopf" data-aktion="meldung-weg" aria-label="Hinweis schließen">✕</button></span></div>` : '';
  const kopf = `<header class="woche-kopf">
    <div class="zeile-kopf"><h2 class="abschnitt-titel">Ideen</h2>
      <button type="button" class="knopf" data-aktion="idee-neu" aria-expanded="${Boolean(ui.neu)}">+ Eigene Idee</button></div>
    <p class="fein">Alles ohne festen Termin – für freie Abende und Wochenenden. Was ihr einplant, steht im Programm.</p>
    ${ui.neu ? neuForm(st, ui) : ''}
    ${meldung}
    ${geladen ? '' : '<div class="banner">Der Ideen-Katalog ließ sich nicht laden – eigene und eingeplante Ideen stehen trotzdem hier.</div>'}
  </header>`;

  // Eingeplant: was kommt, und was vorbei ist und noch auf „Wie war's?“ wartet.
  const plaene = geplante(st);
  const kommend = plaene.filter((e) => e.datum >= heute);
  const offen = plaene.filter((e) => e.datum < heute && e.datum >= plusTage(heute, -14) && meinBock(e.schluessel)
    && !st.verlauf.some((v) => v.plan === e.schluessel));
  const eingeplant = kommend.length || offen.length ? `<section class="abschnitt" id="abschnitt-geplant">
    <h2 class="abschnitt-titel">Eingeplant</h2>
    ${offen.map((e) => frageKarte(e, ctx)).join('')}
    ${kommend.map((e) => karte(e, { zeitSpalte: true, zeitText: wannKurz(e) })).join('')}
  </section>` : '';

  // Wollen wir mal: Ideen mit Bock – Treffer zuerst.
  const rang = (x) => (treffer(x.schluessel) ? 0 : (meinBock(x.schluessel) ? 1 : 2));
  const wollen = ideenMitBock(alle, st).sort((a, b) => rang(a) - rang(b) || a.titel.localeCompare(b.titel, 'de'));
  const wollenHtml = wollen.length ? `<section class="abschnitt" id="abschnitt-wollen">
    <h2 class="abschnitt-titel">Wollen wir mal</h2>
    <p class="fein">${st.gemeinsam ? 'Ideen mit Bock – oben, worauf ihr zusammen Bock habt.' : 'Ideen, auf die du Bock hast.'}</p>
    ${wollen.map((x) => ideeKarte(x, ctx, 'wollen')).join('')}
  </section>` : '';

  // Tut dir gut: aus „Wie war's?“.
  const nachSchluessel = new Map([...alle, ...eigene].map((x) => [x.schluessel, x]));
  const gut = tutGut(st.verlauf).map((b) => nachSchluessel.get(b.schluessel)).filter(Boolean);
  const flowZahl = st.verlauf.filter((v) => v.flow).length;
  const gutHtml = st.verlauf.length ? `<section class="abschnitt" id="abschnitt-gut">
    <h2 class="abschnitt-titel">Tut dir gut</h2>
    <p class="fein bilanz">Bisher ${st.verlauf.length}× etwas gemacht, ${flowZahl}× davon mit Flow.${gut.length ? ' Am besten fandest du:' : ' Sobald du etwas mit 🙂 oder 😄 bewertest, steht es hier.'}</p>
    ${gut.map((x) => ideeKarte(x, ctx, 'gut')).join('')}
  </section>` : '';

  // Katalog: Filter, Saison, Kategorien.
  const passend = alle.filter((x) => passtIdee(x, f));
  const zeigen = ui.saisonAlle ? passend : passend.filter((x) => inSaison(x, monat));
  const saisonWeg = passend.length - zeigen.length;
  const eigeneZeigen = eigene.filter((x) => passtIdee(x, f));
  const eigeneHtml = eigeneZeigen.length ? `<section class="abschnitt" id="abschnitt-eigene">
    <h2 class="abschnitt-titel">Eigene Ideen</h2>
    <p class="fein">Eine eigene Idee bleibt, solange jemand Bock darauf hat.</p>
    ${eigeneZeigen.map((x) => ideeKarte(x, ctx, 'eigene')).join('')}
  </section>` : '';
  const kategorien = KATEGORIEN.map(([k, titel]) => {
    const liste = zeigen.filter((x) => x.kat === k);
    if (!liste.length) return '';
    const auf = filterAktiv || ui.offen.has(k);
    const vorschau = liste.slice(0, 4).map((x) => x.titel).join(', ') + (liste.length > 4 ? ' …' : '');
    return `<details class="kategorie" data-kat="${k}"${auf ? ' open' : ''}>
      <summary><span class="kat-titel">${esc(titel)}</span><span class="kat-zahl">${liste.length}</span><span class="kat-vorschau">${esc(vorschau)}</span></summary>
      ${liste.map((x) => ideeKarte(x, ctx, 'kat')).join('')}
    </details>`;
  }).join('');

  return `${kopf}
    ${eingeplant}
    ${wollenHtml}
    ${gutHtml}
    <section class="abschnitt" id="abschnitt-katalog">
      <h2 class="abschnitt-titel">Alle Ideen</h2>
      ${filterLeiste(f, zeigen.length + eigeneZeigen.length, saisonWeg, ui)}
    </section>
    ${eigeneHtml}
    <div class="kategorien">${kategorien || (geladen ? '<div class="leer-klein">Keine Idee passt zu diesen Filtern.</div>' : '')}</div>`;
}
