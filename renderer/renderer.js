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
const elSohbetPaneli = document.getElementById('sohbetPaneli');
const elSohbetMesajlari = document.getElementById('sohbetMesajlari');
const elSohbetInput = document.getElementById('sohbetInput');
const elBtnSohbetGonder = document.getElementById('btnSohbetGonder');
const elModal = document.getElementById('kaynakSecimModal');
const elKaynakListesi = document.getElementById('kaynakListesi');
const elBtnKaynakIptal = document.getElementById('btnKaynakIptal');

// ---- Durum ----
let mevcutKullanici = null; // { name, email? }
let ayarlar = null;
let room = null;
let aktifKanal = null; // config.js'teki kanal objesi
let mikrofonAcik = true;
let ekranPaylasimTrack = null;
let izlenenYayinKimlik = null;
const sesElementleri = new Map();
const oncekiSesSeviyeleri = new Map();

init();

async function init() {
  ayarlar = await window.electronAPI.getSettings();
  document.body.dataset.theme = ayarlar.tema;

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
  await window.electronAPI.saveSettings(ayarlar);
}

// ---- Giriş ekranı ----
elBtnDevam.addEventListener('click', () => {
  const ad = elGirisAd.value.trim();
  if (!ad) {
    elGirisHata.textContent = 'Lütfen adını yaz.';
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
  elBtnGoogleGiris.textContent = 'Tarayıcıda giriş yapılıyor...';
  try {
    const profil = await window.electronAPI.googleLogin();
    mevcutKullanici = { name: profil.name, email: profil.email };
    window.electronAPI.saveUser(mevcutKullanici);
    uygulamayaGec();
  } catch (err) {
    console.error(err);
    elGirisHata.textContent = 'Google ile giriş yapılamadı.';
  } finally {
    elBtnGoogleGiris.disabled = false;
    elBtnGoogleGiris.textContent = 'Google ile Giriş Yap';
  }
});

elBtnCikisYap.addEventListener('click', async () => {
  if (room) { room.disconnect(); room = null; }
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
    oge.innerHTML = `<span class="kanal-simge">${simge}</span><span>${kanal.name}</span>`;

    // Çift tık: kanala katıl
    oge.addEventListener('dblclick', () => kanalaGec(kanal));

    const katilimciListesi = document.createElement('div');
    katilimciListesi.className = 'kanal-katilimcilari acik'; // her zaman açık
    katilimciListesi.innerHTML = '<span class="kanal-katilimci-yok">Yükleniyor...</span>';

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
      if (isimler.length === 0) {
        element.innerHTML = '<span class="kanal-katilimci-yok">Kimse yok</span>';
      } else {
        element.innerHTML = isimler
          .map((ad) => `<div class="kanal-katilimci-satiri">🟢 ${ad}</div>`)
          .join('');
      }
    } catch (e) {
      element.innerHTML = '<span class="kanal-katilimci-yok">Alınamadı</span>';
    }
  }
}

// Sidebar acikken kanal listelerini 5 saniyede bir tazele
setInterval(() => {
  if (!elAppEkran.classList.contains('gizli') && kanalKatilimciElementleri.length > 0) {
    tumKanalKatilimcilariniGuncelle();
  }
}, 5000);

async function kanalaGec(kanal) {
  if (aktifKanal?.name === kanal.name) return;

  if (room) {
    room.disconnect();
    room = null;
  }
  sesElementleri.forEach((el) => el.remove());
  sesElementleri.clear();
  oncekiSesSeviyeleri.clear();
  elYayinAlani.classList.add('gizli');
  elSohbetMesajlari.innerHTML = '';
  ekranPaylasimTrack = null;

  elAktifKanalAdi.textContent = 'Bağlanıyor...';

  try {
    const resp = await fetch(`${window.APP_CONFIG.TOKEN_SERVER_URL}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: kanal.name, name: mevcutKullanici.name })
    });

    if (resp.status === 409) {
      elAktifKanalAdi.textContent = 'Bir kanal seç';
      alert(`"${mevcutKullanici.name}" ismi bu kanalda zaten kullanılıyor. Lütfen adını değiştir (çıkış yapıp tekrar gir).`);
      return;
    }
    if (!resp.ok) throw new Error('Token sunucusu hata verdi: ' + resp.status);

    const { token, url } = await resp.json();

    room = new Room({ adaptiveStream: true, dynacast: true });
    baglaOlayDinleyicileri();

    await room.connect(url, token, { autoSubscribe: false });

    if (kanal.type === 'voice') {
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
        if (ayarlar.mikrofonId) await room.switchActiveDevice('audioinput', ayarlar.mikrofonId);
      } catch (e) {
        console.warn('Mikrofon bulunamadı, sessiz katılıyorum.', e);
      }
      elBtnMikrofon.classList.remove('gizli');
      elBtnEkranPaylas.classList.remove('gizli');
      mikrofonAcik = true;
      elBtnMikrofon.textContent = '🎙️';
      elBtnMikrofon.classList.remove('aktif-kapali');
    } else {
      elBtnMikrofon.classList.add('gizli');
      elBtnEkranPaylas.classList.add('gizli');
    }

    aktifKanal = kanal;
    elAktifKanalAdi.textContent = (kanal.type === 'text' ? '💬 ' : '# ') + kanal.name;
    kanalListesiniCiz();
    katilimcilariYenidenCiz();

  } catch (err) {
    console.error(err);
    elAktifKanalAdi.textContent = 'Bağlanılamadı';
    alert('Bağlanılamadı. Token sunucusu adresini kontrol et.');
  }
}

function baglaOlayDinleyicileri() {
  room.on(RoomEvent.ParticipantConnected, katilimcilariYenidenCiz);
  room.on(RoomEvent.ParticipantDisconnected, (p) => {
    sesElementleri.get(p.sid)?.remove();
    sesElementleri.delete(p.sid);
    katilimcilariYenidenCiz();
  });

  room.on(RoomEvent.TrackPublished, (publication) => {
    if (publication.kind === Track.Kind.Audio) publication.setSubscribed(true);
    katilimcilariYenidenCiz();
  });

  room.on(RoomEvent.TrackUnpublished, () => katilimcilariYenidenCiz());

  room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
    if (track.kind === Track.Kind.Audio) {
      const el = track.attach();
      el.style.display = 'none';
      el.volume = (ayarlar.anaSesSeviyesi ?? 100) / 100;
      if (ayarlar.hoparlorId && el.setSinkId) {
        el.setSinkId(ayarlar.hoparlorId).catch(() => {});
      }
      document.body.appendChild(el);
      sesElementleri.set(participant.sid, el);
    } else if (track.kind === Track.Kind.Video && publication.source === Track.Source.ScreenShare) {
      track.attach(elYayinVideo);
      elYayinAlani.classList.remove('gizli');
      izlenenYayinKimlik = participant.sid;
    }
    katilimcilariYenidenCiz();
  });

  room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
    track.detach();
    if (publication.source === Track.Source.ScreenShare && izlenenYayinKimlik === participant.sid) {
      elYayinAlani.classList.add('gizli');
      izlenenYayinKimlik = null;
    }
    katilimcilariYenidenCiz();
  });

  room.on(RoomEvent.ActiveSpeakersChanged, katilimcilariYenidenCiz);

  // ---- Sohbet mesajlari LiveKit veri kanali uzerinden ----
  room.on(RoomEvent.DataReceived, (payload) => {
    try {
      const mesaj = JSON.parse(new TextDecoder().decode(payload));
      sohbetMesajiEkle(mesaj.yazar, mesaj.metin, false);
    } catch (e) {
      console.warn('Sohbet mesaji cozulemedi', e);
    }
  });

  room.on(RoomEvent.Disconnected, () => {
    aktifKanal = null;
    elAktifKanalAdi.textContent = 'Bir kanal seç';
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

    const adSatiri = document.createElement('div');
    adSatiri.className = 'kisi-ad';
    const adSpan = document.createElement('span');
    adSpan.textContent = (katilimci.name || katilimci.identity) + (benMi ? ' (sen)' : '');
    if (konusanlar.has(katilimci.sid)) adSpan.classList.add('rozet-konusuyor');
    adSatiri.appendChild(adSpan);
    satir.appendChild(adSatiri);

    if (!benMi) {
      const kontrolSatiri = document.createElement('div');
      kontrolSatiri.className = 'kisi-kontrol';

      const susturBtn = document.createElement('button');
      susturBtn.className = 'buton-ikincil';
      const susturulduMu = oncekiSesSeviyeleri.get(katilimci.sid) === 0;
      susturBtn.textContent = susturulduMu ? '🔇' : '🔊';
      susturBtn.addEventListener('click', () => {
        const yeniDeger = susturulduMu ? 1 : 0;
        katilimci.setVolume(yeniDeger);
        oncekiSesSeviyeleri.set(katilimci.sid, yeniDeger);
        katilimcilariYenidenCiz();
      });
      kontrolSatiri.appendChild(susturBtn);

      const sesKaydirici = document.createElement('input');
      sesKaydirici.type = 'range';
      sesKaydirici.min = '0';
      sesKaydirici.max = '150';
      sesKaydirici.value = String((oncekiSesSeviyeleri.get(katilimci.sid) ?? 1) * 100);
      sesKaydirici.addEventListener('input', (e) => {
        const oran = Number(e.target.value) / 100;
        katilimci.setVolume(oran);
        oncekiSesSeviyeleri.set(katilimci.sid, oran);
      });
      kontrolSatiri.appendChild(sesKaydirici);
      satir.appendChild(kontrolSatiri);

      const ekranPub = [...katilimci.videoTrackPublications.values()].find(
        (p) => p.source === Track.Source.ScreenShare
      );
      if (ekranPub) {
        const rozet = document.createElement('span');
        const izleniyor = ekranPub.isSubscribed;
        rozet.className = 'yayin-rozeti' + (izleniyor ? '' : ' izlemiyor');
        rozet.textContent = izleniyor ? '🖥️ Yayın açık · izlemeyi bırak' : '🖥️ Yayın var · izle';
        rozet.addEventListener('click', () => ekranPub.setSubscribed(!izleniyor));
        satir.appendChild(rozet);
      }
    }

    elKatilimcilar.appendChild(satir);
  });
}

// ---- Mikrofon / Ekran paylaşımı ----
elBtnMikrofon.addEventListener('click', mikrofonuAcKapa);

function mikrofonuAcKapa() {
  if (!room || aktifKanal?.type !== 'voice') return;
  mikrofonAcik = !mikrofonAcik;
  room.localParticipant.setMicrophoneEnabled(mikrofonAcik);
  elBtnMikrofon.textContent = mikrofonAcik ? '🎙️' : '🔇';
  elBtnMikrofon.classList.toggle('aktif-kapali', !mikrofonAcik);
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
    oge.innerHTML = `<img src="${kaynak.thumbnail}" /><span>${kaynak.name}</span>`;
    oge.addEventListener('click', () => kaynakSecildi(kaynak.id));
    elKaynakListesi.appendChild(oge);
  });
  elModal.classList.remove('gizli');
});

async function ekranPaylasimiDurdur() {
  if (!ekranPaylasimTrack || !room) return;
  await room.localParticipant.unpublishTrack(ekranPaylasimTrack);
  ekranPaylasimTrack.stop();
  ekranPaylasimTrack = null;
  elBtnEkranPaylas.classList.remove('aktif-kapali');
}
elBtnKaynakIptal.addEventListener('click', () => elModal.classList.add('gizli'));

async function kaynakSecildi(kaynakId) {
  elModal.classList.add('gizli');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: kaynakId
        }
      }
    });
    const mediaTrack = stream.getVideoTracks()[0];
    mediaTrack.onended = () => elBtnEkranPaylas.click();

    ekranPaylasimTrack = new LivekitClient.LocalVideoTrack(mediaTrack);
    await room.localParticipant.publishTrack(ekranPaylasimTrack, {
      source: Track.Source.ScreenShare,
      name: 'screen'
    });
    elBtnEkranPaylas.classList.add('aktif-kapali');
  } catch (err) {
    console.error('Ekran paylaşımı başlatılamadı', err);
  }
}

// ---- Sohbet ----
elBtnSohbetAcKapat.addEventListener('click', () => {
  elSohbetPaneli.classList.toggle('gizli');
});

function sohbetGonder() {
  const metin = elSohbetInput.value.trim();
  if (!metin || !room) return;
  const mesaj = { yazar: mevcutKullanici.name, metin };
  room.localParticipant.publishData(
    new TextEncoder().encode(JSON.stringify(mesaj)),
    { reliable: true }
  );
  sohbetMesajiEkle(mevcutKullanici.name, metin, true);
  elSohbetInput.value = '';
}
elBtnSohbetGonder.addEventListener('click', sohbetGonder);
elSohbetInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sohbetGonder(); });

function sohbetMesajiEkle(yazar, metin, benMi) {
  const div = document.createElement('div');
  div.className = 'sohbet-mesaj';
  div.innerHTML = `<div class="yazar">${yazar}${benMi ? ' (sen)' : ''}</div><div class="metin"></div>`;
  div.querySelector('.metin').textContent = metin; // XSS'e karsi guvenli metin atama
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

elBtnAyarlar.addEventListener('click', async () => {
  await cihazlariListele();
  kisayolMetniGoster();
  elAyarlarModal.classList.remove('gizli');
});
elBtnAyarlarKapat.addEventListener('click', () => elAyarlarModal.classList.add('gizli'));

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
}

elAyarMikrofonSecim.addEventListener('change', async () => {
  ayarlar.mikrofonId = elAyarMikrofonSecim.value;
  await ayarlariKaydet();
  if (room) room.switchActiveDevice('audioinput', ayarlar.mikrofonId);
});

elAyarHoparlorSecim.addEventListener('change', async () => {
  ayarlar.hoparlorId = elAyarHoparlorSecim.value;
  await ayarlariKaydet();
  if (room) room.switchActiveDevice('audiooutput', ayarlar.hoparlorId);
});

elAyarAnaSesSeviyesi.addEventListener('input', async () => {
  ayarlar.anaSesSeviyesi = Number(elAyarAnaSesSeviyesi.value);
  sesElementleri.forEach((el) => { el.volume = ayarlar.anaSesSeviyesi / 100; });
  await ayarlariKaydet();
});

document.querySelectorAll('.tema-secenek').forEach((btn) => {
  btn.addEventListener('click', async () => {
    ayarlar.tema = btn.dataset.tema;
    document.body.dataset.theme = ayarlar.tema;
    await ayarlariKaydet();
  });
});

function kisayolMetniGoster() {
  elKisayolMikrofonBtn.textContent = ayarlar.kisayollar?.mikrofonAcKapat || 'Atanmadı';
  elKisayolYayinBtn.textContent = ayarlar.kisayollar?.yayinDurdur || 'Atanmadı';
}

function kisayolKaydet(buton, anahtar) {
  buton.textContent = 'Tuşlara bas...';
  buton.classList.add('kaydediliyor');

  const dinleyici = async (e) => {
    e.preventDefault();
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

    const parcalar = [];
    if (e.ctrlKey || e.metaKey) parcalar.push('CommandOrControl');
    if (e.shiftKey) parcalar.push('Shift');
    if (e.altKey) parcalar.push('Alt');
    parcalar.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);

    ayarlar.kisayollar[anahtar] = parcalar.join('+');
    await ayarlariKaydet();
    kisayolMetniGoster();
    buton.classList.remove('kaydediliyor');
    window.removeEventListener('keydown', dinleyici, true);
  };
  window.addEventListener('keydown', dinleyici, true);
}

elKisayolMikrofonBtn.addEventListener('click', () => kisayolKaydet(elKisayolMikrofonBtn, 'mikrofonAcKapat'));
elKisayolYayinBtn.addEventListener('click', () => kisayolKaydet(elKisayolYayinBtn, 'yayinDurdur'));