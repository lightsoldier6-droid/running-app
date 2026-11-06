const C = 'runplan-v130';
const FILES = ['.', 'index.html', 'data.js', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png', 'css/app.css', 'js/date.js', 'js/core.js', 'js/cloud.js', 'js/util.js', 'js/oggi.js', 'js/progressi.js', 'js/piano.js', 'js/monitor.js', 'js/dati.js', 'js/corsa.js', 'js/fc.js', 'js/import-fit.js', 'js/forma.js', 'js/gara.js', 'js/archivio.js', 'js/strategia.js', 'js/init.js', 'gym-bridge.js', 'palestra/index.html', 'palestra/data.js', 'palestra/engine.js', 'palestra/app.js', 'palestra/palestra.css'];
const OPTIONAL = ['https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js','https://www.gstatic.com/firebasejs/10.13.2/firebase-auth-compat.js','https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore-compat.js'];
// install: bypassa la cache HTTP del browser (cache:'reload') così in cache finisce sempre la versione fresca
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => caches.open(C).then(c => Promise.allSettled(OPTIONAL.map(url => c.add(new Request(url,{mode:'cors'})))))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('runplan-') && k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())));
// Ogni versione serve SOLO i file della propria cache (C), pagina compresa. Prima la pagina arrivava dalla rete e
// gli script da caches.match, che cerca in TUTTE le cache (anche in quella di una versione nuova ancora in
// attesa): durante un aggiornamento index e script potevano essere di versioni diverse e il browser scartava
// qualche file ("already declared"). Ora la versione cambia tutta insieme, quando il service worker nuovo si
// attiva (chiudendo e riaprendo l'app). Le navigazioni ignorano la query (?embed=runplan della Palestra).
// Fuori dalla cache (dati, meteo, Firebase) si va in rete; offline la pagina ripiega su index.html.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isPage = req.mode === 'navigate' || (url.origin === self.location.origin && /\/(index\.html)?$/.test(url.pathname));
  e.respondWith(caches.open(C).then(async c => {
    const hit = await c.match(req, { ignoreSearch: isPage });
    if (hit) return hit;
    if (!isPage) return fetch(req);
    try { return await fetch(req); }
    catch (err) { return (await c.match(url.pathname.includes('/palestra/') ? 'palestra/index.html' : 'index.html')) || Promise.reject(err); }
  }));
});
// notifica push di fine recupero della Palestra (functions/index.js). iOS vuole sempre una notifica visibile:
// se l'app è già aperta in primo piano (lì suona già il timer) la si mostra e la si toglie subito.
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch {}
  const tag = d.tag || 'rest';
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const front = wins.some(c => c.visibilityState === 'visible' && c.focused);
    await self.registration.showNotification(d.title || 'RunPlan', { body: d.body || '', tag, renotify: true, icon: 'icon-180.png', data: { url: './' } });
    if (front) (await self.registration.getNotifications({ tag })).forEach(n => n.close());
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
    const w = wins.find(c => 'focus' in c);
    return w ? w.focus() : self.clients.openWindow(self.registration.scope);
  }));
});
