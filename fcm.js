// ═══════════════════════════════════════════════════════
// RTV Scanner PWA — FCM Handler
// ═══════════════════════════════════════════════════════

const FCM_VAPID = 'BOzu3p_bCr0RP3L8E-hC2gcfRjH8Lx5eiXe6biNLR0CuUwiQuQdmBBt455rBQNxW_pf1M8gY-PXbQdGEiekLbDo';
const FB_URL = 'https://rtv-scaner-default-rtdb.asia-southeast1.firebasedatabase.app';
const FCM_CONFIG = {
  apiKey: "AIzaSyANB6LLCOSnZp8bTsi2IW3kOt7",
  authDomain: "rtv-scaner.firebaseapp.com",
  databaseURL: FB_URL,
  projectId: "rtv-scaner",
  storageBucket: "rtv-scaner.firebasestorage.app",
  messagingSenderId: "679661725568",
  appId: "1:679661725568:web:6147b2db4ece6"
};

let _fcmReady = false;
let _messaging = null;

// Load Firebase SDK secara berurutan
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function initFCM() {
  try {
    await loadScript('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

    const app = firebase.apps.length
      ? firebase.apps[0]
      : firebase.initializeApp(FCM_CONFIG);

    _messaging = firebase.messaging(app);
    _fcmReady = true;
    console.log('[FCM] Initialized');
  } catch(e) {
    console.log('[FCM] Init error:', e.message);
  }
}

// Daftarkan FCM token ke Firebase
async function registerFCMToken() {
  if (!_fcmReady || !_messaging) {
    console.log('[FCM] Not ready yet, retrying...');
    setTimeout(registerFCMToken, 2000);
    return;
  }

  try {
    // Cek izin notifikasi
    if (Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        console.log('[FCM] Permission denied');
        return;
      }
    }

    // Dapatkan token FCM
    const token = await _messaging.getToken({ vapidKey: FCM_VAPID });
    if (!token) {
      console.log('[FCM] No token received');
      return;
    }

    console.log('[FCM] Token:', token.substring(0, 30) + '...');

    // Simpan token ke Firebase via REST
    const deviceKey = 'dev_' + token.substring(0, 16).replace(/[^a-zA-Z0-9]/g, '_');
    const res = await fetch(`${FB_URL}/app/fcmTokens/${deviceKey}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(token)
    });

    if (res.ok) {
      console.log('[FCM] Token saved to Firebase:', deviceKey);
      // Tampilkan status di UI jika ada
      const statusEl = document.getElementById('fcm-status');
      if (statusEl) statusEl.textContent = '✅ Notifikasi FCM aktif';
    }

    // Handle notif saat app terbuka (foreground)
    _messaging.onMessage(payload => {
      const { title, body } = payload.notification || {};
      if (!title) return;
      console.log('[FCM] Foreground message:', title);
      if (typeof toast === 'function') {
        toast('🔔 ' + title + ': ' + (body || ''), '#1e3a5f', 6000);
      }
      // Tampilkan notif native via SW
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            body: body || '',
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            vibrate: [200, 100, 200]
          });
        });
      }
    });

    // Handle token refresh
    _messaging.onTokenRefresh(async () => {
      const newToken = await _messaging.getToken({ vapidKey: FCM_VAPID });
      if (newToken) {
        await fetch(`${FB_URL}/app/fcmTokens/${deviceKey}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newToken)
        });
        console.log('[FCM] Token refreshed');
      }
    });

  } catch(e) {
    console.log('[FCM] Token error:', e.message);
    const statusEl = document.getElementById('fcm-status');
    if (statusEl) statusEl.textContent = '❌ FCM Error: ' + e.message;
  }
}

// Init saat halaman siap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFCM);
} else {
  initFCM();
}
