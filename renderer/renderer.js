const animasyon = lottie.loadAnimation({
  container: document.getElementById('splashAnimasyon'),
  renderer: 'svg',
  loop: false,
  autoplay: true,
  path: 'loading-animation.json',
  rendererSettings: {
    preserveAspectRatio: 'xMidYMid slice'
  }
});

animasyon.addEventListener('complete', () => {
  document.getElementById('ekran-splash').classList.add('gizli');
});

// Animasyon çok uzun sürerse veya takılırsa 4 saniye sonra yine de geç
setTimeout(() => {
  document.getElementById('ekran-splash').classList.add('gizli');
}, 4000);

const { Room, RoomEvent, Track } = LivekitClient;

// ---- DOM referanslari ----
const elGirisEkran = document.getElementById('ekran-giris');
const elAppEkran = document.getElementById('ekran-app');
const elGirisAd = document.getElementById('girisAd');
const elGirisHata = document.getElementById('girisHata');
const elBtnDevam = document.getElementById('btnDevam');
const elGoogleGirisAlani = document.getElementById('googleGirisAlani');
const elBtnGoogleGiris = document.getElementById('btnGoogleGiris');
const elAktifKullaniciAd = document.getElementById('aktifKullaniciAd');
const elBtnCikisYap = document.getElementById('btnCikisYap');
const elKanalListesi = document.getElementById('kanalListesi');
const elAktifKanalAdi = document.getElementById('aktifKanalAdi');
const elKatilimcilar = document.getElementById('katilimcilar');
const elBtnMikrofon = document.getElementById('btnMikrofon');
const elBtnEkranPaylas = document.getElementById('btnEkranPaylas');
const elBtnSohbetAcKapat = document.getElementById('btnSohbetAcKapat');
const elYayinAlani = document.getElementById('yayinAlani');
const elYayinVideo = document.getElementById('yayinVideo');
const elYayinSesKontrol = document.getElementById('yayinSesKontrol');
const elYayinSesKaydirici = document.getElementById('yayinSesKaydirici');
const elYayinSesDegeri = document.getElementById('yayinSesDeğeri');
const elSohbetPaneli = document.getElementById('sohbetPaneli');
const elSohbetMesajlari = document.getElementById('sohbetMesajlari');
const elSohbetInput = document.getElementById('sohbetInput');
const elBtnSohbetGonder = document.getElementById('btnSohbetGonder');
const elBtnChatEk = document.getElementById('btnChatEk');
const elChatFileInput = document.getElementById('chatFileInput');
const elChatMediaModal = document.getElementById('chatMediaModal');
const elChatMediaContent = document.getElementById('chatMediaContent');
const elChatMediaClose = document.getElementById('chatMediaClose');
const elModal = document.getElementById('kaynakSecimModal');
const elKaynakListesi = document.getElementById('kaynakListesi');
const elBtnKaynakIptal = document.getElementById('btnKaynakIptal');
const izleyenler = new Map(); // hedefKimlik -> Set(izleyen isimler)
const sesKontrolKayitlari = new Map(); // trackSid -> { nativeEl, remoteTrack, boosted: null|{context,kaynak,gainNode,boostedEl} }

// ---- Durum ----
let mevcutKullanici = null; // { name, email? }
let mikrofonAudioContext = null;
let mikrofonKaynakNode = null;
let mikrofonAnalyserNode = null;
let mikrofonGainNode = null;
let mikrofonLimiterNode = null;
let sesPaneliAudioContext = null;
let sesPaneliGainNode = null;
let sesPaneliDestination = null;
let sesPaneliTrack = null;
let sesPaneliYerelMonitorEl = null;
let sesListesi = [];
let secilenSesDosyasi = null;
let mikrofonDestinationNode = null;
let mikrofonHamStream = null;
let mikrofonYayinTrack = null;
let esikOlcumInterval = null;
let ayarlar = null;
let room = null;
let aktifKanal = null; // config.js'teki kanal objesi
let mikrofonAcik = true;
let ekranPaylasimTrack = null;
let sistemSesiTrack = null;
let izlenenYayinKimlik = null;
let cihazKimligim = null;
let sesTercihleri = {}; // { cihazKimligi: seviye }
let yayinSesSeviyeleri = {}; // { participant.sid -> seviye (0-100) }
let paylasilanAudioContext = null;

function paylasilanContextAl() {
  if (!paylasilanAudioContext || paylasilanAudioContext.state === 'closed') {
    paylasilanAudioContext = new AudioContext();
  }
  return paylasilanAudioContext;
}

function paylasilanContextKapat() {
  if (paylasilanAudioContext && paylasilanAudioContext.state !== 'closed') {
    paylasilanAudioContext.close().catch(() => {});
  }
  paylasilanAudioContext = null;
}
const sesElementleri = new Map();

// ======== BATCH 1: CRITICAL FEATURES ========
let bağlantıDurumu = 'bağlanıyor'; // 'bağlı', 'bağlanıyor', 'kesildi', 'yeniden bağlanılıyor'
let otomatikBağlantıDenemesi = 0;
const MAX_BAĞLANTI_DENEMESI = 5;
let bağlantıTimeoutId = null;
let sonSesAktivitesi = Date.now();
let afkDurumu = false;
let afkTimeoutId = null;
const AFK_TIMEOUT = 5 * 60 * 1000;
let screenShareAudioTracks = new Map();

// BATCH 2: UX IMPROVEMENTS
const kullanıcıRenkleri = new Map(); // participant.sid -> renk (hex)
let sesAnalyzer = null;
let sesMeterAnimationId = null;
const RENK_PALETI = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B195', '#EECDA7'];

function rastgeleRenkAl() {
  return RENK_PALETI[Math.floor(Math.random() * RENK_PALETI.length)];
}

function kullanıcıRenginiAl(sid) {
  if (!kullanıcıRenkleri.has(sid)) {
    kullanıcıRenkleri.set(sid, rastgeleRenkAl());
  }
  return kullanıcıRenkleri.get(sid);
}

function sesLeveliniGüncelle() {
  if (!sesAnalyzer || !mikrofonAudioContext) return;
  
  try {
    const dataArray = new Uint8Array(sesAnalyzer.frequencyBinCount);
    sesAnalyzer.getByteFrequencyData(dataArray);
    const toplam = dataArray.reduce((a, b) => a + b, 0);
    const seviye = Math.round((toplam / dataArray.length) / 2.55);
    
    const elMeter = document.getElementById('sesLevelMeterBar');
    if (elMeter) {
      elMeter.style.width = Math.min(100, seviye) + '%';
      elMeter.style.background = seviye > 80 ? '#ef4444' : seviye > 60 ? '#fbbf24' : '#4ade80';
    }
  } catch (e) {
    // Analyser closed, stop animation
    if (sesMeterAnimationId) cancelAnimationFrame(sesMeterAnimationId);
    return;
  }
  
  sesMeterAnimationId = requestAnimationFrame(sesLeveliniGüncelle);
}

function sesMeteriniDurdur() {
  if (sesMeterAnimationId) cancelAnimationFrame(sesMeterAnimationId);
  sesMeterAnimationId = null;
  const elMeter = document.getElementById('sesLevelMeterBar');
  if (elMeter) elMeter.style.width = '0%';
}

function başlantıDurumuGüncelle(durum) {
  bağlantıDurumu = durum;
  const elDurum = document.getElementById('bağlantıDurumu');
  if (!elDurum) return;
  elDurum.classList.remove('gizli');
  const durumlar = {
    'bağlı': { text: '🟢 Bağlı', color: '#4ade80' },
    'bağlanıyor': { text: '🟡 Bağlanıyor...', color: '#fbbf24' },
    'kesildi': { text: '🔴 Bağlantı Kesildi', color: '#ef4444' },
    'yeniden bağlanılıyor': { text: '🟠 Yeniden Bağlanılıyor...', color: '#f97316' }
  };
  const info = durumlar[durum] || durumlar['kesildi'];
  elDurum.textContent = info.text;
  elDurum.style.color = info.color;
}

function başlantıDurumunuGizle() {
  document.getElementById('bağlantıDurumu')?.classList.add('gizli');
}

// Mikrofon işareti sadece sesli bir kanala bağlıyken görünür.
function mikrofonGostergesiGuncelle() {
  const el = document.getElementById('mikrofonDurumuGöstergesi');
  if (!el) return;
  if (!room || aktifKanal?.type !== 'voice') {
    el.classList.add('gizli');
    return;
  }
  el.classList.remove('gizli');
  el.classList.toggle('aktif', mikrofonAcik);
}

function afkKontrolünüBaşlat() {
  if (afkTimeoutId) clearInterval(afkTimeoutId);
  sonSesAktivitesi = Date.now();
  afkTimeoutId = setInterval(() => {
    if (!room || !mevcutKullanici) return;
    const şimdi = Date.now();
    const yeniAfk = (şimdi - sonSesAktivitesi) > AFK_TIMEOUT;
    if (yeniAfk !== afkDurumu) { afkDurumu = yeniAfk; katilimcilariYenidenCiz(); }
  }, 15000);
}

function afkKontrolünüDur() {
  if (afkTimeoutId) clearInterval(afkTimeoutId);
  afkTimeoutId = null;
  afkDurumu = false;
}

elYayinSesKaydirici.addEventListener('input', async () => {
  if (!izlenenYayinKimlik) return;
  const seviye = Number(elYayinSesKaydirici.value);
  yayinSesSeviyeleri[izlenenYayinKimlik] = seviye;
  elYayinSesDegeri.textContent = `${seviye}%`;
  
  const oran = Math.max(0, Math.min(2, seviye / 50)); // 0-100 -> 0-2 (0-200%)
  room?.remoteParticipants.forEach((p) => {
    if (p.sid === izlenenYayinKimlik) {
      p.audioTrackPublications.forEach((pub) => {
        if (pub.source === Track.Source.ScreenShareAudio && pub.isSubscribed) {
          const trackSid = pub.trackSid;
          const kayit = sesKontrolKayitlari.get(trackSid);
          if (kayit) sesSeviyesiUygula(trackSid, oran);
        }
      });
    }
  });
  
  // localStorage'da sakla
  const oturumYayinSesleri = JSON.parse(localStorage.getItem('yayin-sesleri') || '{}');
  oturumYayinSesleri[izlenenYayinKimlik] = seviye;
  localStorage.setItem('yayin-sesleri', JSON.stringify(oturumYayinSesleri));
});

const appHertzbeatInterval = setInterval(() => {
  if (mevcutKullanici) {
    localStorage.setItem(`app-heartbeat-${cihazKimligim}`, JSON.stringify({
      kullanici: mevcutKullanici.name,
      timestamp: Date.now(),
      kanalda: !!room
    }));
  }
}, 5000);

function katilimciKimligi(katilimci) {
  return katilimci.metadata || katilimci.identity;
}

async function sesTercihiKaydet(kimlik, seviye) {
  sesTercihleri[kimlik] = seviye;
  await window.electronAPI.saveSesTercihleri(sesTercihleri);
}

function sesTercihiUygula() {
  // Ses seviyeleri artık TrackSubscribed anında GainNode ile uygulanıyor, burada ekstra işlem gerekmiyor.
}
// Ses seviyesini uygular. oran <= 1 ise basit/native yolu kullanır (hafif, güvenilir).
// oran > 1 ise (yükseltme gerekiyorsa) SADECE O KİŞİ İÇİN Web Audio köprüsü kurar.
function sesSeviyesiUygula(trackSid, oran) {
  const kayit = sesKontrolKayitlari.get(trackSid);
  if (!kayit) return;

  const masterOran = (ayarlar.anaSesSeviyesi ?? 100) / 100;

  if (oran <= 1.001) {
    // Boost aktifse kapat, native moda geri dön
    if (kayit.boosted) {
      try { kayit.boosted.kaynak.disconnect(); kayit.boosted.gainNode.disconnect(); } catch {}
      kayit.boosted.boostedEl?.remove();
      kayit.boosted = null;
    }
    kayit.nativeEl.muted = false;
    kayit.nativeEl.volume = Math.max(0, Math.min(1, oran * masterOran));
  } else {
    // %100 üstü - Web Audio köprüsü gerekiyor, sadece bu kişi için kur
    kayit.nativeEl.muted = true; // native yoldan ses gitmesin, çift ses olmasın

    if (!kayit.boosted) {
      const context = paylasilanContextAl();
      if (context.state === 'suspended') context.resume().catch(() => {});

      const kaynak = context.createMediaStreamSource(new MediaStream([kayit.remoteTrack.mediaStreamTrack]));
      const gainNode = context.createGain();
      const destination = context.createMediaStreamDestination();
      kaynak.connect(gainNode);
      gainNode.connect(destination);

      const boostedEl = new Audio();
      boostedEl.srcObject = destination.stream;
      boostedEl.autoplay = true;
      if (ayarlar.hoparlorId && boostedEl.setSinkId) {
        boostedEl.setSinkId(ayarlar.hoparlorId).catch(() => {});
      }
      document.body.appendChild(boostedEl);

      kayit.boosted = { context, kaynak, gainNode, boostedEl };
    }
    kayit.boosted.gainNode.gain.value = oran * masterOran;
  }
}

// Ana ses seviyesi değişince, hem native hem boost modundaki herkese yeniden uygula
function tumSesSeviyeleriniYenile() {
  if (!room) return;
  room.remoteParticipants.forEach((katilimci) => {
    const kimlik = katilimciKimligi(katilimci);
    const oran = sesTercihleri[kimlik] ?? 1;
    const mikrofonYayini = [...katilimci.audioTrackPublications.values()].find(
      (p) => p.source === Track.Source.Microphone
    );
    if (mikrofonYayini) sesSeviyesiUygula(mikrofonYayini.trackSid, oran);
  });
}

init();

async function init() {
  window.electronAPI.onGuncellemeHazir((bilgi) => {
    const surum = bilgi?.version ? ` (${bilgi.version})` : '';
    if (window.confirm(`${t('guncellemeHazir')}${surum}`)) {
      window.electronAPI.installUpdate();
    }
  });

  cihazKimligim = await window.electronAPI.getCihazKimligi();
  sesTercihleri = await window.electronAPI.getSesTercihleri();

  ayarlar = await window.electronAPI.getSettings();
  document.body.dataset.theme = ayarlar.tema;
  dilUygula(ayarlar.dil || 'tr');
  setInterval(() => {
    cevrimiciListesiGuncelle();
  }, 3000);

  async function cevrimiciListesiGuncelle() {
    const elCevrimici = document.getElementById('cevrimiciListesi');
    if (!elCevrimici) return;

    const sonuc = await Promise.all(window.APP_CONFIG.CHANNELS.map(async (kanal) => {
      try {
        const resp = await fetch(`${window.APP_CONFIG.TOKEN_SERVER_URL}/katilimcilar/${encodeURIComponent(kanal.name)}`);
        if (!resp.ok) return [];
        const isimler = await resp.json();
        return isimler.map((ad) => ({ ad, kanal: kanal.name }));
      } catch {
        return [];
      }
    }));
    const cevrimiciKisiler = sonuc.flat();

    elCevrimici.innerHTML = '';
    cevrimiciKisiler.forEach((kisi) => {
      const div = document.createElement('div');
      div.className = 'cevrimici-ogesi aktif';
      div.textContent = `🟢 ${kisi.ad} · ${kisi.kanal}`;
      elCevrimici.appendChild(div);
    });

    const panel = document.getElementById('katilimciListesiPanel');
    if (cevrimiciKisiler.length > 0) {
      panel.classList.remove('gizli');
    }
  }
  const googleVarMi = await window.electronAPI.isGoogleLoginAvailable();
  if (googleVarMi) elGoogleGirisAlani.classList.remove('gizli');

  const kayitliKullanici = await window.electronAPI.getSavedUser();
  if (kayitliKullanici) {
    mevcutKullanici = kayitliKullanici;
    uygulamayaGec();
  }

  window.electronAPI.onKisayolTetiklendi((eylem) => {
    if (eylem === 'mikrofon') mikrofonuAcKapa();
    if (eylem === 'yayinDurdur') ekranPaylasimiDurdur();
  });
}

async function ayarlariKaydet() {
  return await window.electronAPI.saveSettings(ayarlar);
}

// ---- Giriş ekranı ----
elBtnDevam.addEventListener('click', () => {
  const ad = elGirisAd.value.trim();
  if (!ad) {
    elGirisHata.textContent = t('girisHataAdYok');
    return;
  }
  elGirisHata.textContent = '';
  mevcutKullanici = { name: ad };
  window.electronAPI.saveUser(mevcutKullanici);
  uygulamayaGec();
});
elGirisAd.addEventListener('keydown', (e) => { if (e.key === 'Enter') elBtnDevam.click(); });

elBtnGoogleGiris.addEventListener('click', async () => {
  elGirisHata.textContent = '';
  elBtnGoogleGiris.disabled = true;
  elBtnGoogleGiris.textContent = t('googleGirisYapiliyor');
  try {
    const profil = await window.electronAPI.googleLogin();
    mevcutKullanici = { name: profil.name, email: profil.email };
    window.electronAPI.saveUser(mevcutKullanici);
    uygulamayaGec();
  } catch (err) {
    console.error(err);
    elGirisHata.textContent = t('girisHataGoogle');
  } finally {
    elBtnGoogleGiris.disabled = false;
    elBtnGoogleGiris.textContent = t('googleGiris');
  }
});

elBtnCikisYap.addEventListener('click', async () => {
  if (room) {
    const eskiRoom = room;
    room = null;
    await ekranPaylasimiDurdur(eskiRoom);
    await eskiRoom.disconnect();
  } else {
    await ekranPaylasimiDurdur();
  }
  await window.electronAPI.clearUser();
  mevcutKullanici = null;
  aktifKanal = null;
  elGirisAd.value = '';
  elAppEkran.classList.add('gizli');
  elGirisEkran.classList.remove('gizli');
});

function uygulamayaGec() {
  elAktifKullaniciAd.textContent = mevcutKullanici.name;
  elGirisEkran.classList.add('gizli');
  elAppEkran.classList.remove('gizli');
  kanalListesiniCiz();
}

// ---- Kanal listesi (sol menü) ----
let kanalKatilimciElementleri = []; // { kanal, element } listesi, periyodik yenileme icin

function kanalListesiniCiz() {
  elKanalListesi.innerHTML = '';
  kanalKatilimciElementleri = [];

  window.APP_CONFIG.CHANNELS.forEach((kanal) => {
    const disKapsayici = document.createElement('div');

    const oge = document.createElement('div');
    oge.className = 'kanal-ogesi' + (aktifKanal?.name === kanal.name ? ' aktif' : '');
    const simge = kanal.type === 'text' ? '💬' : '🔊';
    const simgeSpan = document.createElement('span');
    simgeSpan.className = 'kanal-simge';
    simgeSpan.textContent = simge;
    const adSpan = document.createElement('span');
    adSpan.textContent = kanal.name;
    oge.append(simgeSpan, adSpan);

    // Tık: kanala katıl
    oge.addEventListener('click', () => kanalaGec(kanal));

    const katilimciListesi = document.createElement('div');
    katilimciListesi.className = 'kanal-katilimcilari acik'; // her zaman açık
    katilimciListesi.innerHTML = `<span class="kanal-katilimci-yok">${t('yukleniyor')}</span>`;

    disKapsayici.appendChild(oge);
    disKapsayici.appendChild(katilimciListesi);
    elKanalListesi.appendChild(disKapsayici);

    kanalKatilimciElementleri.push({ kanal, element: katilimciListesi });
  });

  tumKanalKatilimcilariniGuncelle();
}

async function tumKanalKatilimcilariniGuncelle() {
  for (const { kanal, element } of kanalKatilimciElementleri) {
    try {
      const resp = await fetch(`${window.APP_CONFIG.TOKEN_SERVER_URL}/katilimcilar/${encodeURIComponent(kanal.name)}`);
      const isimler = await resp.json();
      element.replaceChildren();
      if (isimler.length === 0) {
        const bos = document.createElement('span');
        bos.className = 'kanal-katilimci-yok';
        bos.textContent = t('kimseYok');
        element.appendChild(bos);
      } else {
        isimler.forEach((ad) => {
          const satir = document.createElement('div');
          satir.className = 'kanal-katilimci-satiri';
          satir.textContent = `🟢 ${ad}`;
          element.appendChild(satir);
        });
      }
    } catch (e) {
      element.replaceChildren();
      const hata = document.createElement('span');
      hata.className = 'kanal-katilimci-yok';
      hata.textContent = t('alinamadi');
      element.appendChild(hata);
    }
  }
}

// Sidebar acikken kanal listelerini 5 saniyede bir tazele
setInterval(() => {
  if (!elAppEkran.classList.contains('gizli') && kanalKatilimciElementleri.length > 0) {
    tumKanalKatilimcilariniGuncelle();
  }
}, 5000);

function sesMeterPaneliniGöster(göster) {
  const elPanel = document.getElementById('sesLevelPanel');
  if (!elPanel) return;
  if (göster && !elPanel.classList.contains('gizli')) return;
  if (!göster && elPanel.classList.contains('gizli')) return;
  
  if (göster) {
    elPanel.classList.remove('gizli');
    if (!sesMeterAnimationId) sesLeveliniGüncelle();
  } else {
    elPanel.classList.add('gizli');
    sesMeteriniDurdur();
  }
}

async function kanalaGec(kanal) {
  if (aktifKanal?.name === kanal.name) return;

  if (room) {
    const eskiRoom = room;
    room = null;
    await ekranPaylasimiDurdur(eskiRoom);
    await eskiRoom.disconnect();
  } else {
    await ekranPaylasimiDurdur();
  }
  mikrofonuDurdurVeTemizle();
  sesPaneliDurdur();
  paylasilanContextKapat();
  sesElementleri.forEach((el) => el.remove());
  izleyenler.clear();
  sesElementleri.clear();
  sesKontrolKayitlari.forEach((kayit) => {
    if (kayit.boosted) {
      try { kayit.boosted.kaynak.disconnect(); kayit.boosted.gainNode.disconnect(); } catch {}
      kayit.boosted.boostedEl?.remove();
    }
  });
  sesKontrolKayitlari.clear();
  elYayinAlani.classList.add('gizli');
  elSohbetMesajlari.innerHTML = '';

  elAktifKanalAdi.textContent = t('baglaniyor');
  başlantıDurumuGüncelle('bağlanıyor');

  try {
    const resp = await fetch(`${window.APP_CONFIG.TOKEN_SERVER_URL}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: kanal.name, name: mevcutKullanici.name, metadata: cihazKimligim })
    });

    if (resp.status === 409) {
      elAktifKanalAdi.textContent = t('birKanalSec');
      başlantıDurumunuGizle();
      alert(`"${mevcutKullanici.name}" ${t('isimKullaniliyorUyari')}`);
      return;
    }
    if (!resp.ok) throw new Error('Token sunucusu hata verdi: ' + resp.status);

    const { token, url } = await resp.json();

    room = new Room({ adaptiveStream: true, dynacast: true });
    baglaOlayDinleyicileri();

    await room.connect(url, token, { autoSubscribe: false });
    room.remoteParticipants.forEach((katilimci) => {
      katilimci.audioTrackPublications.forEach((pub) => {
        if (pub.source === Track.Source.Microphone) pub.setSubscribed(true);
      });
    });

    başlantıDurumuGüncelle('bağlı');

    if (kanal.type === 'voice') {
      mikrofonAcik = true;
      await mikrofonuBaslatVeYayinla();
      await sesPaneliBaslat();
      elBtnMikrofon.classList.remove('gizli');
      elBtnEkranPaylas.classList.remove('gizli');
      elBtnSesPaneli.classList.remove('gizli');
      elBtnMikrofon.textContent = '🎙️';
      elBtnMikrofon.classList.remove('aktif-kapali');
    } else {
      elBtnMikrofon.classList.add('gizli');
      elBtnEkranPaylas.classList.add('gizli');
      elBtnSesPaneli.classList.add('gizli');
    }
    aktifKanal = kanal;
    mikrofonGostergesiGuncelle();
    elBtnKanaldanAyril.classList.remove('gizli');
    elAktifKanalAdi.textContent = (kanal.type === 'text' ? '💬 ' : '# ') + kanal.name;
    kanalListesiniCiz();
    katilimcilariYenidenCiz();
    await sohbetGecmisiniYukle(kanal.name);
    document.getElementById('sesGeliyor').play().catch(() => {});

  } catch (err) {
    console.error(err);
    başlantıDurumunuGizle();
    elAktifKanalAdi.textContent = t('baglanilamadi');
    alert(t('baglanilamadiUyari'));
  }
}

function baglaOlayDinleyicileri() {
  room.on(RoomEvent.ParticipantConnected, (participant) => {
    if (participant !== room.localParticipant) {
      document.getElementById('sesGeliyor').play().catch(() => {});
    }
    sesTercihiUygula(participant);
    katilimcilariYenidenCiz();
  });
  room.on(RoomEvent.ParticipantDisconnected, (p) => {
    document.getElementById('sesCikiyor').play().catch(() => {});
    p.audioTrackPublications.forEach((pub) => {
      sesElementleri.get(pub.trackSid)?.remove();
      sesElementleri.delete(pub.trackSid);
      const kayit = sesKontrolKayitlari.get(pub.trackSid);
      if (kayit?.boosted) {
        try { kayit.boosted.kaynak.disconnect(); kayit.boosted.gainNode.disconnect(); } catch {}
        kayit.boosted.boostedEl?.remove();
      }
      sesKontrolKayitlari.delete(pub.trackSid);
    });
    katilimcilariYenidenCiz();
  });

  room.on(RoomEvent.TrackPublished, (publication, participant) => {
    if (publication.kind === Track.Kind.Audio) {
      if (publication.source === Track.Source.Microphone) {
        publication.setSubscribed(true);
      } else if (publication.source === Track.Source.ScreenShareAudio) {
        // Ekran sesi izleme onayına bağlı: bu kişinin yayınını zaten izliyorsak sesini de otomatik ekle
        const ekranPub = [...participant.videoTrackPublications.values()].find(
          (p) => p.source === Track.Source.ScreenShare
        );
        if (ekranPub?.isSubscribed) publication.setSubscribed(true);
        // aksi halde sessiz kalır, "izle" tıklanınca abone olur (aşağıdaki adım)
      }
    }
    if (publication.kind === Track.Kind.Video && publication.source === Track.Source.ScreenShare) {
      document.getElementById('sesYayinBasladi').play().catch(() => {});
    }
    katilimcilariYenidenCiz();
  });

  room.on(RoomEvent.TrackUnpublished, (publication) => {
    if (publication.kind === Track.Kind.Video && publication.source === Track.Source.ScreenShare) {
      document.getElementById('sesYayinBitti').play().catch(() => {});
    }
    katilimcilariYenidenCiz();
  });

  room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
    // ⭐ KRITIK: Local participant (kendimiz) kendi track'lerini dinlemeyelim
    // Böylece yayıncı kendi sesini duyması (echo/feedback) önlenir
    if (participant.isLocal) return;

    if (track.kind === Track.Kind.Audio) {
      const el = track.attach(); // Basit, güvenilir yol - önceki sürümün davranışı
      el.style.display = 'none';
      if (ayarlar.hoparlorId && el.setSinkId) {
        el.setSinkId(ayarlar.hoparlorId).catch(() => {});
      }
      document.body.appendChild(el);
      sesElementleri.set(publication.trackSid, el);
    
      sesKontrolKayitlari.set(publication.trackSid, {
        nativeEl: el,
        remoteTrack: track,
        boosted: null
      });

      const kimlik = katilimciKimligi(participant);
      const kayitliOran = sesTercihleri[kimlik] ?? 1;
      sesSeviyesiUygula(publication.trackSid, kayitliOran);
    } else if (track.kind === Track.Kind.Video && publication.source === Track.Source.ScreenShare) {
      track.attach(elYayinVideo);
      elYayinAlani.classList.remove('gizli');
      elKatilimciListesiPanel.classList.remove('gizli');
      izlenenYayinKimlik = participant.sid;
      
      // Önceki yayınların ses seviyesini yükle
      const oturumYayinSesleri = JSON.parse(localStorage.getItem('yayin-sesleri') || '{}');
      const kaydiliSeviye = oturumYayinSesleri[participant.sid] ?? 50;
      yayinSesSeviyeleri[participant.sid] = kaydiliSeviye;
      elYayinSesKaydirici.value = kaydiliSeviye;
      elYayinSesDegeri.textContent = `${kaydiliSeviye}%`;
      elYayinSesKontrol.classList.remove('gizli');
      
      // Eğer ses track zaten subscribe olmuşsa, sesini hemen uygula
      const oran = Math.max(0, Math.min(2, kaydiliSeviye / 50)); // 0-100 -> 0-2 (0-200%)
      participant.audioTrackPublications.forEach((pub) => {
        if (pub.source === Track.Source.ScreenShareAudio && pub.isSubscribed) {
          const trackSid = pub.trackSid;
          const kayit = sesKontrolKayitlari.get(trackSid);
          if (kayit) sesSeviyesiUygula(trackSid, oran);
        }
      });
    }
    katilimcilariYenidenCiz();
  });

  room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
    track.detach();
    sesElementleri.delete(publication.trackSid);
    const kayit = sesKontrolKayitlari.get(publication.trackSid);
    if (kayit?.boosted) {
      try { kayit.boosted.kaynak.disconnect(); kayit.boosted.gainNode.disconnect(); } catch {}
      kayit.boosted.boostedEl?.remove();
    }
    sesKontrolKayitlari.delete(publication.trackSid);
    if (publication.source === Track.Source.ScreenShare && izlenenYayinKimlik === participant.sid) {
      elYayinAlani.classList.add('gizli');
      elKatilimciListesiPanel.classList.add('gizli');
      izlenenYayinKimlik = null;
      elYayinSesKontrol.classList.add('gizli');
    }
    katilimcilariYenidenCiz();
  });

  room.on(RoomEvent.ActiveSpeakersChanged, konusanlariGuncelle);
  room.on(RoomEvent.TrackMuted, () => katilimcilariYenidenCiz());
  room.on(RoomEvent.TrackUnmuted, () => katilimcilariYenidenCiz());

  // ---- Sohbet mesajlari LiveKit veri kanali uzerinden ----
  room.on(RoomEvent.DataReceived, (payload) => {
    try {
      const veri = JSON.parse(new TextDecoder().decode(payload));

      if (veri.tip === 'izleme-durumu') {
        if (!izleyenler.has(veri.hedefKimlik)) izleyenler.set(veri.hedefKimlik, new Set());
        const set = izleyenler.get(veri.hedefKimlik);
        const yeniIzleyiciMi = veri.izliyor && !set.has(veri.izleyenAd);

        if (veri.izliyor) set.add(veri.izleyenAd);
        else set.delete(veri.izleyenAd);

        if (yeniIzleyiciMi && veri.hedefKimlik === cihazKimligim) {
          document.getElementById('sesYayinIzleyici').play().catch(() => {});
        }

        katilimcilariYenidenCiz();
        return;
      }

      if (veri.tip === 'chat-delete') {
        if (veri.id) silSohbetMesaji(veri.id);
        return;
      }

      const attachment = veri.attachment || null;
      sohbetMesajiEkle(veri.yazar, veri.metin || attachment?.filename || '', false, veri);
    } catch (e) {
      console.warn('Veri mesaji cozulemedi', e);
    }
  });

  room.on(RoomEvent.Reconnecting, () => başlantıDurumuGüncelle('yeniden bağlanılıyor'));
  room.on(RoomEvent.Reconnected, () => başlantıDurumuGüncelle('bağlı'));

  room.on(RoomEvent.Disconnected, () => {
    document.getElementById('sesCikiyor').play().catch(() => {});
    ekranPaylasimiDurdur(null);
    mikrofonuDurdurVeTemizle();
    sesPaneliDurdur();
    paylasilanContextKapat();
    aktifKanal = null;
    başlantıDurumunuGizle();
    mikrofonGostergesiGuncelle();
    elAktifKanalAdi.textContent = t('birKanalSec');
    elBtnMikrofon.classList.add('gizli');
    elBtnEkranPaylas.classList.add('gizli');
    elBtnSesPaneli.classList.add('gizli');
    elBtnKanaldanAyril.classList.add('gizli');
    kanalListesiniCiz();
  });
}

function katilimcilariYenidenCiz() {
  if (!room) return;
  elKatilimcilar.innerHTML = '';

  const konusanlar = new Set((room.activeSpeakers || []).map((p) => p.sid));
  const hepsi = [room.localParticipant, ...room.remoteParticipants.values()];

  hepsi.forEach((katilimci) => {
    const benMi = katilimci === room.localParticipant;
    const satir = document.createElement('div');
    satir.className = 'kisi-satir';
    satir.dataset.sid = katilimci.sid;

    const adSatiri = document.createElement('div');
    adSatiri.className = 'kisi-ad';
    const mikrofonYayini = [...katilimci.audioTrackPublications.values()].find(p => p.source === Track.Source.Microphone);
    const susturulmus = mikrofonYayini ? mikrofonYayini.isMuted : (benMi ? !mikrofonAcik : false);

    const adSpan = document.createElement('span');
    adSpan.className = 'ad-metni';
    adSpan.textContent = (katilimci.name || katilimci.identity) + (benMi ? ' ' + t('sen') : '') + (susturulmus ? ' 🔇' : '');
    if (konusanlar.has(katilimci.sid)) adSpan.classList.add('rozet-konusuyor');
    adSatiri.appendChild(adSpan);
    satir.appendChild(adSatiri);

    if (!benMi) {
      const kimlik = katilimciKimligi(katilimci);
      const kayitliSeviye = sesTercihleri[kimlik] ?? 1;
      const trackSid = mikrofonYayini?.trackSid;

      const kontrolSatiri = document.createElement('div');
      kontrolSatiri.className = 'kisi-kontrol';

      const susturBtn = document.createElement('button');
      susturBtn.className = 'buton-ikincil';
      susturBtn.textContent = kayitliSeviye === 0 ? '🔇' : '🔊';
      susturBtn.addEventListener('click', async () => {
        const yeniDeger = kayitliSeviye === 0 ? 1 : 0;
        if (trackSid) sesSeviyesiUygula(trackSid, yeniDeger);
        await sesTercihiKaydet(kimlik, yeniDeger);
        katilimcilariYenidenCiz();
      });
      kontrolSatiri.appendChild(susturBtn);

      const sesKaydirici = document.createElement('input');
      sesKaydirici.type = 'range';
      sesKaydirici.min = '0';
      sesKaydirici.max = '300';
      sesKaydirici.value = String(kayitliSeviye * 100);
      sesKaydirici.addEventListener('input', async (e) => {
        const oran = Number(e.target.value) / 100;
        if (trackSid) sesSeviyesiUygula(trackSid, oran);
        await sesTercihiKaydet(kimlik, oran);
      });
      kontrolSatiri.appendChild(sesKaydirici);
      satir.appendChild(kontrolSatiri);

      const ekranPub = [...katilimci.videoTrackPublications.values()].find(
        (p) => p.source === Track.Source.ScreenShare
      );
      if (ekranPub) {
        const kimlik = katilimciKimligi(katilimci);
        const izleyenSet = izleyenler.get(kimlik) || new Set();
        const izleniyor = ekranPub.isSubscribed;
        const izleyiciMetni = izleyenSet.size > 0 ? ` (${[...izleyenSet].join(', ')} ${t('izliyor')})` : '';
      
        const rozet = document.createElement('span');
        rozet.className = 'yayin-rozeti' + (izleniyor ? '' : ' izlemiyor');
        rozet.textContent = izleniyor ? `${t('yayinAcik')}${izleyiciMetni}` : `${t('yayinVarIzle')}${izleyiciMetni}`;
        rozet.addEventListener('click', () => {
          const yeniDurum = !izleniyor;
          ekranPub.setSubscribed(yeniDurum);

          // Ekran paylaşımıyla birlikte sistem sesi varsa, izleme durumuyla birlikte onu da aç/kapat
          const sesPub = [...katilimci.audioTrackPublications.values()].find(
            (p) => p.source === Track.Source.ScreenShareAudio
          );
          if (sesPub) sesPub.setSubscribed(yeniDurum);
        
          room.localParticipant.publishData(
            new TextEncoder().encode(JSON.stringify({
              tip: 'izleme-durumu',
              hedefKimlik: kimlik,
              izleyenAd: mevcutKullanici.name,
              izliyor: yeniDurum
            })),
            { reliable: true }
          );
          katilimcilariYenidenCiz();
        });
        satir.appendChild(rozet);
      }
    }

    elKatilimcilar.appendChild(satir);
  });
}
function konusanlariGuncelle() {
  if (!room) return;
  const konusanlar = new Set((room.activeSpeakers || []).map((p) => p.sid));
  document.querySelectorAll('#katilimcilar .kisi-satir').forEach((satir) => {
    const adSpan = satir.querySelector('.ad-metni');
    if (adSpan) adSpan.classList.toggle('rozet-konusuyor', konusanlar.has(satir.dataset.sid));
  });
}

// ---- Mikrofon / Ekran paylaşımı ----
elBtnMikrofon.addEventListener('click', mikrofonuAcKapa);

function mikrofonuAcKapa() {
  if (!room || aktifKanal?.type !== 'voice' || !mikrofonYayinTrack) return;
  mikrofonAcik = !mikrofonAcik;
  if (mikrofonAcik) {
    mikrofonYayinTrack.unmute();
  } else {
    mikrofonYayinTrack.mute();
  }
  elBtnMikrofon.textContent = mikrofonAcik ? '🎙️' : '🔇';
  elBtnMikrofon.classList.toggle('aktif-kapali', !mikrofonAcik);
  mikrofonGostergesiGuncelle();
}
async function mikrofonuBaslatVeYayinla() {
  try {
    mikrofonHamStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: ayarlar.mikrofonId || undefined,
        echoCancellation: true,
        noiseSuppression: ayarlar.gurultuSuppression ?? false,
        autoGainControl: false
      }
    });

    mikrofonAudioContext = paylasilanContextAl();
    mikrofonKaynakNode = mikrofonAudioContext.createMediaStreamSource(mikrofonHamStream);
    mikrofonAnalyserNode = mikrofonAudioContext.createAnalyser();
    mikrofonAnalyserNode.fftSize = 512;
    mikrofonGainNode = mikrofonAudioContext.createGain();
    mikrofonGainNode.gain.value = (ayarlar.mikrofonGirisSeviyesi ?? 100) / 100;

    // Limiter: ani yüksek sesleri (bağırma, mikrofona vurma vb.) otomatik bastırır.
    // Normal konuşma seviyesine dokunmaz, sadece belirli bir eşiği (-12dB) geçen kısmı sıkıştırır.
    mikrofonLimiterNode = mikrofonAudioContext.createDynamicsCompressor();
    mikrofonLimiterNode.threshold.value = ayarlar.limiterEsik ?? -12;
    mikrofonLimiterNode.knee.value = 6;
    mikrofonLimiterNode.ratio.value = 16;
    mikrofonLimiterNode.attack.value = 0.002;
    mikrofonLimiterNode.release.value = 0.2;

    mikrofonDestinationNode = mikrofonAudioContext.createMediaStreamDestination();

    mikrofonKaynakNode.connect(mikrofonAnalyserNode);
    mikrofonAnalyserNode.connect(mikrofonGainNode);
    limiterBaglantisiniUygula();

    const islenmisTrack = mikrofonDestinationNode.stream.getAudioTracks()[0];
    mikrofonYayinTrack = new LivekitClient.LocalAudioTrack(islenmisTrack);
    await room.localParticipant.publishTrack(mikrofonYayinTrack, { source: Track.Source.Microphone });

    if (!mikrofonAcik) mikrofonYayinTrack.mute();

    sesEsigiOlcumuBaslat();
  } catch (e) {
    console.warn('Mikrofon başlatılamadı, sessiz katılıyorum.', e);
  }
}
function limiterBaglantisiniUygula() {
  if (!mikrofonGainNode || !mikrofonLimiterNode || !mikrofonDestinationNode) return;

  // Önceki bağlantıları temizle (tekrar çağrılınca çift bağlanmasın)
  try { mikrofonGainNode.disconnect(); } catch {}
  try { mikrofonLimiterNode.disconnect(); } catch {}

  if (ayarlar.limiterAcik ?? true) {
    mikrofonGainNode.connect(mikrofonLimiterNode);
    mikrofonLimiterNode.connect(mikrofonDestinationNode);
  } else {
    mikrofonGainNode.connect(mikrofonDestinationNode);
  }
}
async function mikrofonKaynaginiDegistir() {
  if (!mikrofonAudioContext || !mikrofonAnalyserNode) return;

  const eskiStream = mikrofonHamStream;
  try {
    mikrofonHamStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: ayarlar.mikrofonId || undefined,
        echoCancellation: true,
        noiseSuppression: ayarlar.gurultuSuppression ?? false,
        autoGainControl: false
      }
    });

    mikrofonKaynakNode.disconnect();
    mikrofonKaynakNode = mikrofonAudioContext.createMediaStreamSource(mikrofonHamStream);
    mikrofonKaynakNode.connect(mikrofonAnalyserNode);

    eskiStream?.getTracks().forEach((t) => t.stop());
  } catch (e) {
    console.warn('Mikrofon kaynağı değiştirilemedi', e);
  }
}

function sesEsigiOlcumuBaslat() {
  if (esikOlcumInterval) clearInterval(esikOlcumInterval);
  const veriDizisi = new Uint8Array(mikrofonAnalyserNode.frequencyBinCount);
  let mevcutKazanc = 1;
  let debugSayi = 0;
  const DEBUG = false; // Development mode: true yapınca console log çıkacak

  esikOlcumInterval = setInterval(() => {
    if (!mikrofonAnalyserNode) return;
    mikrofonAnalyserNode.getByteTimeDomainData(veriDizisi);

    let toplamKare = 0;
    for (let i = 0; i < veriDizisi.length; i++) {
      const ornek = (veriDizisi[i] - 128) / 128;
      toplamKare += ornek * ornek;
    }
    const rms = Math.sqrt(toplamKare / veriDizisi.length);
    const db = rms > 0 ? 20 * Math.log10(rms) : -100;

    const esik = ayarlar.sesEsigi ?? -30;
    const hedefKazanc = db > esik ? 1 : 0;

    // Ani kesilme/çatlama olmasın diye yumuşak geçiş
    mevcutKazanc += (hedefKazanc - mevcutKazanc) * 0.3;
    const girisSeviyesi = (ayarlar.mikrofonGirisSeviyesi ?? 100) / 100;
    mikrofonGainNode.gain.setTargetAtTime(mevcutKazanc * girisSeviyesi, mikrofonAudioContext.currentTime, 0.05);

    // Debug: Her 20 intervalin (yaklaşık 1 saniyede) birini yazdır (sadece DEBUG true ise)
    if (DEBUG && ++debugSayi % 20 === 0) {
      console.log(`🎤 Ses: ${db.toFixed(1)} dB | Eşik: ${esik} dB | Geçiyor: ${db > esik ? '✅ EVET' : '❌ HAYIR'} | Kazanç: ${mevcutKazanc.toFixed(2)}`);
    }
  }, 50);
}

function mikrofonuDurdurVeTemizle() {
  if (esikOlcumInterval) { clearInterval(esikOlcumInterval); esikOlcumInterval = null; }
  if (mikrofonYayinTrack && room) {
    room.localParticipant.unpublishTrack(mikrofonYayinTrack).catch(() => {});
    mikrofonYayinTrack.stop();
    mikrofonYayinTrack = null;
  }
  mikrofonHamStream?.getTracks().forEach((t) => t.stop());
  mikrofonHamStream = null;
  mikrofonAudioContext = null;
  mikrofonKaynakNode = null;
  mikrofonAnalyserNode = null;
  mikrofonGainNode = null;
  mikrofonLimiterNode = null;
  mikrofonDestinationNode = null;
}
async function sesPaneliBaslat() {
  try {
    sesPaneliAudioContext = paylasilanContextAl();
    sesPaneliGainNode = sesPaneliAudioContext.createGain();
    sesPaneliGainNode.gain.value = (ayarlar.sesPaneliSeviyesi ?? 100) / 100;

    sesPaneliDestination = sesPaneliAudioContext.createMediaStreamDestination(); // digerlerine gidecek
    const yerelDestination = sesPaneliAudioContext.createMediaStreamDestination(); // kendi hoparlorune gidecek

    sesPaneliGainNode.connect(sesPaneliDestination);
    sesPaneliGainNode.connect(yerelDestination);

    sesPaneliYerelMonitorEl = new Audio();
    sesPaneliYerelMonitorEl.srcObject = yerelDestination.stream;
    sesPaneliYerelMonitorEl.autoplay = true;
    if (ayarlar.hoparlorId && sesPaneliYerelMonitorEl.setSinkId) {
      sesPaneliYerelMonitorEl.setSinkId(ayarlar.hoparlorId).catch(() => {});
    }

    const track = sesPaneliDestination.stream.getAudioTracks()[0];
    sesPaneliTrack = new LivekitClient.LocalAudioTrack(track);
    await room.localParticipant.publishTrack(sesPaneliTrack, { source: Track.Source.Unknown, name: 'sesPaneli' });
  } catch (e) {
    console.warn('Ses paneli başlatılamadı', e);
  }
}

function sesPaneliDurdur() {
  if (sesPaneliTrack && room) {
    room.localParticipant.unpublishTrack(sesPaneliTrack).catch(() => {});
    sesPaneliTrack.stop();
    sesPaneliTrack = null;
  }
  if (sesPaneliYerelMonitorEl) {
    sesPaneliYerelMonitorEl.pause();
    sesPaneliYerelMonitorEl.srcObject = null;
    sesPaneliYerelMonitorEl = null;
  }
  sesPaneliAudioContext = null;
  sesPaneliGainNode = null;
  sesPaneliDestination = null;
}

async function sesCal(sesUrl) {
  if (!sesPaneliAudioContext || !sesPaneliGainNode) return;
  try {
    const resp = await fetch(sesUrl);
    const arrayBuffer = await resp.arrayBuffer();
    const audioBuffer = await sesPaneliAudioContext.decodeAudioData(arrayBuffer);
    const kaynak = sesPaneliAudioContext.createBufferSource();
    kaynak.buffer = audioBuffer;
    kaynak.connect(sesPaneliGainNode);
    kaynak.start();
  } catch (e) {
    console.warn('Ses çalınamadı', e);
  }
}
elBtnEkranPaylas.addEventListener('click', async () => {
  if (ekranPaylasimTrack) {
    await ekranPaylasimiDurdur();
    return;
  }

  const kaynaklar = await window.electronAPI.getScreenSources();
  elKaynakListesi.innerHTML = '';
  kaynaklar.forEach((kaynak) => {
    const oge = document.createElement('div');
    oge.className = 'kaynak-ogesi';
    const img = document.createElement('img');
    img.src = kaynak.thumbnail;
    const adSpan = document.createElement('span');
    adSpan.textContent = kaynak.name;
    oge.append(img, adSpan);
    oge.addEventListener('click', () => kaynakSecildi(kaynak.id));
    elKaynakListesi.appendChild(oge);
  });
  elModal.classList.remove('gizli');
  const elKaliteSecim = document.getElementById('kaliteSecim');
});

async function ekranPaylasimiDurdur(oda = room) {
  const eskiVideoTrack = ekranPaylasimTrack;
  const eskiSesTrack = sistemSesiTrack;
  ekranPaylasimTrack = null;
  sistemSesiTrack = null;

  if (eskiVideoTrack && oda) {
    await oda.localParticipant.unpublishTrack(eskiVideoTrack).catch(() => {});
  }
  eskiVideoTrack?.stop();

  if (eskiSesTrack && oda) {
    await oda.localParticipant.unpublishTrack(eskiSesTrack).catch(() => {});
  }
  eskiSesTrack?.stop();

  elBtnEkranPaylas.classList.remove('aktif-kapali');
  if (!eskiVideoTrack && !eskiSesTrack) return;

  document.getElementById('sesYayinBitti').play().catch(() => {});
}
elBtnKaynakIptal.addEventListener('click', () => elModal.classList.add('gizli'));

async function kaynakSecildi(kaynakId) {
  elModal.classList.add('gizli');
  try {
    // Seçilen kaliteye göre çözünürlük + fps + hedef bitrate
    const kaliteMap = {
      '4k':   { width: 3840, height: 2160, frameRate: 30, bitrate: 8_000_000 },
      '2k':   { width: 2560, height: 1440, frameRate: 30, bitrate: 5_000_000 },
      '1080p':{ width: 1920, height: 1080, frameRate: 30, bitrate: 3_000_000 },
      '720p': { width: 1280, height: 720,  frameRate: 24, bitrate: 1_500_000 },
      '480p': { width: 854,  height: 480,  frameRate: 15, bitrate: 800_000 }
    };
    const elKaliteSecim = document.getElementById('kaliteSecim');
    const seciliKalite = elKaliteSecim.value;
    const { width, height, frameRate, bitrate } = kaliteMap[seciliKalite] || kaliteMap['1080p'];

    const videoConstraints = {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: kaynakId,
        maxWidth: width,
        maxHeight: height,
        maxFrameRate: frameRate
      }
    };

    let stream;
    let sistemSesiVarMi = false;
    try {
      // Once ses + goruntuyu birlikte iste (sadece "Tum Ekran" secilirse calisir)
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { mandatory: { chromeMediaSource: 'desktop' } },
        video: videoConstraints
      });
      sistemSesiVarMi = stream.getAudioTracks().length > 0;
    } catch (sesHatasi) {
      // Ses alinamadi (ornegin tek bir pencere secildi) - sadece goruntu ile devam et
      console.warn('Sistem sesi alinamadi, sadece goruntu paylasilacak.', sesHatasi);
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: videoConstraints
      });
    }

    const mediaTrack = stream.getVideoTracks()[0];
    mediaTrack.onended = () => elBtnEkranPaylas.click();

    const gercekAyar = mediaTrack.getSettings();
    console.log('İstenen:', width + 'x' + height, '| Gerçek:', gercekAyar.width + 'x' + gercekAyar.height, '| FPS:', gercekAyar.frameRate, '| Sistem sesi:', sistemSesiVarMi);

    ekranPaylasimTrack = new LivekitClient.LocalVideoTrack(mediaTrack);
    await room.localParticipant.publishTrack(ekranPaylasimTrack, {
      source: Track.Source.ScreenShare,
      name: 'screen',
      simulcast: false,
      videoEncoding: {
        maxBitrate: bitrate,
        maxFramerate: frameRate
      }
    });

    if (sistemSesiVarMi) {
      const sesTrack = stream.getAudioTracks()[0];
      sistemSesiTrack = new LivekitClient.LocalAudioTrack(sesTrack);
      await room.localParticipant.publishTrack(sistemSesiTrack, {
        source: Track.Source.ScreenShareAudio,
        name: 'screenAudio'
      });
    }

    elBtnEkranPaylas.classList.add('aktif-kapali');
    document.getElementById('sesYayinBasladi').play().catch(() => {});
  } catch (err) {
    console.error('Ekran paylaşımı başlatılamadı', err);
  }
}

// ---- Sohbet ----
elBtnSohbetAcKapat.addEventListener('click', () => {
  elSohbetPaneli.classList.toggle('gizli');
});
const elBtnKanaldanAyril = document.getElementById('btnKanaldanAyril');
elBtnKanaldanAyril.addEventListener('click', () => {
  if (room) room.disconnect();
});

function sohbetMesajIdUret() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function kullaniciAdminMi(ad) {
  const isim = String(ad || '').trim().toLowerCase();
  if (!isim) return false;
  const admins = Array.isArray(window.APP_CONFIG?.ADMIN_USERS) ? window.APP_CONFIG.ADMIN_USERS : [];
  return admins.some((g) => String(g).trim().toLowerCase() === isim);
}

function sohbetMesajiYayinla(payload) {
  if (!room || !payload) return;
  room.localParticipant.publishData(
    new TextEncoder().encode(JSON.stringify(payload)),
    { reliable: true }
  );
}

function silSohbetMesaji(messageId) {
  if (!messageId) return;
  const mesajEl = elSohbetMesajlari.querySelector(`[data-message-id="${CSS.escape(String(messageId))}"]`);
  mesajEl?.remove();
}

async function sohbetMesajiniSunucuyaKaydet(payload) {
  if (!payload || !aktifKanal?.name) return;
  try {
    await fetch(`${window.APP_CONFIG.TOKEN_SERVER_URL}/chat-messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: aktifKanal.name, message: payload })
    });
  } catch (error) {
    console.warn('Mesaj sunucuya kaydedilemedi:', error);
  }
}

async function sohbetGecmisiniYukle(kanalAdi) {
  try {
    const response = await fetch(`${window.APP_CONFIG.TOKEN_SERVER_URL}/chat-messages/${encodeURIComponent(kanalAdi)}`);
    if (!response.ok) throw new Error(`History request failed: ${response.status}`);
    const mesajlar = await response.json();
    mesajlar.forEach((payload) => {
      const attachment = payload.attachment || null;
      sohbetMesajiEkle(payload.yazar, payload.metin || attachment?.filename || '', payload.yazar === mevcutKullanici?.name, payload);
    });
  } catch (error) {
    console.warn('Mesaj geçmişi yüklenemedi:', error);
  }
}

async function silChatDosya(attachment) {
  if (!attachment?.id || !attachment?.url) return;
}

function acilacakMedyaGoster(attachment) {
  if (!attachment?.url) return;
  const content = document.createElement('div');
  const mimeType = attachment.mimeType || '';

  if (mimeType.startsWith('image/')) {
    const img = document.createElement('img');
    img.src = attachment.url;
    img.alt = attachment.filename || 'Görüntü';
    content.appendChild(img);
  } else if (mimeType.startsWith('video/')) {
    const video = document.createElement('video');
    video.src = attachment.url;
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    content.appendChild(video);
  } else {
    const link = document.createElement('a');
    link.href = attachment.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = `Dosyayı aç: ${attachment.filename || 'dosya'}`;
    content.appendChild(link);
  }

  elChatMediaContent.innerHTML = '';
  elChatMediaContent.appendChild(content);
  elChatMediaModal.classList.remove('gizli');
}

function medyaIndir(attachment) {
  if (!attachment?.url) return;
  if (window.electronAPI && typeof window.electronAPI.saveFileFromUrl === 'function') {
    window.electronAPI.saveFileFromUrl(attachment.url, attachment.filename || 'dosya');
    return;
  }
  const a = document.createElement('a');
  a.href = attachment.url;
  a.download = attachment.filename || 'dosya';
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function sohbetGonder() {
  const metin = elSohbetInput.value.trim();
  if (!metin || !room) return;
  const payload = { tip: 'chat-message', id: sohbetMesajIdUret(), yazar: mevcutKullanici.name, metin, zaman: Date.now() };
  sohbetMesajiYayinla(payload);
  sohbetMesajiniSunucuyaKaydet(payload);
  sohbetMesajiEkle(mevcutKullanici.name, metin, true, payload);
  elSohbetInput.value = '';
}

async function chatDosyaGonder() {
  const dosya = elChatFileInput.files && elChatFileInput.files[0];
  if (!dosya || !room) return;

  const limitBytes = (window.APP_CONFIG?.MAX_CHAT_ATTACHMENT_MB || 100) * 1024 * 1024;
  if (dosya.size > limitBytes) {
    alert(t('dosyaCokBuyuk'));
    elChatFileInput.value = '';
    return;
  }

  const form = new FormData();
  form.append('file', dosya);
  form.append('uploader', mevcutKullanici?.name || 'unknown');
  form.append('channel', aktifKanal?.name || 'general');

  try {
    const response = await fetch(`${window.APP_CONFIG.TOKEN_SERVER_URL}/chat-attachments/upload`, {
      method: 'POST',
      body: form
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    const sonuc = await response.json();
    const attachment = {
      id: sonuc.id || sohbetMesajIdUret(),
      url: sonuc.url,
      filename: sonuc.filename || dosya.name,
      mimeType: sonuc.mimeType || dosya.type || 'application/octet-stream',
      size: sonuc.size || dosya.size,
      isImage: !!(sonuc.mimeType || dosya.type || '').startsWith('image/'),
      isVideo: !!(sonuc.mimeType || dosya.type || '').startsWith('video/')
    };

    const payload = {
      tip: 'chat-attachment',
      id: attachment.id,
      yazar: mevcutKullanici.name,
      metin: attachment.filename,
      attachment,
      zaman: Date.now()
    };

    sohbetMesajiYayinla(payload);
    sohbetMesajiniSunucuyaKaydet(payload);
    sohbetMesajiEkle(mevcutKullanici.name, attachment.filename, true, payload);
  } catch (error) {
    console.error('Chat dosya upload hatasi', error);
    alert(t('dosyaYuklemeHatasi'));
  } finally {
    elChatFileInput.value = '';
  }
}

elBtnSohbetGonder.addEventListener('click', sohbetGonder);
elSohbetInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sohbetGonder(); });
elBtnChatEk.addEventListener('click', () => elChatFileInput.click());
elChatFileInput.addEventListener('change', chatDosyaGonder);
elChatMediaClose.addEventListener('click', () => elChatMediaModal.classList.add('gizli'));
elChatMediaModal.addEventListener('click', (event) => {
  if (event.target === elChatMediaModal) elChatMediaModal.classList.add('gizli');
});

function sohbetMesajIceriginiHazirla(metin) {
  if (!metin || typeof metin !== 'string') return document.createTextNode('');

  const fragman = document.createDocumentFragment();
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  let sonIndex = 0;

  for (const eslesme of metin.matchAll(urlRegex)) {
    const baslangic = eslesme.index ?? 0;
    const bitis = baslangic + eslesme[0].length;

    if (baslangic > sonIndex) {
      fragman.appendChild(document.createTextNode(metin.slice(sonIndex, baslangic)));
    }

    const rawUrl = eslesme[0];
    const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    const link = document.createElement('a');
    link.href = url;
    link.textContent = rawUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.color = '#60a5fa';
    link.style.textDecoration = 'underline';
    link.style.cursor = 'pointer';
    link.style.wordBreak = 'break-word';

    link.addEventListener('click', (event) => {
      event.preventDefault();
      if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
        window.electronAPI.openExternal(url);
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    });

    fragman.appendChild(link);
    sonIndex = bitis;
  }

  if (sonIndex < metin.length) {
    fragman.appendChild(document.createTextNode(metin.slice(sonIndex)));
  }

  return fragman;
}

function sohbetMesajiEkle(yazar, metin, benMi, payload = null) {
  const div = document.createElement('div');
  div.className = 'sohbet-mesaj';
  div.dataset.messageId = payload?.id || sohbetMesajIdUret();

  const yazarEl = document.createElement('div');
  yazarEl.className = 'yazar';
  const zamanStr = payload?.zaman ? new Date(payload.zaman).toLocaleTimeString('tr-TR', {hour: '2-digit', minute: '2-digit'}) : '';
  yazarEl.textContent = `${yazar}${benMi ? ' (sen)' : ''} ${zamanStr ? '• ' + zamanStr : ''}`;

  const metinEl = document.createElement('div');
  metinEl.className = 'metin';

  const attachment = payload?.attachment;
  const medyaKapsayici = document.createElement('div');
  medyaKapsayici.className = 'chat-besleme';

  if (attachment?.url) {
    const dosyaTipi = attachment.mimeType || '';
    if (dosyaTipi.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = attachment.url;
      img.alt = attachment.filename || 'image';
      const wrap = document.createElement('div');
      wrap.className = 'chat-ek-ortam';
      wrap.addEventListener('click', () => acilacakMedyaGoster(attachment));
      wrap.appendChild(img);
      medyaKapsayici.appendChild(wrap);
    } else if (dosyaTipi.startsWith('video/')) {
      const video = document.createElement('video');
      video.src = attachment.url;
      video.controls = true;
      video.preload = 'metadata';
      const wrap = document.createElement('div');
      wrap.className = 'chat-ek-ortam';
      wrap.addEventListener('click', () => acilacakMedyaGoster(attachment));
      wrap.appendChild(video);
      medyaKapsayici.appendChild(wrap);
    }

    const link = document.createElement('a');
    link.href = attachment.url;
    link.className = 'chat-ek-link';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = attachment.filename || 'Dosya indir';
    link.addEventListener('click', (event) => {
      event.preventDefault();
      if (attachment.mimeType?.startsWith('image/') || attachment.mimeType?.startsWith('video/')) {
        acilacakMedyaGoster(attachment);
        return;
      }
      medyaIndir(attachment);
    });
    medyaKapsayici.appendChild(link);

    const downloadBtn = document.createElement('button');
    downloadBtn.type = 'button';
    downloadBtn.className = 'chat-download-btn';
    downloadBtn.textContent = '⬇️ İndir';
    downloadBtn.addEventListener('click', () => medyaIndir(attachment));
    medyaKapsayici.appendChild(downloadBtn);
  }

  const metinText = typeof metin === 'string' && metin.trim() && !attachment?.url ? metin : '';
  if (metinText) {
    metinEl.appendChild(sohbetMesajIceriginiHazirla(metinText));
  }
  if (medyaKapsayici.childNodes.length) {
    metinEl.appendChild(medyaKapsayici);
  }

  const silButonu = document.createElement('button');
  silButonu.type = 'button';
  silButonu.className = 'chat-sil-btn';
  silButonu.textContent = t('mesajSil');
  silButonu.title = t('mesajSil');
  const isOwnMessage = benMi || (mevcutKullanici && yazar === mevcutKullanici.name);
  const isAdmin = kullaniciAdminMi(yazar) || kullaniciAdminMi(mevcutKullanici?.name);
  if (isOwnMessage || isAdmin) {
    silButonu.addEventListener('click', async () => {
      const targetId = div.dataset.messageId;
      if (!targetId) return;

      const attachment = payload?.attachment;
      try {
        const response = await fetch(`${window.APP_CONFIG.TOKEN_SERVER_URL}/chat-messages/${encodeURIComponent(targetId)}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requester: mevcutKullanici?.name || '' })
        });
        if (!response.ok) throw new Error(`Delete request failed: ${response.status}`);
      } catch (error) {
        console.warn('Mesaj sunucudan silinemedi:', error);
        return;
      }

      const payloadDelete = { tip: 'chat-delete', id: targetId, yazar: mevcutKullanici?.name || 'admin', zaman: Date.now() };
      sohbetMesajiYayinla(payloadDelete);
      silSohbetMesaji(targetId);
    });
    div.append(yazarEl, metinEl, silButonu);
  } else {
    div.append(yazarEl, metinEl);
  }

  elSohbetMesajlari.appendChild(div);
  elSohbetMesajlari.scrollTop = elSohbetMesajlari.scrollHeight;
}

// ---- Ayarlar penceresi ----
const elBtnAyarlar = document.getElementById('btnAyarlar');
const elAyarlarModal = document.getElementById('ayarlarModal');
const elBtnAyarlarKapat = document.getElementById('btnAyarlarKapat');
const elAyarMikrofonSecim = document.getElementById('ayarMikrofonSecim');
const elAyarHoparlorSecim = document.getElementById('ayarHoparlorSecim');
const elAyarAnaSesSeviyesi = document.getElementById('ayarAnaSesSeviyesi');
const elKisayolMikrofonBtn = document.getElementById('kisayolMikrofonBtn');
const elKisayolYayinBtn = document.getElementById('kisayolYayinBtn');
const elAyarSesLevelFill = document.getElementById('ayarSesLevelFill');

let sesLevelAnimasyonId = null;

function ayarlarSesSeviyesiGoster() {
  if (!mikrofonAnalyserNode) return;
  
  const veriDizisi = new Uint8Array(mikrofonAnalyserNode.frequencyBinCount);
  mikrofonAnalyserNode.getByteTimeDomainData(veriDizisi);
  
  let toplam = 0;
  for (let i = 0; i < veriDizisi.length; i++) {
    toplam += veriDizisi[i];
  }
  const ortalama = toplam / veriDizisi.length;
  
  // 0-255 → 0-100% (128 = sessizlik, 255 = max ses)
  const yuzde = Math.min(100, (ortalama / 255) * 100);
  elAyarSesLevelFill.style.width = yuzde + '%';
  
  sesLevelAnimasyonId = requestAnimationFrame(ayarlarSesSeviyesiGoster);
}

elBtnAyarlar.addEventListener('click', async () => {
  await cihazlariListele();
  kisayolMetniGoster();
  ayarlariGuncelle();  // ⭐ KRITIK: Ayarlar modal açılınca, kaydedilen değerleri slider'lara yükle
  elAyarlarModal.classList.remove('gizli');
  
  // Ses level animasyonunu başlat
  if (sesLevelAnimasyonId) cancelAnimationFrame(sesLevelAnimasyonId);
  sesLevelAnimasyonId = requestAnimationFrame(ayarlarSesSeviyesiGoster);
});

elBtnAyarlarKapat.addEventListener('click', () => {
  elAyarlarModal.classList.add('gizli');
  
  // Ses level animasyonunu durdur
  if (sesLevelAnimasyonId) {
    cancelAnimationFrame(sesLevelAnimasyonId);
    sesLevelAnimasyonId = null;
    elAyarSesLevelFill.style.width = '0%';
  }
});

const elAyarGurultuSuppression = document.getElementById('ayarGurultuSuppression');
const elAyarSesEsigi = document.getElementById('ayarSesEsigi');
const elSesEsigiMetin = document.getElementById('sesEsigiMetin');

elAyarSesEsigi.addEventListener('input', async () => {
  ayarlar.sesEsigi = Number(elAyarSesEsigi.value);
  elSesEsigiMetin.textContent = `${ayarlar.sesEsigi} dB`;
  await ayarlariKaydet();
  
  // ⭐ KRITIK: Ses eşiği değişince interval'i restart et, değişiklik hemen uygulanır
  if (esikOlcumInterval) {
    clearInterval(esikOlcumInterval);
    sesEsigiOlcumuBaslat();
  }
});

function ayarlariGuncelle() {
  elAyarMikrofonSecim.value = ayarlar.mikrofonId || '';
  elAyarHoparlorSecim.value = ayarlar.hoparlorId || '';
  elAyarAnaSesSeviyesi.value = Math.min(100, ayarlar.anaSesSeviyesi ?? 100);
  elAyarGurultuSuppression.checked = ayarlar.gurultuSuppression ?? false;
  elAyarSesEsigi.value = ayarlar.sesEsigi ?? -30;
  elSesEsigiMetin.textContent = `${ayarlar.sesEsigi ?? -30} dB`;  // ⭐ Metni de güncelle
  elAyarLimiterAcik.checked = ayarlar.limiterAcik ?? true;
  elAyarLimiterEsik.value = ayarlar.limiterEsik ?? -12;
  elLimiterEsikMetin.textContent = `${ayarlar.limiterEsik ?? -12} dB`;
  elAyarSesPaneliSeviyesi.value = ayarlar.sesPaneliSeviyesi ?? 100;
  elAyarMikrofonGirisSeviyesi.value = ayarlar.mikrofonGirisSeviyesi ?? 100;
}

elAyarGurultuSuppression.addEventListener('change', async () => {
  ayarlar.gurultuSuppression = elAyarGurultuSuppression.checked;
  await ayarlariKaydet();
  if (room && aktifKanal?.type === 'voice') {
    await mikrofonKaynaginiDegistir();
  }
});

document.querySelectorAll('.sekme-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sekme-btn').forEach((b) => b.classList.remove('aktif'));
    document.querySelectorAll('.sekme-icerik').forEach((s) => s.classList.add('gizli'));
    btn.classList.add('aktif');
    document.querySelector(`.sekme-icerik[data-icerik="${btn.dataset.sekme}"]`).classList.remove('gizli');
  });
});

async function cihazlariListele() {
  try {
    const gecici = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
    const cihazlar = await navigator.mediaDevices.enumerateDevices();
    gecici?.getTracks().forEach((t) => t.stop());

    elAyarMikrofonSecim.innerHTML = '';
    elAyarHoparlorSecim.innerHTML = '';

    cihazlar.filter((c) => c.kind === 'audioinput').forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.deviceId;
      opt.textContent = c.label || 'Mikrofon';
      if (c.deviceId === ayarlar.mikrofonId) opt.selected = true;
      elAyarMikrofonSecim.appendChild(opt);
    });

    cihazlar.filter((c) => c.kind === 'audiooutput').forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.deviceId;
      opt.textContent = c.label || 'Hoparlör';
      if (c.deviceId === ayarlar.hoparlorId) opt.selected = true;
      elAyarHoparlorSecim.appendChild(opt);
    });

    elAyarAnaSesSeviyesi.value = ayarlar.anaSesSeviyesi ?? 100;
  } catch (e) {
    console.warn('Cihazlar listelenemedi', e);
  }
  ayarlariGuncelle();
}

elAyarMikrofonSecim.addEventListener('change', async () => {
  ayarlar.mikrofonId = elAyarMikrofonSecim.value;
  await ayarlariKaydet();
  if (room && aktifKanal?.type === 'voice') {
    await mikrofonKaynaginiDegistir();
  }
});

elAyarHoparlorSecim.addEventListener('change', async () => {
  ayarlar.hoparlorId = elAyarHoparlorSecim.value;
  await ayarlariKaydet();
  if (room) room.switchActiveDevice('audiooutput', ayarlar.hoparlorId);
  if (sesPaneliYerelMonitorEl?.setSinkId) {
    sesPaneliYerelMonitorEl.setSinkId(ayarlar.hoparlorId).catch(() => {});
  }
});

elAyarAnaSesSeviyesi.addEventListener('input', async () => {
  ayarlar.anaSesSeviyesi = Number(elAyarAnaSesSeviyesi.value);
  tumSesSeviyeleriniYenile();
  await ayarlariKaydet();
});

document.querySelectorAll('.tema-secenek').forEach((btn) => {
  btn.addEventListener('click', async () => {
    ayarlar.tema = btn.dataset.tema;
    document.body.dataset.theme = ayarlar.tema;
    await ayarlariKaydet();
  });
});

document.querySelectorAll('.dil-secenek').forEach((btn) => {
  btn.addEventListener('click', async () => {
    ayarlar.dil = btn.dataset.dil;
    dilUygula(ayarlar.dil);
    kisayolMetniGoster();
    kanalListesiniCiz();
    await ayarlariKaydet();
  });
});

function kisayolMetniGoster() {
  elKisayolMikrofonBtn.textContent = ayarlar.kisayollar?.mikrofonAcKapat || t('kisayolAtanmadi');
  elKisayolYayinBtn.textContent = ayarlar.kisayollar?.yayinDurdur || t('kisayolAtanmadi');
}

function kisayolKaydet(buton, anahtar) {
  buton.textContent = t('kisayolTuslaraBas');
  buton.classList.add('kaydediliyor');

  const dinleyici = async (e) => {
    e.preventDefault();
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

    const parcalar = [];
    if (e.ctrlKey || e.metaKey) parcalar.push('CommandOrControl');
    if (e.shiftKey) parcalar.push('Shift');
    if (e.altKey) parcalar.push('Alt');

    // En az bir değiştirici tuş (Ctrl/Alt/Shift) olmadan kısayol kabul etme —
    // tek başına bir tuş (örn. sadece "M") genelde işletim sistemi tarafından reddedilir.
    if (parcalar.length === 0) {
      buton.textContent = t('kisayolModifierUyari');
      setTimeout(() => { buton.textContent = t('kisayolTekrarDene'); }, 1500);
      return;
    }

    parcalar.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
    const kombinasyon = parcalar.join('+');

    ayarlar.kisayollar[anahtar] = kombinasyon;
    const sonuc = await ayarlariKaydet();
    window.removeEventListener('keydown', dinleyici, true);
    buton.classList.remove('kaydediliyor');

    const basariliMi = sonuc?.kisayolSonuclari?.[anahtar];
    if (basariliMi === false) {
      buton.textContent = `⚠️ ${kombinasyon} ${t('kisayolBasarisiz')}`;
    } else {
      kisayolMetniGoster();
    }
  };
  window.addEventListener('keydown', dinleyici, true);
}

elKisayolMikrofonBtn.addEventListener('click', () => kisayolKaydet(elKisayolMikrofonBtn, 'mikrofonAcKapat'));
elKisayolYayinBtn.addEventListener('click', () => kisayolKaydet(elKisayolYayinBtn, 'yayinDurdur'));

const elBtnTamEkran = document.getElementById('btnTamEkran');
elBtnTamEkran.addEventListener('click', () => {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    elYayinVideo.requestFullscreen();
  }
});
elYayinVideo.addEventListener('dblclick', () => elBtnTamEkran.click());

const elAyarLimiterAcik = document.getElementById('ayarLimiterAcik');
const elAyarLimiterEsik = document.getElementById('ayarLimiterEsik');
const elLimiterEsikMetin = document.getElementById('limiterEsikMetin');

elAyarLimiterAcik.addEventListener('change', async () => {
  ayarlar.limiterAcik = elAyarLimiterAcik.checked;
  await ayarlariKaydet();
  limiterBaglantisiniUygula();
});

elAyarLimiterEsik.addEventListener('input', async () => {
  ayarlar.limiterEsik = Number(elAyarLimiterEsik.value);
  elLimiterEsikMetin.textContent = `${ayarlar.limiterEsik} dB`;
  if (mikrofonLimiterNode) mikrofonLimiterNode.threshold.value = ayarlar.limiterEsik;
  await ayarlariKaydet();
});

const elBtnSesPaneli = document.getElementById('btnSesPaneli');
const elSesPaneliModal = document.getElementById('sesPaneliModal');
const elBtnSesPaneliKapat = document.getElementById('btnSesPaneliKapat');
const elSesPaneliGrid = document.getElementById('sesPaneliGrid');
const elYeniSesIsim = document.getElementById('yeniSesIsim');
const elYeniSesDosya = document.getElementById('yeniSesDosya');
const elBtnYeniSesEkle = document.getElementById('btnYeniSesEkle');
const elSesEkleHata = document.getElementById('sesEkleHata');
const elAyarSesPaneliSeviyesi = document.getElementById('ayarSesPaneliSeviyesi');

elBtnSesPaneli.addEventListener('click', async () => {
  await sesListesiniYukle();
  elSesPaneliModal.classList.remove('gizli');
});
elBtnSesPaneliKapat.addEventListener('click', () => elSesPaneliModal.classList.add('gizli'));

async function sesListesiniYukle() {
  try {
    const resp = await fetch(`${window.APP_CONFIG.TOKEN_SERVER_URL}/sesler`);
    sesListesi = await resp.json();
  } catch (e) {
    sesListesi = [];
  }
  sesPaneliGridCiz();
}

function sesPaneliGridCiz() {
  elSesPaneliGrid.innerHTML = '';
  sesListesi.forEach((ses) => {
    const btn = document.createElement('button');
    btn.className = 'ses-tus';
    btn.textContent = ses.isim;
    btn.addEventListener('click', () => {
      sesCal(`${window.APP_CONFIG.TOKEN_SERVER_URL}/ses-dosyalari/${ses.dosyaAdi}`);
    });
    elSesPaneliGrid.appendChild(btn);
  });
}

function secilenSesGecerliMi() {
  const isimGecerli = elYeniSesIsim.value.trim().length > 0 && elYeniSesIsim.value.length <= 15;
  return isimGecerli && secilenSesDosyasi;
}

elYeniSesIsim.addEventListener('input', () => {
  elBtnYeniSesEkle.disabled = !secilenSesGecerliMi();
});

elYeniSesDosya.addEventListener('change', () => {
  elSesEkleHata.textContent = '';
  secilenSesDosyasi = null;
  elBtnYeniSesEkle.disabled = true;

  const dosya = elYeniSesDosya.files[0];
  if (!dosya) return;

  const geciciAudio = new Audio();
  geciciAudio.src = URL.createObjectURL(dosya);
  geciciAudio.addEventListener('loadedmetadata', () => {
    if (geciciAudio.duration > 5.5) {
      elSesEkleHata.textContent = `${t('sesUzunlukFazla')} ${geciciAudio.duration.toFixed(1)} ${t('sesUzunHata')}`;
      URL.revokeObjectURL(geciciAudio.src);
      return;
    }
    secilenSesDosyasi = dosya;
    elBtnYeniSesEkle.disabled = !secilenSesGecerliMi();
    URL.revokeObjectURL(geciciAudio.src);
  });
  geciciAudio.addEventListener('error', () => {
      elSesEkleHata.textContent = t('sesGecersizDosya');
  });
});

elBtnYeniSesEkle.addEventListener('click', async () => {
  if (!secilenSesGecerliMi()) return;
  elBtnYeniSesEkle.disabled = true;
  elBtnYeniSesEkle.textContent = t('sesEklemeYukleniyor');
  elSesEkleHata.textContent = '';

  try {
    const formData = new FormData();
    formData.append('isim', elYeniSesIsim.value.trim());
    formData.append('dosya', secilenSesDosyasi);

    const resp = await fetch(`${window.APP_CONFIG.TOKEN_SERVER_URL}/sesler`, {
      method: 'POST',
      body: formData
    });
    if (!resp.ok) throw new Error('Sunucu hatası: ' + resp.status);

    elYeniSesIsim.value = '';
    elYeniSesDosya.value = '';
    secilenSesDosyasi = null;
    await sesListesiniYukle();
  } catch (e) {
    elSesEkleHata.textContent = t('sesEklenemedi');
    console.error(e);
  } finally {
    elBtnYeniSesEkle.disabled = !secilenSesGecerliMi();
    elBtnYeniSesEkle.textContent = t('ekle');
  }
});

elAyarSesPaneliSeviyesi.addEventListener('input', async () => {
  ayarlar.sesPaneliSeviyesi = Number(elAyarSesPaneliSeviyesi.value);
  if (sesPaneliGainNode) {
    sesPaneliGainNode.gain.value = ayarlar.sesPaneliSeviyesi / 100;
  }
  if (sesPaneliYerelMonitorEl) {
    sesPaneliYerelMonitorEl.volume = 1; // gain node zaten seviyeyi ayarlıyor, element sabit 1 kalmalı
  }
  await ayarlariKaydet();
});

const elAyarMikrofonGirisSeviyesi = document.getElementById('ayarMikrofonGirisSeviyesi');

elAyarMikrofonGirisSeviyesi.addEventListener('input', async () => {
  ayarlar.mikrofonGirisSeviyesi = Number(elAyarMikrofonGirisSeviyesi.value);
  if (mikrofonGainNode) {
    // sesEsigiOlcumuBaslat de gain'i degistiriyor (gate icin), o yuzden temel seviyeyi
    // ayri bir baz deger olarak tutup carpiyoruz - basit yontem: dogrudan ata,
    // esik olcumu zaten periyodik olarak uzerine yazacak (0 veya 1 * mevcutKazanc)
    mikrofonGainNode.gain.value = ayarlar.mikrofonGirisSeviyesi / 100;
  }
  await ayarlariKaydet();
});