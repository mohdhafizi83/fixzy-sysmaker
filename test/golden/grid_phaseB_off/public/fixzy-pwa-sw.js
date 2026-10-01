/* Fixzy SysMaker generated service worker (PWA shell).
 * Caches ONLY static assets (icons, css, js, manifest). Navigations and
 * all dynamic/admin routes always go to the network — an admin panel is
 * session-scoped and its HTML must NEVER be cached (a cached pre-login
 * redirect would break authenticated navigation). */
const CACHE = 'fixzy-pwa-v1';
const SHELL = ['/pwa-icon-192.png', '/pwa-icon-512.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;

    // Static assets only: cache-first with background fill.
    if (/\.(png|jpg|jpeg|svg|css|js|woff2?|webmanifest)$/.test(url.pathname)) {
        event.respondWith(
            caches.match(req).then((cached) => {
                const network = fetch(req)
                    .then((res) => {
                        if (res && res.ok) {
                            const copy = res.clone();
                            caches.open(CACHE).then((c) => c.put(req, copy));
                        }
                        return res;
                    })
                    .catch(() => cached || Response.error());
                return cached || network;
            })
        );
    }
    // Everything else (navigations, Livewire POSTs, admin routes):
    // untouched — straight to the network.
});
