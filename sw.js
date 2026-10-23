const C = 'runplan-v116';
const FILES = ['.', 'index.html', 'data.js', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png', 'css/app.css', 'js/core.js', 'js/cloud.js', 'js/util.js', 'js/oggi.js', 'js/progressi.js', 'js/piano.js', 'js/monitor.js', 'js/dati.js', 'js/corsa.js', 'js/fc.js', 'js/import-fit.js', 'js/forma.js', 'js/gara.js', 'js/archivio.js', 'js/init.js', 'gym-bridge.js', 'palestra/index.html', 'palestra/data.js', 'palestra/engine.js', 'palestra/app.js', 'palestra/palestra.css'];
const OPTIONAL = ['https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js','https://www.gstatic.com/firebasejs/10.13.2/firebase-auth-compat.js','https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore-compat.js'];
// install: bypassa la cache HTTP del browser (cache:'reload') così in cache finisce sempre la versione fresca
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => caches.open(C).then(c => Promise.allSettled(OPTIONAL.map(url => c.add(new Request(url,{mode:'cors'})))))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('runplan-') && k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())));
// pagina: network-first (aggiornamenti visibili al primo reload), offline: fallback alla cache
// altri file: cache-first
self.addEventListener('fetch', e => {
  const req = e.request;
  const isPage = req.mode === 'navigate' || /\/(index\.html)?$/.test(new URL(req.url).pathname);
  if (isPage) {
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(C).then(c => c.put(req, cp)); return r; }).catch(() => caches.match(req).then(r => r || caches.match(new URL(req.url).pathname.includes('/palestra/')?'palestra/index.html':'index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then(r => r || fetch(req)));
});
