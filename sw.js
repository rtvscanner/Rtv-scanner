// ═══════════════════════════════════════════════════════
// RTV Scanner PWA — Service Worker + FCM Push Handler
// ═══════════════════════════════════════════════════════
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

const CACHE_NAME = 'rtv-scanner-v3';
const APP_URL = 'https://armstrong-sabandar-rtv-scanner.vercel.app';

// Inisialisasi Firebase di Service Worker
firebase.initializeApp({
  apiKey: "AIzaSyANB6LLCOSnZp8bTsi2IW3kOt7pOZ4olpw",
  authDomain: "rtv-scaner.firebaseapp.com",
  databaseURL: "https://rtv-scaner-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "rtv-scaner",
  storageBucket: "rtv-scaner.firebasestorage.app",
  messagingSenderId: "679661725568",
  appId: "1:679661725568:web:6147b2db4ece6d810a4365"
});

const messaging = firebase.messaging();

// ── Handle notif background (app tertutup) ──
messaging.onBackgroundMessage(payload => {
  console.log('FCM background message:', payload);
  const { title, body } = payload.notification || {};
  if (!title) return;
  self.registration.showNotification(title, {
    body: body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: payload.data && payload.data.tag ? payload.data.tag : 'rtv-fcm',
    data: { url: APP_URL }
  });
});

// ── INSTALL ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png']);
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.hostname.includes('firebasedatabase.app') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com')) return;
  event.respondWith(
    fetch(event.request).then(response => {
      if (response && response.status === 200 && event.request.method === 'GET') {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() =>
      caches.match(event.request).then(cached => cached || caches.match('/index.html'))
    )
  );
});

// ── Tap notifikasi → buka aplikasi ──
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || APP_URL;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ── Update handler ──
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
