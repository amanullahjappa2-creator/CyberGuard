const CACHE_NAME = "cyberguard-static-v17";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./teacher.html",
  "./manifest.webmanifest",
  "./assets/cyberguard.svg",
  "./assets/fonts/inter-latin.woff2",
  "./assets/fonts/jetbrains-mono-latin.woff2",
  "./assets/fonts/noto-naskh-arabic-regular.woff2",
  "./assets/fonts/noto-naskh-arabic-bold.woff2",
  "./css/style.css",
  "./js/ui.js",
  "./js/engine.js",
  "./js/adaptive.js",
  "./js/scoreboard.js",
  "./js/teacher.js",
  "./js/storage.js",
  "./js/levels/renderers.js",
  "./lang/en.json",
  "./lang/ur.json",
  "./level-catalog.json",
  ...Array.from({ length: 30 }, (_, index) => `./levels/level${String(index + 1).padStart(2, "0")}.json`),
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("cyberguard-static-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  if (/\/api(?:\/|$)/.test(new URL(event.request.url).pathname)) return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch((error) => {
        if (event.request.mode === "navigate") return caches.match("./index.html");
        throw error;
      });
    }),
  );
});
