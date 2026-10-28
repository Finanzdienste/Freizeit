/*
 * Aus dem, was die Datenbank gesammelt hat, werden Mitteilungen fürs Handy:
 * je Raum und Person eine, damit fünf Haken hintereinander nicht fünfmal
 * brummen. Was ankommt (freizeit_push_offen):
 *
 *   { id, raum, art, name, daten, angelegt, abos }
 *
 * art: neu (eingetreten), bock (angehakt oder „mit wem“ gewechselt), aus (ein
 * Häkchen „mit dir“ zurückgenommen), weg (den Raum verlassen). Bei bock und
 * aus ist daten der Schnappschuss des Eintrags (titel, datum, zeit, …) samt
 * mitwem: gastgeber (mit dir) oder andere (allein/mit anderen).
 *
 * Die Mitteilung ist, was der Service Worker (sw.js) bekommt:
 *   { titel, text, tag, url }
 */
const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** „Di 3.11., 19:00 Uhr“ – aus datum (ISO) und zeit, so weit vorhanden. */
export function wann(d) {
  if (!d || typeof d !== 'object') return '';
  const teile = [];
  if (/^\d{4}-\d{2}-\d{2}$/.test(d.datum || '')) {
    const tag = new Date(`${d.datum}T12:00:00Z`);
    teile.push(`${WOCHENTAG[tag.getUTCDay()]} ${Number(d.datum.slice(8, 10))}.${Number(d.datum.slice(5, 7))}.`);
  }
  if (/^\d{1,2}:\d{2}$/.test(d.zeit || '')) teile.push(`${d.zeit} Uhr`);
  else if (d.zeit && teile.length) teile.push(String(d.zeit));
  return teile.join(', ');
}

const titelVon = (d) => (d && typeof d === 'object' && d.titel ? String(d.titel) : 'einen Eintrag');
const mitWem = (d) => (d && d.mitwem === 'gastgeber' ? 'mit dir' : (d && d.mitwem === 'andere' ? 'ohne dich' : ''));
const wo = (d) => [titelVon(d), wann(d)].filter(Boolean).join(' · ');

/** Eine einzelne Nachricht als Überschrift und Text. */
export function einzeln(n) {
  const name = n.name || 'Jemand';
  switch (n.art) {
    case 'neu': return { titel: `${name} ist dabei`, text: `${name} hat sich in deinen Plan eingetragen.` };
    case 'weg': return { titel: `${name} hat den Plan verlassen`, text: `Die Haken von ${name} sind damit weg.` };
    case 'aus': return { titel: `${name} ist doch nicht dabei`, text: wo(n.daten) };
    case 'bock': {
      const wie = mitWem(n.daten);
      return { titel: `${name} hat Bock${wie ? ` – ${wie}` : ''}`, text: wo(n.daten) };
    }
    default: return { titel: `${name}: Neuigkeit`, text: '' };
  }
}

/** Eine Zeile, wenn mehrere zusammenkommen. */
function zeile(n) {
  switch (n.art) {
    case 'neu': return 'ist dabei';
    case 'weg': return 'hat den Plan verlassen';
    case 'aus': return `doch nicht: ${wo(n.daten)}`;
    case 'bock': { const wie = mitWem(n.daten); return `Bock: ${wo(n.daten)}${wie ? ` (${wie})` : ''}`; }
    default: return 'Neuigkeit';
  }
}

/**
 * Die Mitteilungen: je Raum und Name eine, in der Reihenfolge des Entstehens.
 * Jede trägt die Abos ihres Raums und die ids der Nachrichten, die in ihr
 * stecken. Räume ohne Abo bekommen nichts (ihre ids sind trotzdem erledigt).
 */
export function mitteilungen(liste) {
  const gruppen = new Map();
  for (const n of Array.isArray(liste) ? liste : []) {
    if (!n || typeof n !== 'object') continue;
    const k = `${n.raum}|${n.name}`;
    if (!gruppen.has(k)) gruppen.set(k, { raum: n.raum, name: n.name || 'Jemand', abos: Array.isArray(n.abos) ? n.abos : [], ids: [], liste: [] });
    const g = gruppen.get(k);
    g.ids.push(n.id);
    g.liste.push(n);
  }
  const r = [];
  for (const g of gruppen.values()) {
    const tag = `freizeit:${String(g.raum).slice(0, 12)}:${g.name}`;
    const url = './#wir';
    if (g.liste.length === 1) {
      r.push({ ...einzeln(g.liste[0]), tag, url, raum: g.raum, abos: g.abos, ids: g.ids });
      continue;
    }
    const zeilen = g.liste.map(zeile);
    const text = zeilen.length > 5 ? [...zeilen.slice(0, 4), `… und ${zeilen.length - 4} weitere`].join('\n') : zeilen.join('\n');
    const alleBock = g.liste.every((n) => n.art === 'bock');
    const wie = alleBock ? [...new Set(g.liste.map((n) => mitWem(n.daten)))] : [];
    const titel = alleBock && wie.length === 1 && wie[0]
      ? `${g.name} hat Bock auf ${g.liste.length} Sachen – ${wie[0]}`
      : `${g.name}: ${g.liste.length} Neuigkeiten`;
    r.push({ titel, text, tag, url, raum: g.raum, abos: g.abos, ids: g.ids });
  }
  return r;
}
