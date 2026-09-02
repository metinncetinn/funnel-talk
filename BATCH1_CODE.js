// ============================================================
// BATCH 1: CRITICAL 4 FEATURES FOR V1.2
// Otomatik Bağlantı + AFK + Bağlantı Durumu + Ses Cleanup
// ============================================================

// 1. Add after existing state variables (line ~82)
let bağlantıDurumu = 'bağlanıyor'; // 'bağlı', 'bağlanıyor', 'kesildi', 'yeniden bağlanılıyor'
let otomatikBağlantıDenemesi = 0;
const MAX_BAĞLANTI_DENEMESI = 5;
let bağlantıTimeoutId = null;
let sonSesAktivitesi = Date.now();
let afkDurumu = false;
let afkTimeoutId = null;
const AFK_TIMEOUT = 5 * 60 * 1000; // 5 dakika
let screenShareAudioTracks = new Map(); // participant.sid -> Track

// 2. Add helper functions before init() (line ~250)
function başlantıDurumuGüncelle(durum) {
  bağlantıDurumu = durum;
  const elDurum = document.getElementById('bağlantıDurumu');
  if (!elDurum) return;
  
  const stili = {
    'bağlı': { text: '🟢 Bağlı', color: '#4ade80' },
    'bağlanıyor': { text: '🟡 Bağlanıyor...', color: '#fbbf24' },
    'kesildi': { text: '🔴 Bağlantı Kesildi', color: '#ef4444' },
    'yeniden bağlanılıyor': { text: '🟠 Yeniden Bağlanılıyor...', color: '#f97316' }
  };
  
  const info = stili[durum] || stili['kesildi'];
  elDurum.textContent = info.text;
  elDurum.style.color = info.color;
}

function afkKontrolünüBaşlat() {
  if (afkTimeoutId) clearInterval(afkTimeoutId);
  sonSesAktivitesi = Date.now();
  
  afkTimeoutId = setInterval(() => {
    if (!room || !mevcutKullanici) return;
    const şimdi = Date.now();
    const yeniAfk = (şimdi - sonSesAktivitesi) > AFK_TIMEOUT;
    
    if (yeniAfk !== afkDurumu) {
      afkDurumu = yeniAfk;
      katilimcilariYenidenCiz();
    }
  }, 15000); // 15 saniyede bir kontrol et
}

function afkKontrolünüDur() {
  if (afkTimeoutId) clearInterval(afkTimeoutId);
  afkTimeoutId = null;
  afkDurumu = false;
}

// 3. Room event handlers - Disconnected event (after existing room.on events)
room.on(RoomEvent.Disconnected, async () => {
  başlantıDurumuGüncelle('kesildi');
  afkKontrolünüDur();
  
  // Otomatik yeniden bağlantı
  if (otomatikBağlantıDenemesi < MAX_BAĞLANTI_DENEMESI && aktifKanal) {
    const backoff = Math.pow(2, otomatikBağlantıDenemesi) * 1000; // exponential: 1s, 2s, 4s, 8s, 16s
    başlantıDurumuGüncelle('yeniden bağlanılıyor');
    
    bağlantıTimeoutId = setTimeout(async () => {
      otomatikBağlantıDenemesi++;
      console.log(`Yeniden bağlanmaya çalışılıyor (deneme ${otomatikBağlantıDenemesi}/${MAX_BAĞLANTI_DENEMESI})...`);
      await kanalaGec(aktifKanal);
    }, backoff);
  }
});

room.on(RoomEvent.Connected, () => {
  başlantıDurumuGüncelle('bağlı');
  otomatikBağlantıDenemesi = 0; // reset attempts on successful connection
  if (bağlantıTimeoutId) clearTimeout(bağlantıTimeoutId);
  afkKontrolünüBaşlat();
});

// 4. After room.on(RoomEvent.TrackSubscribed...) update screen share audio handling:
// Replace screen share audio tracking part with:
if (publication.source === Track.Source.ScreenShareAudio) {
  screenShareAudioTracks.set(participant.sid, track);
  sonSesAktivitesi = Date.now(); // reset AFK timer when audio activity
}

// 5. After room.on(RoomEvent.TrackUnsubscribed...) add:
if (publication.source === Track.Source.ScreenShareAudio) {
  screenShareAudioTracks.delete(participant.sid);
}

// 6. Update katilimcilariYenidenCiz() to show AFK status
// In the kisi-ad span, add: (afkDurumu ve this.sid === izlenenKişi) ? ' 😴' : ''
// OR create new span for status

// 7. Add Ctrl+S shortcut for settings export (in init() function or after it)
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's' && e.shiftKey) {
    e.preventDefault();
    const json = JSON.stringify({ ayarlar, sesTercihleri }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `funnel-talk-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
});

// ============================================================
// HTML ADDITIONS
// In index.html <ust-bar> section, add right after opening tag:

<div id="bağlantıDurumu" class="bağlantı-durumu">🟡 Bağlanıyor...</div>

// ============================================================
// CSS ADDITIONS (in style.css)

.bağlantı-durumu {
  font-size: 12px;
  font-weight: 600;
  padding: 6px 10px;
  border-radius: 4px;
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
  display: inline-block;
  margin-right: 12px;
  transition: all 300ms ease;
}

// ============================================================
// LANG.JS ADDITIONS

// In tr translations add:
afkDurumu: '😴 AFK',
bağlanıyor: '🟡 Bağlanıyor...',
bağlantıKesildi: '🔴 Bağlantı Kesildi',
yenidenbağlanılıyor: '🟠 Yeniden Bağlanılıyor...',

// In en translations add:
afkDurumu: '😴 AFK',
bağlanıyor: '🟡 Connecting...',
bağlantıKesildi: '🔴 Disconnected',
yenidenbağlanılıyor: '🟠 Reconnecting...',

// ============================================================
