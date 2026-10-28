/*
 * Edge Function freizeit-push: Dem Gastgeber Bescheid sagen, wenn jemand in
 * seinen Plan eintritt, etwas anhakt oder geht.
 *
 *   POST  Die Datenbank stößt sie nach jeder neuen Nachricht an (pg_net,
 *         siehe supabase/gemeinsam.sql, PUSH); sie holt dann alles Offene
 *         mit dem Betreiber-Schlüssel ab und schickt es verschlüsselt an die
 *         Geräte.
 *   GET   Der öffentliche VAPID-Schlüssel für die App (js/push.js), wenn
 *         ein Gerät sich anmeldet – { "oeffentlich": "…" }.
 *
 * Der Aufruf braucht keinen Ausweis (verify_jwt aus): Wer sie anstößt, löst
 * nur aus, was ohnehin anstünde, und der öffentliche Schlüssel ist
 * öffentlich. Ihr Schlüsselpaar erzeugt sie beim ersten Lauf selbst und legt
 * es in der Datenbank ab; SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY setzt
 * Supabase von selbst. Geheimnisse von Hand braucht es keine.
 */
import { lauf, vapidHolen } from './lauf.js';

const KOPF = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type' };
const antwort = (body: unknown, status = 200) => Response.json(body, { status, headers: KOPF });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: KOPF });
  const url = Deno.env.get('SUPABASE_URL') || '';
  const schluessel = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !schluessel) return antwort({ fehler: 'SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt' }, 500);
  try {
    if (req.method === 'GET') {
      const { oeffentlich } = await vapidHolen({ url, schluessel });
      return antwort({ oeffentlich });
    }
    const ergebnis = await lauf({ url, schluessel });
    // Jeder Lauf eine Zeile im Protokoll (Supabase → Edge Functions → Logs): was raus ging und was die Dienste sagten.
    if (ergebnis.nachrichten) console.log('freizeit-push:', JSON.stringify(ergebnis));
    if (ergebnis.fehler.length) console.warn('freizeit-push:', ergebnis.fehler.join(' | '));
    return antwort(ergebnis);
  } catch (e) {
    console.error('freizeit-push:', e);
    return antwort({ fehler: String(e && (e as Error).message ? (e as Error).message : e) }, 500);
  }
});
