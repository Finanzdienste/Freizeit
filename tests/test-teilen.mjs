/*
 * Freizeit: WhatsApp-Nachricht und Google-Kalender.
 *
 * Erst die Bausteine direkt (teilen.js hat keine Abhängigkeit zum Browser),
 * dann die Knöpfe auf den Karten: Was darin steht, ist genau das, was der
 * Empfänger liest.
 */
import { whatsappText, kalenderLink, wannText } from '../js/teilen.js';
import { oeffne, DI, SA } from './hilfe.mjs';

const { page, check, ende } = await oeffne({ tag: '2026-11-02' });

// --- Bausteine
const termin = {
  titel: 'Theater früh', datum: DI, zeit: '19:00', endeMin: 21 * 60, ort: 'Thalia', beschreibung: 'Schauspiel.',
  preis: 'ab 20 €', anreise: '', link: 'https://example.org/theater', imdb: '',
};
check(wannText(termin) === 'Dienstag, 3.11.2026, 19:00 Uhr', 'Datum und Uhrzeit für Menschen');
const text = whatsappText(termin);
check(text.startsWith('*Theater früh*\n'), 'Nachricht beginnt mit dem Titel in Fettschrift');
check(text.includes('📅 Dienstag, 3.11.2026, 19:00 Uhr') && text.includes('📍 Thalia') && text.includes('💶 ab 20 €') && text.endsWith('🔗 https://example.org/theater'),
  'Nachricht enthält Datum, Ort, Preis und Link');
check(!whatsappText({ ...termin, preis: 'Preis nicht genannt' }).includes('💶'), 'eine Preisangabe ohne Aussage fällt weg');
const kal = new URL(kalenderLink(termin));
check(kal.searchParams.get('dates') === '20261103T190000/20261103T210000', 'Kalender: Beginn und Ende');
check(kal.searchParams.get('ctz') === 'Europe/Berlin' && kal.searchParams.get('text') === 'Theater früh', 'Kalender: Zeitzone und Titel');
const spaet = new URL(kalenderLink({ ...termin, zeit: '23:00', endeMin: 26 * 60 }));
check(spaet.searchParams.get('dates') === '20261103T230000/20261104T020000', 'Kalender: Ende nach Mitternacht am Folgetag');
const ganztags = new URL(kalenderLink({ ...termin, ganztags: true, zeit: 'Sa 10–18', datum: SA }));
check(ganztags.searchParams.get('dates') === '20261107/20261108', 'Kalender: Ganztägiges als ganzer Tag');
check(kalenderLink({ ...termin, datum: null }) === null, 'ohne Datum kein Kalenderlink');
check(wannText({ von: '2026-11-02', bis: '2026-11-08', zeit: 'täglich 10–18' }) === '2.11.–8.11.2026: täglich 10–18', 'Wochenangebot: Zeitraum und Zeiten');

// --- Knöpfe auf den Karten
const karte = page.locator(`#tag-${DI} .karte`, { hasText: 'Theater früh' });
const wa = await karte.locator('a', { hasText: 'WhatsApp' }).getAttribute('href');
check(wa.startsWith('https://wa.me/?text='), 'WhatsApp-Knopf zeigt auf wa.me');
const nachricht = decodeURIComponent(wa.split('text=')[1]);
check(nachricht.includes('*Theater früh*') && nachricht.includes('📅 Dienstag, 3.11.2026, 19:00 Uhr') && nachricht.includes('https://example.org/theater'),
  'die Nachricht der Karte nennt Titel, Tag, Uhrzeit und Link');
const kalKarte = new URL(await karte.locator('a', { hasText: 'Kalender' }).getAttribute('href'));
check(kalKarte.searchParams.get('dates') === '20261103T190000/20261103T210000', 'Kalender-Knopf der Karte mit geschätztem Ende');
check(await karte.locator('a', { hasText: 'WhatsApp' }).getAttribute('target') === '_blank', 'Links öffnen außerhalb der App');

const strand = page.locator('#abschnitt-immer .karte', { hasText: 'Elbstrand' });
check(await strand.locator('a', { hasText: 'Kalender' }).count() === 0, 'Ausflugsziel ohne Datum: kein Kalender-Knopf');
const waStrand = decodeURIComponent((await strand.locator('a', { hasText: 'WhatsApp' }).getAttribute('href')).split('text=')[1]);
check(waStrand.includes('🕒 jederzeit'), 'Ausflugsziel: Nachricht nennt die Zeiten');

const film = whatsappText({ ...termin, titel: 'Der Pate', imdb: '2', unsicher: 'Uhrzeit laut Kino vorläufig', preis: '' });
check(film.includes('⭐ IMDb Top 250, Platz 2') && film.includes('⚠️ Noch nicht sicher: Uhrzeit laut Kino vorläufig'), 'Kino: IMDb-Platz und Unsicheres stehen in der Nachricht');

await ende();
