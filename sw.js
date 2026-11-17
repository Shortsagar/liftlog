// LiftLog service worker: precaches the whole app so it runs fully offline.
// VERSION and PRECACHE are maintained by tools/build-sw.mjs — run it after changing app files.
const VERSION = '12e3b44079';
const CACHE = `liftlog-${VERSION}`;
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/backup.js',
  './js/celebrate.js',
  './js/chart.js',
  './js/db.js',
  './js/demo.js',
  './js/figure.js',
  './js/model.js',
  './js/picker.js',
  './js/plan-store.js',
  './js/plans.js',
  './js/progress.js',
  './js/repo.js',
  './js/rig.js',
  './js/state.js',
  './js/timer-core.js',
  './js/timer.js',
  './js/ui.js',
  './js/views/body.js',
  './js/views/exercise.js',
  './js/views/library.js',
  './js/views/log.js',
  './js/views/plan-detail.js',
  './js/views/plan-edit.js',
  './js/views/plans.js',
  './js/views/progress.js',
  './js/views/session.js',
  './js/views/settings.js',
  './js/views/today.js',
  './js/workout.js',
  './data/exercises.js',
  './data/plans.js',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/icon.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE.map(p => new Request(p, { cache: 'reload' })))));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('liftlog-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// Cache-first for our own files; navigations fall back to the cached app shell.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (req.mode === 'navigate') {
      return (await cache.match('./index.html')) || (await cache.match('./')) || fetch(req);
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (e) {
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});
