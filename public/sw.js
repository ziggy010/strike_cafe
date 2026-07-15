// Strike Yard service worker — offline caching for the static-exported PWA.
// Scope is derived from where this file is served (e.g. "/" or "/strike_cafe/"),
// so it works both locally and on GitHub Pages without hardcoding the base path.

const VERSION = "sy-v1";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;
const SCOPE = self.registration.scope; // full URL, ends with "/"

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// Treat hashed build output and media as long-lived, cacheable assets.
function isStaticAsset(url) {
  return (
    url.pathname.includes("/_next/static/") ||
    url.pathname.includes("/food/") ||
    /\.(?:js|css|woff2?|png|jpe?g|webp|svg|ico)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // never cache orders/mutations

  const url = new URL(request.url);
  // Only handle same-origin requests inside our scope. Supabase (realtime + REST)
  // is cross-origin and passes straight through to the network.
  if (url.origin !== self.location.origin) return;
  if (!url.href.startsWith(SCOPE) && url.pathname !== new URL(SCOPE).pathname) return;

  // App navigations: network-first so updates show, cache fallback for offline.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(PAGE_CACHE);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match(request);
          return cached || (await caches.match(SCOPE)) || Response.error();
        }
      })(),
    );
    return;
  }

  // Static assets: stale-while-revalidate — instant from cache, refresh in bg.
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })(),
    );
  }
});
