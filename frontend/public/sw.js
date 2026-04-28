// Minimal Service Worker. Its main purpose is to register the site as a real
// PWA on iOS so that storage (localStorage / IndexedDB) is not aggressively
// cleared by Safari ITP. We do not implement offline caching here — requests
// pass through to the network.

const VERSION = "v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Pass-through — do not intercept. This is enough for iOS to treat the
  // origin as an installed PWA for storage purposes.
  return;
});
