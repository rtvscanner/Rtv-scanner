// ═══════════════════════════════════════════════════════
// RTV Scanner — Firebase Messaging Service Worker
// File wajib untuk FCM background notifications
// ═══════════════════════════════════════════════════════
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

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

// Handle notif background (saat app tertutup)
messaging.onBackgroundMessage(payload => {
  console.log('[FCM SW] Background message:', payload);
  const { title, body } = payload.notification || {};
  if (!title) return;

  self.registration.showNotification(title, {
    body: body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: payload.data && payload.data.tag ? payload.data.tag : 'rtv-fcm',
    data: { url: 'https://armstrong-sabandar-rtv-scanner.vercel.app' }
  });
});

// Tap notifikasi → buka aplikasi
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url)
    || 'https://armstrong-sabandar-rtv-scanner.vercel.app';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('vercel.app') && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
