const CACHE_NAME = 'pipah-cache-v3';
const DYNAMIC_CACHE = 'pipah-images-v3';

// 1. Files to cache immediately (App Shell)
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './admin.html',    // Important for your admin panel
  './invois.html',   // Important for checkout
  './Images/icon.png',
  './Images/offline.png', // ⚠️ Make sure this file exists!
  // External libraries (Optional but recommended for offline styling)
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Outfit:wght@300;400;500;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// --- INSTALL ---
self.addEventListener('install', event => {
  self.skipWaiting(); // Force new worker to take over immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching App Shell');
      return cache.addAll(urlsToCache);
    })
  );
});

// --- ACTIVATE (Cleanup) ---
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME && key !== DYNAMIC_CACHE) {
          console.log('[SW] Removing old cache:', key);
          return caches.delete(key);
        }
      })
    ))
  );
  return self.clients.claim();
});

// --- FETCH (The Logic) ---
self.addEventListener('fetch', event => {
  const req = event.request;

  // STRATEGY 1: Handle Images (Firebase Storage & Others)
  // Logic: Cache First -> Network (save to cache) -> Offline Placeholder
  if (req.url.includes('firebasestorage.googleapis.com') || 
      req.url.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
      
    event.respondWith(
      caches.match(req).then(cachedResponse => {
        if (cachedResponse) return cachedResponse; // Hit Cache

        return fetch(req).then(networkResponse => {
          return caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(req, networkResponse.clone()); // Save for next time
            return networkResponse;
          });
        }).catch(() => {
           // Network failed? Show placeholder
           return caches.match('./Images/offline.png');
        });
      })
    );
    return; // Stop here for images
  }

  // STRATEGY 2: Handle HTML/Admin/Everything else
  // Logic: Network First (Fresh content) -> Fallback to Cache
  event.respondWith(
    fetch(req).catch(() => {
      return caches.match(req);
    })
  );
});
