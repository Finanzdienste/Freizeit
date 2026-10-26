/*
 * Weitergeben: als fertige WhatsApp-Nachricht oder als Termin im Google-Kalender.
 *
 * Beides sind gewöhnliche Links. wa.me öffnet WhatsApp mit dem Text, man
 * wählt nur noch den Kontakt; der Kalender-Link öffnet einen ausgefüllten
 * Termin in Google Kalender. Kein Download, keine Berechtigung.
 *
 * Grundlage ist ein „Eintrag“, wie ihn karte.js aus Termin, Konzert oder
 * Ausflugsziel baut (siehe dort).
 */
import { datumMitTag, tagMonat, datumLang, beginn, plusTage } from './zeit.js';
import { preisSagtWas } from './text.js';

/** Datum und Uhrzeit für Menschen: „Mittwoch, 28.10.2026, 19:30 Uhr“. */
export function wannText(eintrag) {
  if (eintrag.datum) {
    const z = String(eintrag.zeit || '');
    if (!z) return datumMitTag(eintrag.datum);
    return `${datumMitTag(eintrag.datum)}, ${z}${/\d$/.test(z) ? ' Uhr' : ''}`;
  }
  if (eintrag.von && eintrag.bis) return `${tagMonat(eintrag.von)}–${datumLang(eintrag.bis)}: ${eintrag.zeit}`;
  return eintrag.zeit || '';
}

export function whatsappText(eintrag) {
  const zeilen = [`*${eintrag.titel}*`];
  const wann = wannText(eintrag);
  if (wann) zeilen.push(`${eintrag.datum || eintrag.von ? '📅' : '🕒'} ${wann}`);
  if (eintrag.ort) zeilen.push(`📍 ${eintrag.ort}`);
  if (eintrag.beschreibung) zeilen.push(eintrag.beschreibung);
  if (eintrag.imdb) zeilen.push(`⭐ IMDb Top 250, Platz ${eintrag.imdb}`);
  if (preisSagtWas(eintrag.preis)) zeilen.push(`💶 ${eintrag.preis}`);
  if (eintrag.anreise) zeilen.push(`🚆 ${eintrag.anreise}`);
  if (eintrag.unsicher) zeilen.push(`⚠️ Noch nicht sicher: ${eintrag.unsicher}`);
  if (eintrag.link) zeilen.push(`🔗 ${eintrag.link}`);
  return zeilen.join('\n');
}

export const whatsappLink = (eintrag) => `https://wa.me/?text=${encodeURIComponent(whatsappText(eintrag))}`;

const kompakt = (iso) => iso.replaceAll('-', '');
const hhmm = (t) => `${String(Math.floor(t / 60) % 24).padStart(2, '0')}${String(t % 60).padStart(2, '0')}00`;

/**
 * Google-Kalender-Link für einen Eintrag mit Datum, sonst null.
 * Ohne Uhrzeit ein ganztägiger Termin; ohne Ende zwei Stunden.
 */
export function kalenderLink(eintrag) {
  if (!eintrag.datum) return null;
  const start = eintrag.ganztags ? null : beginn(eintrag.zeit || '');
  let dates;
  if (start === null) {
    dates = `${kompakt(eintrag.datum)}/${kompakt(plusTage(eintrag.datum, 1))}`;
  } else {
    const endeMin = eintrag.endeMin && eintrag.endeMin > start ? eintrag.endeMin : start + 120;
    const endTag = endeMin >= 24 * 60 ? plusTage(eintrag.datum, 1) : eintrag.datum;
    dates = `${kompakt(eintrag.datum)}T${hhmm(start)}/${kompakt(endTag)}T${hhmm(endeMin)}`;
  }
  const details = [eintrag.beschreibung, preisSagtWas(eintrag.preis) ? `Preis: ${eintrag.preis}` : '', eintrag.anreise ? `Anreise: ${eintrag.anreise}` : '', eintrag.link]
    .filter(Boolean).join('\n\n');
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: eintrag.titel,
    dates,
    ctz: 'Europe/Berlin',
    details,
    location: eintrag.ort || '',
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
