/*
 * Die Edge Function freizeit-push als eine Datei – zum Einfügen im Supabase
 * Dashboard (Edge Functions → Deploy a new function → Via Editor), wo man nur
 * eine Datei einfügen kann.
 *
 *     node werkzeug/push-buendeln.mjs > /irgendwo/index.ts
 *
 * Die vier Dateien aus supabase/functions/freizeit-push kommen in der
 * Reihenfolge ihrer Abhängigkeiten hintereinander; die import- und
 * export-Zeilen zwischen ihnen fallen weg. Sonst ändert sich nichts – was
 * tests/test-push-senden.mjs an den Dateien prüft, gilt auch für das Bündel.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ORDNER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'functions', 'freizeit-push');
const REIHE = ['webpush.js', 'nachricht.js', 'lauf.js', 'index.ts'];

const teile = REIHE.map((datei) => {
  const quelle = readFileSync(path.join(ORDNER, datei), 'utf8')
    // Importe untereinander: weg – alles steht in derselben Datei.
    .replace(/^import \{[^}]*\} from '\.\/[a-z]+\.js';\n/gm, '')
    // Exporte: die Namen bleiben, nur das Wort fällt.
    .replace(/^export (const|async function|function|class) /gm, '$1 ');
  return `// ---- ${datei} ----\n${quelle.trim()}\n`;
});

process.stdout.write(`${'/*\n * freizeit-push, gebündelt aus supabase/functions/freizeit-push (werkzeug/push-buendeln.mjs).\n * Nicht von Hand ändern – die Quelle sind die vier Dateien im Repository.\n */'}\n${teile.join('\n')}`);
