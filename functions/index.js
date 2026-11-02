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
