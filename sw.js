// ═══════════════════════════════════════════════════════
// RTV Scanner PWA — Service Worker
// ═══════════════════════════════════════════════════════
const CACHE_NAME = 'rtv-scanner-v2';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// ── INSTALL ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// ── FETCH ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if(url.hostname.includes('firebasedatabase.app') ||
     url.hostname.includes('firebase.google.com') ||
     url.hostname.includes('googleapis.com')) return;

  event.respondWith(
    fetch(event.request).then(response => {
      if(response && response.status === 200 && event.request.method === 'GET'){
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => {
      return caches.match(event.request).then(cached => cached || caches.match('/index.html'));
    })
  );
});

// ── NOTIFIKASI dari aplikasi ──
self.addEventListener('message', event => {
  if(event.data && event.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
  }
  // Terima perintah kirim notif dari aplikasi
  if(event.data && event.data.type === 'SEND_NOTIF'){
    self.registration.showNotification(event.data.title, {
      body: event.data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      tag: event.data.tag || 'rtv-notif'
    });
  }
});

// ── Tap notifikasi → buka aplikasi ──
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({type:'window', includeUncontrolled:true}).then(clientList => {
      for(const client of clientList){
        if(client.url.includes(self.location.origin) && 'focus' in client){
          return client.focus();
        }
      }
      if(clients.openWindow) return clients.openWindow('/');
    })
  );
});
