// DK-AI service worker
// Caches the app's own interface files so it loads instantly and can be
// installed as an app. It does NOT cache AI replies - those always need
// a live internet connection.

const CACHE_NAME = "dk-ai-shell-v2";
const SHELL_FILES = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls - chat/search must always be live
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // For app shell files: try cache first, fall back to network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).catch(() => {
          // if offline and not cached, just fail gracefully
        })
      );
    })
  );
});
