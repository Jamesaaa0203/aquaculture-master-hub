/* Bon Aqua Ops — service worker
   Bump CACHE_VERSION whenever you deploy changes so phones pull the new shell. */
const CACHE_VERSION = 'bonaqua-v2';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

// Install: pre-cache the local app shell.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

// Activate: drop old caches, take control of open tabs.
//
// NOTE: this used to also force every open window to navigate(client.url)
// right here — i.e. hard-reload any open copy of the app the instant a new
// version took over, with no regard for what that tab was doing. That's a
// real problem for a farm-ops app people are actively entering data into:
// if someone was mid-submission (especially anything that takes more than
// an instant, like the batched tank-check flow, which fires several
// sequential save requests in a row) and a new deploy happened to activate
// in the background at that exact moment, their in-progress page got torn
// out from under them and reloaded mid-flight — which is what produced the
// garbled, unstyled "wall of raw text" page.
//
// Removing the forced navigate() doesn't break updates — self.clients.claim()
// below still means the NEXT navigation (next time someone opens/reopens
// the app) picks up the new version immediately. Updates just no longer
// interrupt someone who's actively using it right now.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never cache the Google Apps Script data calls — always go to network.
  if (url.hostname.includes('script.google') || url.hostname.includes('googleusercontent')) return;

  // Navigations: network-first, fall back to cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        // Only cache a genuinely good response. Caching whatever comes
        // back unconditionally (including a mid-deploy hiccup, a 404, or
        // anything else non-200) would poison the offline fallback with
        // a broken page that then keeps getting served every time the
        // network fails afterwards.
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put('./index.html', copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // CDN (Tailwind, fonts) + everything else: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.status === 200 && (url.origin === location.origin || url.hostname.includes('jsdelivr') || url.hostname.includes('gstatic') || url.hostname.includes('googleapis'))) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
