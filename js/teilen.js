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
import { preisSagtWas, sichererLink, istOnline } from './text.js';

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
  if (eintrag.ort) zeilen.push(`${istOnline(eintrag) ? '📺' : '📍'} ${eintrag.ort}`);
  if (eintrag.beschreibung) zeilen.push(eintrag.beschreibung);
  if (eintrag.imdb) zeilen.push(`⭐ IMDb Top 250, Platz ${eintrag.imdb}`);
  if (preisSagtWas(eintrag.preis)) zeilen.push(`💶 ${eintrag.preis}`);
  if (eintrag.anreise) zeilen.push(`🚆 ${eintrag.anreise}`);
  if (eintrag.unsicher) zeilen.push(`⚠️ Noch nicht sicher: ${eintrag.unsicher}`);
  if (sichererLink(eintrag.link)) zeilen.push(`🔗 ${eintrag.link}`);
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
  const details = [eintrag.beschreibung, preisSagtWas(eintrag.preis) ? `Preis: ${eintrag.preis}` : '', eintrag.anreise ? `Anreise: ${eintrag.anreise}` : '', sichererLink(eintrag.link)]
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

/** iPhone, iPad (auch das iPad, das sich als Mac ausgibt). */
export const istApple = () => /iPhone|iPad|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Läuft die App vom Home-Bildschirm (und nicht im Browser)? */
export const alsApp = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

/** Text für eine iCalendar-Zeile: \, ; , und Zeilenumbrüche maskieren. */
const icsWert = (t) => String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Lange Zeilen falten, wie RFC 5545 es will (hier großzügig nach 60 Zeichen). */
const falten = (zeile) => (zeile.length <= 70 ? zeile : zeile.match(/.{1,60}/gu).join('\r\n '));

/**
 * Der Termin als .ics – für den Kalender des iPhones. Uhrzeiten als
 * Ortszeit Europe/Berlin; ohne Uhrzeit ein ganztägiger Termin.
 */
export function icsText(eintrag) {
  const start = eintrag.ganztags ? null : beginn(eintrag.zeit || '');
  const tag = eintrag.datum.replaceAll('-', '');
  const hhmm = (t) => `${String(Math.floor(t / 60) % 24).padStart(2, '0')}${String(t % 60).padStart(2, '0')}00`;
  let zeit;
  if (start === null) {
    zeit = [`DTSTART;VALUE=DATE:${tag}`, `DTEND;VALUE=DATE:${plusTage(eintrag.datum, 1).replaceAll('-', '')}`];
  } else {
    const endeMin = eintrag.endeMin && eintrag.endeMin > start ? eintrag.endeMin : start + 120;
    const endTag = (endeMin >= 24 * 60 ? plusTage(eintrag.datum, 1) : eintrag.datum).replaceAll('-', '');
    zeit = [`DTSTART;TZID=Europe/Berlin:${tag}T${hhmm(start)}`, `DTEND;TZID=Europe/Berlin:${endTag}T${hhmm(endeMin)}`];
  }
  const jetzt = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const details = [eintrag.beschreibung, preisSagtWas(eintrag.preis) ? `Preis: ${eintrag.preis}` : '', eintrag.anreise ? `Anreise: ${eintrag.anreise}` : '']
    .filter(Boolean).join('\n');
  const link = sichererLink(eintrag.link);
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Freizeit-App//DE', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${icsWert(eintrag.schluessel || `${tag}-${eintrag.titel}`)}@freizeit`,
    `DTSTAMP:${jetzt}`,
    ...zeit,
    `SUMMARY:${icsWert(eintrag.titel)}`,
    eintrag.ort ? `LOCATION:${icsWert(eintrag.ort)}` : '',
    details ? `DESCRIPTION:${icsWert(details)}` : '',
    link ? `URL:${link}` : '',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).map(falten).join('\r\n');
}

/**
 * Wohin der Knopf „Kalender“ führt: auf dem iPhone eine .ics-Datei für den
 * Kalender des Geräts, sonst der ausgefüllte Termin in Google Kalender.
 */
export function kalenderZiel(eintrag) {
  if (!eintrag.datum) return null;
  if (istApple()) {
    return { href: `data:text/calendar;charset=utf-8,${encodeURIComponent(icsText(eintrag))}`, datei: 'termin.ics' };
  }
  return { href: kalenderLink(eintrag), datei: '' };
}
