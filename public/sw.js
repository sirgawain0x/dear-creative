/* Only cache the public offline screen. Never store article, account, or wallet responses. */
const OFFLINE_CACHE = "dear-creative-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then((cache) => cache.add(OFFLINE_URL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith("dear-creative-offline-") && key !== OFFLINE_CACHE)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.mode !== "navigate" ||
    new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(fetch(event.request).catch(async () => {
    return (await caches.match(OFFLINE_URL)) || Response.error();
  }));
});
