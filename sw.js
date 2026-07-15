const CACHE_NAME = 'nutritrack-v2';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* Network-first para el HTML/CSS/JS de la app: siempre intenta traer la version
   mas nueva del servidor primero, y solo usa la copia guardada si no hay internet.
   Asi las actualizaciones futuras se ven de inmediato sin tener que reinstalar. */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isCoreFile = ASSETS.some(a => url.pathname.endsWith(a.replace('./', '/')) || url.pathname.endsWith(a.replace('./', '')));

  if (isCoreFile || event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(res => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
        return res;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(res => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
        return res;
      }).catch(() => cached);
    })
  );
});
