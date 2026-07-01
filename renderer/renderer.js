const animasyon = lottie.loadAnimation({
  container: document.getElementById('splashAnimasyon'),
  renderer: 'svg',
  loop: false,
  autoplay: true,
  path: 'loading-animation.json'
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
let room = null;
let aktifKanal = null; // config.js'teki kanal objesi
let mikrofonAcik = true;
let ekranPaylasimTrack = null;
let izlenenYayinKimlik = null;
const sesElementleri = new Map();
const oncekiSesSeviyeleri = new Map();

init();

async function init() {
  const googleVarMi = await window.electronAPI.isGoogleLoginAvailable();
  if (googleVarMi) elGoogleGirisAlani.classList.remove('gizli');

  const kayitliKullanici = await window.electronAPI.getSavedUser();
  if (kayitliKullanici) {
    mevcutKullanici = kayitliKullanici;
    uygulamayaGec();
  }
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
function kanalListesiniCiz() {
  elKanalListesi.innerHTML = '';
  window.APP_CONFIG.CHANNELS.forEach((kanal) => {
    const disKapsayici = document.createElement('div');

    const oge = document.createElement('div');
    oge.className = 'kanal-ogesi' + (aktifKanal?.name === kanal.name ? ' aktif' : '');
    const simge = kanal.type === 'text' ? '💬' : '🔊';
    oge.innerHTML = `<span class="kanal-simge">${simge}</span><span>${kanal.name}</span>`;

    const katilimciListesi = document.createElement('div');
    katilimciListesi.className = 'kanal-katilimcilari';

    // Tek tık: katılmadan sadece kimlerin içeride olduğunu göster/gizle
    oge.addEventListener('click', async () => {
      const acikMi = katilimciListesi.classList.contains('acik');
      // Diğer kanalların açık önizlemelerini kapat
      document.querySelectorAll('.kanal-katilimcilari.acik').forEach((el) => el.classList.remove('acik'));

      if (acikMi) return; // zaten açıktı, sadece kapatmış olduk

      katilimciListesi.innerHTML = '<span class="kanal-katilimci-yok">Yükleniyor...</span>';
      katilimciListesi.classList.add('acik');
      try {
        const resp = await fetch(`${window.APP_CONFIG.TOKEN_SERVER_URL}/katilimcilar/${encodeURIComponent(kanal.name)}`);
        const isimler = await resp.json();
        if (isimler.length === 0) {
          katilimciListesi.innerHTML = '<span class="kanal-katilimci-yok">Kimse yok</span>';
        } else {
          katilimciListesi.innerHTML = isimler
            .map((ad) => `<div class="kanal-katilimci-satiri">🟢 ${ad}</div>`)
            .join('');
        }
      } catch (e) {
        katilimciListesi.innerHTML = '<span class="kanal-katilimci-yok">Alınamadı</span>';
      }
    });

    // Çift tık: kanala gerçekten katıl
    oge.addEventListener('dblclick', () => kanalaGec(kanal));

    disKapsayici.appendChild(oge);
    disKapsayici.appendChild(katilimciListesi);
    elKanalListesi.appendChild(disKapsayici);
  });
}

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

    // Metin kanalindaysak sohbet paneli otomatik acik gelsin
    if (kanal.type === 'text') elSohbetPaneli.classList.remove('gizli');
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
elBtnMikrofon.addEventListener('click', () => {
  if (!room) return;
  mikrofonAcik = !mikrofonAcik;
  room.localParticipant.setMicrophoneEnabled(mikrofonAcik);
  elBtnMikrofon.textContent = mikrofonAcik ? '🎙️' : '🔇';
  elBtnMikrofon.classList.toggle('aktif-kapali', !mikrofonAcik);
});

elBtnEkranPaylas.addEventListener('click', async () => {
  if (ekranPaylasimTrack) {
    await room.localParticipant.unpublishTrack(ekranPaylasimTrack);
    ekranPaylasimTrack.stop();
    ekranPaylasimTrack = null;
    elBtnEkranPaylas.classList.remove('aktif-kapali');
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
