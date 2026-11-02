'use strict';
/* Notifiche push di fine recupero della Palestra di RunPlan.
   Il timer di recupero gira nella pagina, ma a telefono bloccato iOS sospende la pagina: il beep non suona.
   Allora la pagina, quando parte un recupero, chiede al server di mandarle una notifica push all'ora di fine:
   - restSchedule (chiamata dall'app, solo utenti con accesso): mette in coda in Cloud Tasks un invio
     all'ora di fine recupero; se c'era un recupero precedente ancora in coda lo toglie;
   - restCancel: toglie l'invio in coda (recupero saltato, allenamento chiuso);
   - restFire: eseguita da Cloud Tasks all'ora giusta, manda la notifica Web Push (standard VAPID) al dispositivo.
   Nessun dato salvato: l'indirizzo push del dispositivo viaggia dentro il task.
   Chiavi VAPID in functions/.env (solo in locale, non su GitHub). */
const { setGlobalOptions } = require('firebase-functions/v2');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onTaskDispatched } = require('firebase-functions/v2/tasks');
const logger = require('firebase-functions/logger');
const { initializeApp } = require('firebase-admin/app');
const { getFunctions } = require('firebase-admin/functions');
const webpush = require('web-push');

initializeApp();
const REGION = 'europe-west1';
// maxInstances basso: anche con un bug o un abuso la spesa resta limitata
setGlobalOptions({ region: REGION, maxInstances: 2 });

const queue = () => getFunctions().taskQueue(`locations/${REGION}/functions/restFire`);
const ID = /^[a-f0-9]{32}$/;
// solo i servizi push dei browser: la funzione non deve poter chiamare indirizzi qualsiasi
const PUSH_HOSTS = /(^|\.)(push\.apple\.com|fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com)$/;
const MAX_AHEAD = 65 * 60 * 1000; // il timer manuale arriva a 60 minuti

function cleanSub(s) {
  let url;
  try { url = new URL(s?.endpoint); } catch { url = null; }
  const ok = url && url.protocol === 'https:' && PUSH_HOSTS.test(url.hostname) && s.endpoint.length < 1000
    && typeof s.keys?.p256dh === 'string' && s.keys.p256dh.length < 200 && typeof s.keys?.auth === 'string' && s.keys.auth.length < 100;
  if (!ok) throw new HttpsError('invalid-argument', 'Iscrizione push non valida');
  return { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } };
}
const text = (s, max, def) => (typeof s === 'string' && s.trim() ? s.trim().slice(0, max) : def);

async function drop(id) {
  if (!ID.test(id || '')) return;
  try { await queue().delete(id); } catch (e) { if (e?.code !== 'functions/not-found') logger.warn('restCancel', e?.code || e?.message); }
}

exports.restSchedule = onCall(async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Serve l’accesso a RunPlan');
  const d = req.data || {};
  if (!ID.test(d.id || '')) throw new HttpsError('invalid-argument', 'id non valido');
  const at = Number(d.at), now = Date.now();
  if (!Number.isFinite(at) || at < now - 5000 || at > now + MAX_AHEAD) throw new HttpsError('invalid-argument', 'Ora di fine non valida');
  const sub = cleanSub(d.sub);
  const prev = d.prev && d.prev !== d.id ? drop(d.prev) : null;
  await queue().enqueue(
    { sub, title: text(d.title, 60, 'Recupero finito'), body: text(d.body, 120, 'Prossima serie.'), at },
    { id: d.id, scheduleTime: new Date(Math.max(at, now)), dispatchDeadlineSeconds: 30 },
  );
  await prev;
  return { ok: true };
});

exports.restCancel = onCall(async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Serve l’accesso a RunPlan');
  await drop(req.data?.id);
  return { ok: true };
});

exports.restFire = onTaskDispatched({ retryConfig: { maxAttempts: 2, minBackoffSeconds: 2 }, rateLimits: { maxConcurrentDispatches: 10 } }, async req => {
  const { sub, title, body, at } = req.data || {};
  if (Date.now() - at > 2 * 60 * 1000) return; // troppo tardi: non serve più
  webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC, process.env.VAPID_PRIVATE);
  try {
    await webpush.sendNotification(cleanSub(sub), JSON.stringify({ title, body, tag: 'rest', at }), { TTL: 120, urgency: 'high' });
  } catch (e) {
    // 404/410: il dispositivo ha tolto l'iscrizione; non si riprova
    if (e?.statusCode === 404 || e?.statusCode === 410) return logger.info('iscrizione push scaduta');
    logger.error('invio push', e?.statusCode, e?.body || e?.message);
    throw e;
  }
});

/* ---------- Garmin: "Sincronizza ora" (API personale di Garmin Connect) ----------
   La chiama SOLO il pulsante dell'app (niente interrogazioni pianificate: nessuna chiamata inutile).
   Scambia la chiave personale (segreto GARMIN_PERSONAL_API_KEY in Secret Manager) con un token di 24 ore,
   elenca le ultime attività e restituisce gli ZIP originali (.FIT) di quelle nuove: l'app li importa col
   suo parser, come un import manuale. Nessun dato salvato sul server.
   Riservata al proprietario: account di RunPlan con l'email GARMIN_OWNER_EMAIL (functions/.env, solo in
   locale). In Firebase Auth un'email appartiene a un solo account, quindi nessun altro può usarla.
   Solo corse e attività cardio: la forza no, perché la registra già la Palestra di RunPlan (doppioni).
   Endpoint dal client ufficiale github.com/garmin/connect-personal-api-python. */
const { defineSecret } = require('firebase-functions/params');
const GARMIN_KEY = defineSecret('GARMIN_PERSONAL_API_KEY');
const GARMIN = 'https://personal.connectapi.garmin.com';
const SYNC_TYPES = /run|cycl|bik|walk|hik|swim/i;
const typeOf = a => String((a && a.activityType && a.activityType.typeKey) || (a && a.activityType) || '');

exports.garminSync = onCall({ secrets: [GARMIN_KEY], timeoutSeconds: 120, memory: '512MiB', maxInstances: 1 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Serve l’accesso a RunPlan');
  const owner = String(process.env.GARMIN_OWNER_EMAIL || '').trim().toLowerCase();
  const email = String(req.auth.token.email || '').toLowerCase();
  if (!owner || email !== owner) throw new HttpsError('permission-denied', 'La sincronizzazione Garmin è riservata al proprietario');
  const d = req.data || {};
  const known = new Set((Array.isArray(d.known) ? d.known : []).slice(-1000).map(String));
  const after = typeof d.after === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.after) ? d.after : null;
  const max = Math.min(5, Math.max(1, Number(d.max) || 5));

  // 1) chiave → token (POST con corpo vuoto, come il client ufficiale)
  const tr = await fetch(`${GARMIN}/personalapitoken-service/personal-api/personal-api-key/token`, {
    method: 'POST', body: new Uint8Array(0), headers: { Accept: '*/*', Authorization: `ApiKey ${GARMIN_KEY.value().trim()}` },
  });
  if (!tr.ok) {
    logger.warn('garmin token', tr.status, (await tr.text()).slice(0, 200));
    throw new HttpsError('failed-precondition', tr.status === 401 || tr.status === 400 || tr.status === 403
      ? 'Garmin ha rifiutato la chiave: forse è scaduta o è stata revocata. Creane una nuova e aggiorna il segreto.'
      : `Garmin non risponde (token, HTTP ${tr.status}). Riprova più tardi.`);
  }
  const auth = { Authorization: `Bearer ${(await tr.text()).trim()}` };

  // 2) ultime attività
  const lr = await fetch(`${GARMIN}/activitylist-service/activities/search/activities?start=0&limit=20`, { headers: { ...auth, Accept: 'application/json' } });
  if (!lr.ok) throw new HttpsError('unavailable', `Garmin non risponde (elenco attività, HTTP ${lr.status}). Riprova più tardi.`);
  const body = await lr.json();
  const list = Array.isArray(body) ? body : (body.activityList || body.activities || []);
  const fresh = list.filter(a => a && a.activityId && SYNC_TYPES.test(typeOf(a)) && !known.has(String(a.activityId))
    && (!after || String(a.startTimeLocal || '').slice(0, 10) >= after))
    .sort((a, b) => String(a.startTimeLocal).localeCompare(String(b.startTimeLocal))); // dalla più vecchia
  const pick = fresh.slice(0, max);

  // 3) file originali (ZIP con il .FIT)
  const files = [], errors = [];
  for (const a of pick) {
    const r = await fetch(`${GARMIN}/download-service/files/activity/${a.activityId}`, { headers: { ...auth, Accept: 'application/x-zip-compressed' } });
    if (!r.ok) { errors.push(`${a.activityId}: HTTP ${r.status}`); continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 8e6) { errors.push(`${a.activityId}: file troppo grande`); continue; }
    files.push({ id: String(a.activityId), name: String(a.activityName || '').slice(0, 100), start: String(a.startTimeLocal || ''), type: typeOf(a), zip: buf.toString('base64') });
  }
  if (errors.length) logger.warn('garmin download', errors);
  return { files, more: fresh.length > pick.length, seen: list.length, errors };
});
