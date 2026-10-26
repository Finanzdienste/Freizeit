/*
 * Die Daten der App: daten/woche.json und daten/konzerte.json, beide montags früh.
 *
 * Beide schreibt ein geplanter Lauf ins Repository; das Format steht in
 * README.md. Hier wird nur geladen und so weit geprüft, dass ein
 * kaputter Lauf die App nicht leer zurücklässt: Was nicht passt, fällt weg,
 * und die Fehler werden angezeigt statt verschluckt.
 */

const ISO = /^\d{4}-\d{2}-\d{2}$/;

async function holen(pfad) {
  // no-cache: Der Browser fragt immer beim Server nach. Ohne Netz antwortet
  // der Service Worker mit der zuletzt geladenen Fassung.
  const res = await fetch(pfad, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${pfad}: HTTP ${res.status}`);
  return res.json();
}

const liste = (x) => (Array.isArray(x) ? x : []);

/** Woche prüfen: Tage mit Datum, Termine mit Titel und Tagen aus der Woche. */
export function wocheBereinigen(roh, fehler = []) {
  if (!roh || typeof roh !== 'object') {
    fehler.push('woche.json ist leer oder kein Objekt');
    return null;
  }
  const tage = liste(roh.tage).filter((t) => t && ISO.test(t.datum || ''));
  const bekannt = new Set(tage.map((t) => t.datum));
  const termine = liste(roh.termine).filter((e) => {
    const ok = e && e.titel && liste(e.daten).length && liste(e.daten).every((d) => ISO.test(d));
    if (!ok) fehler.push(`Termin ohne Titel oder Datum übersprungen: ${JSON.stringify(e).slice(0, 80)}`);
    return ok;
  });
  const fremd = termine.filter((e) => !e.ganzeWoche && e.daten.some((d) => !bekannt.has(d)));
  if (fremd.length) fehler.push(`${fremd.length} Termin(e) mit Tagen außerhalb der Woche`);
  return {
    ...roh,
    tage,
    termine,
    immer: liste(roh.immer).filter((e) => e && e.titel),
    infos: liste(roh.infos),
    highlights: liste(roh.highlights),
    hinweise: liste(roh.hinweise),
  };
}

export function konzerteBereinigen(roh, fehler = []) {
  if (!roh || typeof roh !== 'object') {
    fehler.push('konzerte.json ist leer oder kein Objekt');
    return { stand: '', konzerte: [] };
  }
  const konzerte = liste(roh.konzerte).filter((k) => {
    const ok = k && k.kuenstler && ISO.test(k.datum || '');
    if (!ok) fehler.push(`Konzert ohne Künstler oder Datum übersprungen: ${JSON.stringify(k).slice(0, 80)}`);
    return ok;
  });
  return { ...roh, konzerte };
}

export async function ladeAlles() {
  const fehler = [];
  const [w, k] = await Promise.allSettled([holen('daten/woche.json'), holen('daten/konzerte.json')]);
  const woche = w.status === 'fulfilled' ? wocheBereinigen(w.value, fehler) : null;
  if (w.status === 'rejected') fehler.push(`Wochendaten nicht geladen (${w.reason.message})`);
  const konzerte = k.status === 'fulfilled' ? konzerteBereinigen(k.value, fehler) : { stand: '', konzerte: [] };
  if (k.status === 'rejected') fehler.push(`Konzertdaten nicht geladen (${k.reason.message})`);
  return { woche, konzerte, fehler };
}
