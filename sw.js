// ═══════════════════════════════════════════════════
// RTV Scanner PWA — Service Worker
// Versi cache: update angka ini setiap kali deploy baru
// ═══════════════════════════════════════════════════
const CACHE_NAME = 'rtv-scanner-v1';

// File yang di-cache untuk akses offline
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// ── INSTALL: cache semua aset penting ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => {
      // Langsung aktif tanpa menunggu tab lama ditutup
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE: hapus cache lama ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    }).then(() => {
      // Ambil alih semua tab yang terbuka
      return self.clients.claim();
    })
  );
});

// ── FETCH: strategi Network First ──
// Prioritas: ambil dari jaringan, fallback ke cache jika offline
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Jangan intercept request ke Firebase (biarkan langsung ke server)
  if (url.hostname.includes('firebasedatabase.app') ||
      url.hostname.includes('firebase.google.com') ||
      url.hostname.includes('googleapis.com')) {
    return;
  }

  // Untuk aset aplikasi: Network First
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Simpan response baru ke cache jika berhasil
        if (response && response.status === 200 && event.request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline: ambil dari cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Fallback ke index.html jika tidak ada di cache
          return caches.match('/index.html');
        });
      })
  );
});

// ── UPDATE NOTIFICATION ──
// Kirim pesan ke semua tab bahwa ada versi baru
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
