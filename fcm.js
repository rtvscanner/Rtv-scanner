// ═══════════════════════════════════════════════════════
// RTV Scanner PWA — FCM Handler
// Firebase Cloud Messaging untuk notifikasi background
// ═══════════════════════════════════════════════════════

// Load Firebase SDK
(function loadFirebaseSDK() {
  const scripts = [
    'https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js'
  ];
  scripts.forEach(src => {
    const s = document.createElement('script');
    s.src = src;
    document.head.appendChild(s);
  });
})();

const FCM_VAPID = 'BOzu3p_bCr0RP3L8E-hC2gcfRjH8Lx5eiXe6biNLR0CuUwiQuQdmBBt455rBQNxW_pf1M8gY-PXbQdGEiekLbDo';

let _fcmMessaging = null;

function initFCM() {
  try {
    if (typeof firebase === 'undefined') {
      setTimeout(initFCM, 500);
      return;
    }
    const apps = firebase.apps;
    const app = apps.length ? apps[0] : firebase.initializeApp({
      apiKey: "AIzaSyANB6LLCOSnZp8bTsi2IW3kOt7",
      authDomain: "rtv-scaner.firebaseapp.com",
      databaseURL: "https://rtv-scaner-default-rtdb.asia-southeast1.firebasedatabase.app",
      projectId: "rtv-scaner",
      storageBucket: "rtv-scaner.firebasestorage.app",
      messagingSenderId: "679661725568",
      appId: "1:679661725568:web:6147b2db4ece6"
    });
    _fcmMessaging = firebase.messaging(app);
    console.log('FCM initialized');
  } catch(e) {
    console.log('FCM init error:', e);
  }
}

// Daftarkan FCM token ke Firebase Database
async function registerFCMToken() {
  if (!_fcmMessaging) {
    initFCM();
    setTimeout(registerFCMToken, 1500);
    return;
  }
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return;

    const token = await _fcmMessaging.getToken({ vapidKey: FCM_VAPID });
    if (!token) return;

    // Key unik per HP
    const deviceKey = 'dev_' + btoa(token.substring(0, 20))
      .replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);

    // Simpan ke Firebase — pakai REST langsung
    const FB_URL = 'https://rtv-scaner-default-rtdb.asia-southeast1.firebasedatabase.app';
    await fetch(FB_URL + '/app/fcmTokens/' + deviceKey + '.json', {
      method: 'PUT',
      body: JSON.stringify(token)
    });
    console.log('FCM token terdaftar:', deviceKey);

    // Handle token refresh
    _fcmMessaging.onTokenRefresh(async () => {
      const newToken = await _fcmMessaging.getToken({ vapidKey: FCM_VAPID });
      if (newToken) {
        await fetch(FB_URL + '/app/fcmTokens/' + deviceKey + '.json', {
          method: 'PUT',
          body: JSON.stringify(newToken)
        });
      }
    });

    // Handle notif saat app terbuka (foreground)
    _fcmMessaging.onMessage(payload => {
      const { title, body } = payload.notification || {};
      if (!title) return;
      // Tampilkan toast di dalam app
      if (typeof toast === 'function') {
        toast('🔔 ' + title + ': ' + (body || ''), '#1e3a5f', 6000);
      }
      // Juga tampilkan notif native via SW
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

  } catch(e) {
    console.log('FCM token error:', e.message);
  }
}

// Init FCM saat halaman siap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFCM);
} else {
  initFCM();
}

// Daftarkan token setelah login (dipanggil dari index.html)
// window.registerFCMToken sudah tersedia global
