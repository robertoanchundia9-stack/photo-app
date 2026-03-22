self.addEventListener('install', (e) => {
  console.log('[Service Worker] Install');
});

self.addEventListener('fetch', (e) => {
  // Simple pass-through fetch since local media is dynamic and we don't want to offline cache huge videos.
  e.respondWith(fetch(e.request));
});
