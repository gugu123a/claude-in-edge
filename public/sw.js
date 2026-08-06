const CACHE = "claudian-v2";
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./claude-logo.svg",
];

// Install
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

// Activate — clean old caches
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Fetch — cache-first for static, network-first for API
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Don't cache API calls
  if (url.pathname.startsWith("/api/")) return;

  // Navigation: network first, fallback to cache
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request, { cache: "reload" }).catch(() =>
        caches.match("./index.html"),
      ),
    );
    return;
  }

  // Static assets: cache first, fallback to network
  if (e.request.method === "GET" && url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        const fetchPromise = fetch(e.request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        });
        return cached || fetchPromise;
      }),
    );
  }
});
