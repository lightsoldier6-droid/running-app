const C = 'runplan-v54';
const FILES = ['.', 'index.html', 'data.js', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png'];
// install: bypassa la cache HTTP del browser (cache:'reload') così in cache finisce sempre la versione fresca
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())));
// pagina: network-first (aggiornamenti visibili al primo reload), offline: fallback alla cache
// altri file: cache-first
self.addEventListener('fetch', e => {
  const req = e.request;
  const isPage = req.mode === 'navigate' || /\/(index\.html)?$/.test(new URL(req.url).pathname);
  if (isPage) {
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(C).then(c => c.put(req, cp)); return r; }).catch(() => caches.match(req).then(r => r || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then(r => r || fetch(req)));
});
