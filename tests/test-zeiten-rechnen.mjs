/*
 * js/zeiten-rechnen.js: aus Kalenderterminen belegte Blöcke je Woche – in
 * Berliner Wanduhrzeit, über Mitternacht, Wochenwechsel und Zeitumstellung
 * hinweg. Ohne Browser.
 */
import { isDeepStrictEqual as gleich } from 'node:util';
import { belegteWochen, berlin, montagVon } from '../js/zeiten-rechnen.js';

let fails = 0;
let oks = 0;
const check = (c, m) => {
  console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`);
  if (c) oks++; else fails++;
};
const T = 24 * 60;

check(montagVon('2026-11-05') === '2026-11-02' && montagVon('2026-11-02') === '2026-11-02' && montagVon('2026-11-08') === '2026-11-02',
  'montagVon: Do, Mo und So landen auf demselben Montag');
check(gleich(berlin('2026-11-03T17:00:00Z'), { tag: '2026-11-03', minute: 18 * 60 }), 'berlin: 17 Uhr UTC ist im November 18 Uhr in Berlin');
check(gleich(berlin('2026-07-03T17:00:00Z'), { tag: '2026-07-03', minute: 19 * 60 }), '… im Juli 19 Uhr (Sommerzeit)');
check(berlin('kein Datum') === null, 'berlin: Unsinn ergibt null');

const w = belegteWochen([
  { start: '2026-11-03T18:00:00+01:00', ende: '2026-11-03T20:30:00+01:00' },
  { start: '2026-11-03T19:00:00Z', ende: '2026-11-03T20:00:00Z' }, // 20–21 Uhr Berlin, überlappt
  { start: '2026-11-05', ende: '2026-11-06', ganztags: true },
  { start: '2026-11-08T22:00:00+01:00', ende: '2026-11-09T02:00:00+01:00' },
  { start: '2026-10-30T10:00:00+01:00', ende: '2026-10-30T11:00:00+01:00' }, // vor dem Zeitraum
  { start: '2026-12-20T10:00:00+01:00', ende: '2026-12-20T11:00:00+01:00' }, // danach
  { start: '2026-11-04T10:00:00+01:00', ende: '2026-11-04T09:00:00+01:00' }, // Ende vor Beginn
  { titel: 'ohne Start' },
], '2026-11-02', 3);
check(gleich(Object.keys(w), ['2026-11-02', '2026-11-09', '2026-11-16']), 'drei Wochen ab Mo 2.11. – jede steht drin, auch leer');
check(gleich(w['2026-11-02'][0], [T + 18 * 60, T + 21 * 60]), 'Di 18:00–20:30 und 20–21 Uhr (in UTC angegeben) werden ein Block 18–21 Uhr');
check(gleich(w['2026-11-02'][1], [3 * T, 4 * T]), 'ganztägig am Do: 0–24 Uhr, Ende ausschließlich');
check(gleich(w['2026-11-02'][2], [6 * T + 22 * 60, 7 * T]) && gleich(w['2026-11-09'][0], [0, 2 * 60]),
  'So 22 Uhr bis Mo 2 Uhr: geteilt auf beide Wochen');
check(w['2026-11-02'].length === 3 && w['2026-11-09'].length === 1 && gleich(w['2026-11-16'], []),
  'was vor oder nach dem Zeitraum liegt oder kaputt ist, fällt weg');

const umstellung = belegteWochen([
  { start: '2027-03-28T01:00:00+01:00', ende: '2027-03-28T04:00:00+02:00' },
  { start: '2027-03-29T09:00:00+02:00', ende: '2027-03-29T10:00:00+02:00' },
], '2027-03-22', 2);
check(gleich(umstellung['2027-03-22'], [[6 * T + 60, 6 * T + 4 * 60]]), 'Zeitumstellung im März: 1 bis 4 Uhr Wanduhrzeit');
check(gleich(umstellung['2027-03-29'], [[9 * 60, 10 * 60]]), '… und danach Sommerzeit: Mo 9–10 Uhr');
const herbst = belegteWochen([{ start: '2026-10-25T01:30:00+02:00', ende: '2026-10-25T02:30:00+01:00' }], '2026-10-19', 1);
check(gleich(herbst['2026-10-19'], [[6 * T + 90, 6 * T + 150]]), 'Zeitumstellung im Oktober: 1:30 bis 2:30 Wanduhrzeit');
const zweiTage = belegteWochen([{ start: '2026-11-06', ende: '2026-11-09', ganztags: true }], '2026-11-02', 2);
check(gleich(zweiTage['2026-11-02'], [[4 * T, 7 * T]]) && gleich(zweiTage['2026-11-09'], []), 'ganztägig Fr–So (Ende Mo ausschließlich): bis Sonntag Mitternacht');

console.log(`${fails ? 'FEHLER' : 'Alles gut'}: ${oks} von ${oks + fails} Prüfungen bestanden.`);
process.exit(fails || !oks ? 1 : 0);
