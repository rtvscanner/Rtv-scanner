// ═══════════════════════════════════════════════════════════
// RTV Scanner — Script Pengirim Notifikasi FCM
// Dijalankan otomatis oleh GitHub Actions (Versi WIT)
// ═══════════════════════════════════════════════════════════

const admin = require('firebase-admin');

// Ambil Service Account dari GitHub Secret
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

// Inisialisasi Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://rtv-scaner-default-rtdb.asia-southeast1.firebasedatabase.app'
});

const db = admin.database();

// ── Threshold peringatan dan tarik ──
const THR_WARN  = { CHILL: 21, FROZEN: 60, DRY: 21 }; // Perhatian — diskon
const THR_TARIK = { CHILL: 7,  FROZEN: 30, DRY: 7  }; // Segera tarik

// ── Hitung sisa hari ──
function hariSisa(tglTarik) {
  if (!tglTarik) return 9999;
  const exp = new Date(tglTarik);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  exp.setHours(0, 0, 0, 0);
  return Math.round((exp - now) / 86400000);
}

// ── Tentukan jenis notif berdasarkan jadwal (WIT / UTC+9) ──
function jenisNotif() {
  const schedule = process.env.GITHUB_EVENT_SCHEDULE || '';
  // Cek Suhu: 08.30 WIT (23:30 UTC H-1) dan 20.30 WIT (11:30 UTC)
  if (schedule === '30 23 * * *' || schedule === '30 11 * * *') {
    return 'suhu';
  }
  // Tarik Produk: 11.00 WIT (02:00 UTC) dan 18.00 WIT (09:00 UTC)
  return 'tarik';
}

// ── Ambil semua FCM token ──
async function getAllTokens() {
  const snap = await db.ref('/app/fcmTokens').once('value');
  if (!snap.exists()) return [];
  const data = snap.val();
  return Object.values(data).filter(t => t && typeof t === 'string');
}

// ── Ambil semua produk notifikasi ──
async function getAllNotifs() {
  const snap = await db.ref('/app/notifs').once('value');
  if (!snap.exists()) return [];
  const data = snap.val();
  if (Array.isArray(data)) return data.filter(Boolean);
  return Object.values(data).filter(Boolean);
}

// ── Kirim FCM ke semua token ──
async function kirimFCM(title, body, tag) {
  const tokens = await getAllTokens();
  if (tokens.length === 0) {
    console.log('⚠️ Tidak ada token FCM terdaftar.');
    return;
  }

  console.log(`📤 Mengirim notif ke ${tokens.length} HP...`);
  console.log(`   Judul: ${title}`);
  console.log(`   Isi: ${body}`);

  const message = {
    notification: { title, body },
    webpush: {
      notification: {
        title,
        body,
        icon: 'https://armstrong-sabandar-rtvscanner-pwa.netlify.app/icon-192.png',
        badge: 'https://armstrong-sabandar-rtvscanner-pwa.netlify.app/icon-192.png',
        vibrate: [200, 100, 200],
        tag: tag || 'rtv-notif'
      },
      fcmOptions: {
        link: 'https://armstrong-sabandar-rtvscanner-pwa.netlify.app'
      }
    },
    tokens
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`✅ Terkirim: ${response.successCount}/${tokens.length} HP`);

    // Hapus token tidak valid
    if (response.failureCount > 0) {
      const invalid = [];
      response.responses.forEach((r, i) => {
        if (!r.success) {
          const code = r.error && r.error.code;
          if (code === 'messaging/invalid-registration-token' ||
              code === 'messaging/registration-token-not-registered') {
            invalid.push(tokens[i]);
            console.log(`❌ Token tidak valid: ${tokens[i].substring(0, 20)}...`);
          }
        }
      });
      // Hapus token invalid dari Firebase
      if (invalid.length > 0) {
        const snap = await db.ref('/app/fcmTokens').once('value');
        const data = snap.val();
        const updates = {};
        Object.entries(data).forEach(([key, val]) => {
          if (invalid.includes(val)) updates[key] = null;
        });
        await db.ref('/app/fcmTokens').update(updates);
        console.log(`🗑️ ${invalid.length} token tidak valid dihapus`);
      }
    }
  } catch (e) {
    console.error('❌ FCM error:', e.message);
  }
}

// ── Parse threshold dari string "H-14" → 14 ──
function parseThr(tarikStr) {
  if (!tarikStr) return 999;
  const match = String(tarikStr).match(/(\d+)/);
  return match ? parseInt(match[1]) : 999;
}

// ── Analisa produk ──
async function analisaProduk() {
  const notifs = await getAllNotifs();
  console.log(`📦 Total produk di notif: ${notifs.length}`);

  const warn  = { CHILL: [], FROZEN: [], DRY: [] };
  const tarik = { CHILL: [], FROZEN: [], DRY: [] };

  notifs.forEach(n => {
    // Gunakan expDate sebagai tanggal acuan
    if (!n.expDate) return;
    const suhu = (n.suhu || 'DRY').toUpperCase();
    const key = ['CHILL','FROZEN','DRY'].includes(suhu) ? suhu : 'DRY';
    const sisa = hariSisa(n.expDate);

    // Threshold tarik dari field "tarik" (misal "H-14" → 14)
    const thrT = parseThr(n.tarik);
    // Threshold perhatian = sesuai THR_WARN
    const thrW = THR_WARN[key];

    console.log(`  ${n.desc || n.plu}: expDate=${n.expDate} sisa=${sisa} thrT=${thrT} thrW=${thrW}`);

    if (sisa <= thrT) {
      tarik[key].push(n);
    } else if (sisa <= thrW) {
      warn[key].push(n);
    }
  });

  console.log(`📊 Harus ditarik: CHILL=${tarik.CHILL.length} FROZEN=${tarik.FROZEN.length} DRY=${tarik.DRY.length}`);
  console.log(`📊 Perhatian: CHILL=${warn.CHILL.length} FROZEN=${warn.FROZEN.length} DRY=${warn.DRY.length}`);

  return { warn, tarik };
}

// ── Format teks notif perhatian dengan NO RETURN ──
function formatWarn(obj) {
  const lines = [];
  ['CHILL','FROZEN','DRY'].forEach(k => {
    if (obj[k] && obj[k].length > 0) {
      const noReturn = obj[k].filter(n =>
        n.flag === 'NO RETURN' || n.noReturn === true || n.noReturn === 'true'
      ).length;
      let txt = `${k}: ${obj[k].length} produk`;
      if (noReturn > 0) txt += ` (${noReturn} NO RETURN-diskon)`;
      lines.push(txt);
    }
  });
  return lines.join('\n');
}

// ── Format teks notif tarik ──
function formatTarik(obj) {
  const lines = [];
  ['CHILL','FROZEN','DRY'].forEach(k => {
    if (obj[k] && obj[k].length > 0) {
      lines.push(`${k}: ${obj[k].length} produk`);
    }
  });
  return lines.join(' | ');
}

function adaProduk(obj) {
  return obj.CHILL.length > 0 || obj.FROZEN.length > 0 || obj.DRY.length > 0;
}

// ── MAIN ──
async function main() {
  const jenis = jenisNotif();
  console.log(`\n🚀 RTV Scanner Notifikasi — Jenis: ${jenis.toUpperCase()}`);
  console.log(`⏰ Waktu: ${new Date().toLocaleString('id-ID', {timeZone: 'Asia/Jayapura'})}\n`);

  if (jenis === 'suhu') {
    // Kirim pengingat cek suhu
    await kirimFCM(
      'RTV Scanner - Waktunya Cek Suhu!',
      'Jangan lupa catat suhu Chiller, Freezer dan Display sekarang.',
      'rtv-suhu'
    );
  } else {
    // Kirim notif tarik produk
    const { warn, tarik } = await analisaProduk();

    if (adaProduk(tarik)) {
      await kirimFCM(
        'RTV Scanner - Segera Tarik!',
        formatTarik(tarik) + '\nBuka aplikasi untuk detail.',
        'rtv-tarik'
      );
    } else {
      console.log('✅ Tidak ada produk yang harus ditarik hari ini.');
    }

    // Tunggu 5 detik sebelum kirim notif kedua
    if (adaProduk(warn)) {
      await new Promise(r => setTimeout(r, 5000));
      await kirimFCM(
        'RTV Scanner - Perhatian Produk!',
        formatWarn(warn) + '\nBuka aplikasi untuk detail.',
        'rtv-warn'
      );
    } else {
      console.log('✅ Tidak ada produk dalam kategori perhatian.');
    }
  }

  console.log('\n✅ Selesai!');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
