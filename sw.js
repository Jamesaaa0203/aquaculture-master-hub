/* Bon Aqua Ops — service worker (v2)
   Bump CACHE_VERSION whenever the shell changes so phones pull the new files.
   - App files: network first, cached copy when offline.
   - Router calls (script.google…): never cached.
   - Outbox: sent in the background on Android (Background Sync). */
importScripts('./queue.js');

const CACHE_VERSION = 'bonaqua-v27';
const SHELL = [
  './',
  './index.html',
  './app.css?v=2.3.5',
  './app.js?v=2.3.5',
  './queue.js?v=2.3.5',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

// No forced reload of open tabs: someone may be mid-entry.
// The next open of the app picks up the new version.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.includes('script.google') || url.hostname.includes('googleusercontent')) return;
  if (url.origin !== location.origin) return;

  // Same-origin: network first (always fresh when online), cache as fallback.
  event.respondWith(
    fetch(req).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(req.mode === 'navigate' ? './index.html' : req, copy));
      }
      return res;
    }).catch(() =>
      caches.match(req.mode === 'navigate' ? './index.html' : req, { ignoreSearch: req.mode === 'navigate' })
    )
  );
});

// Android: send waiting records even if the app is closed.
self.addEventListener('sync', (event) => {
  if (event.tag !== 'bq-flush') return;
  event.waitUntil(
    BQ.flush().then((r) =>
      self.clients.matchAll().then((cs) => cs.forEach((c) => c.postMessage('bq-outbox'))).then(() => {
        if (r && r.left > 0 && r.sent === 0) throw new Error('retry later');   // ask the browser to retry
      })
    )
  );
});
