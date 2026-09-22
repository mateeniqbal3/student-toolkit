/*
 * Hand-rolled service worker.
 *
 * Deliberately not next-pwa: that package is unmaintained against Next 15+,
 * and the caching this app needs is simple enough to be worth owning outright.
 *
 * Strategy, by request type:
 *   - navigations        network first, falling back to cache, then /offline
 *   - /_next/static/*    cache first (the filenames are content hashed)
 *   - fonts and images   stale while revalidate
 *   - /api/*             never cached
 *
 * Route chunks reach the cache because the home page links to every tool
 * and Next prefetches links as they enter the viewport; those prefetches pass
 * through the fetch handler below and land in the static cache.
 */

const VERSION = "v1";
const SHELL_CACHE = `shell-${VERSION}`;
const STATIC_CACHE = `static-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;
const OFFLINE_URL = "/offline";

const SHELL = ["/", OFFLINE_URL, "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Individually, so one 404 cannot fail the whole install.
      await Promise.allSettled(SHELL.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.endsWith(VERSION)).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

/*
 * Web Workers are started through one shared bootstrap script, told which
 * code to load by the URL's fragment (…/turbopack-worker.js#params=…). The
 * Cache API ignores fragments, so a cached response still carries the URL,
 * fragment and all, of whichever worker fetched it first, and a worker given
 * that response boots the other worker's code. The PDF tools run two workers
 * on one page and hung exactly this way. A copy built from the body has no
 * URL of its own, so the browser keeps the one the worker asked for.
 */
function withoutUrl(response) {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => hit);

  return hit ?? network;
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) ?? (await cache.match(OFFLINE_URL)) ?? Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The AI route must never be served from cache.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    const response = cacheFirst(request, STATIC_CACHE);
    event.respondWith(request.destination === "worker" ? response.then(withoutUrl) : response);
    return;
  }

  if (["font", "image", "style", "script"].includes(request.destination)) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
  }
});

// A tap on a pomodoro notification brings the timer back into view, opening
// it if the tab was closed.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const timer = windows.find((client) => new URL(client.url).pathname === "/pomodoro-timer");
      if (timer) return timer.focus();
      return self.clients.openWindow("/pomodoro-timer");
    })(),
  );
});

// Lets the page trigger an immediate update instead of waiting for a reload.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
