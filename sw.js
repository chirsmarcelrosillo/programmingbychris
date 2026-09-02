/* =========================================================================
   SERVICE WORKER — offline support
   =========================================================================
   The whole app is one HTML file, so "works offline" just means keeping a
   copy of that file plus the icons.

   Strategy: network first, cache as backup. Chris updates the site often and
   a client on a phone must not get stuck on a months-old cached copy — so we
   always try the network, fall back to the cache when there's no signal.

   Bump CACHE_VERSION whenever the shell changes; old caches are deleted on
   activate so nothing lingers.
   ========================================================================= */
const CACHE_VERSION = "pt-v1";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      // addAll fails the whole install if any one file 404s, so add them
      // individually and tolerate a miss.
      .then(cache => Promise.all(SHELL.map(url =>
        cache.add(new Request(url, { cache: "reload" })).catch(() => null)
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;                       // never cache writes
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // leave third parties alone

  event.respondWith(
    fetch(req)
      .then(res => {
        // stash a fresh copy for next time we're offline
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then(hit =>
          hit || (req.mode === "navigate" ? caches.match("./index.html") : undefined)
        )
      )
  );
});

/* Let the page ask us to update immediately after it downloads a new version. */
self.addEventListener("message", e => {
  if (e.data === "skipWaiting") self.skipWaiting();
});
