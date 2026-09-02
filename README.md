# 🎙️ Funnel Talk

**[🇹🇷 Türkçe](README.md) | [🇬🇧 English](README.en.md)**

Arkadaş grupları için hafif, kendi kendine barındırılan (self-hosted) sesli/görüntülü sohbet uygulaması. Discord'un temel özelliklerini (sesli kanallar, ekran paylaşımı, soundboard, metin sohbeti) küçük bir arkadaş grubu için basit ve tamamen kontrol edilebilir bir altyapı üzerinde sunar.

## 🤔 Neden Bu Proje?

Türkiye'de Discord'un erişim kısıtlamalarından dolayı, arkadaş grubuyla sağlıklı iletişim ve oyun ortamı oluşturmak amacıyla bu projeyi başlattım. Mevcut sesli iletişim uygulamalarının her biri birer açıdan eksik olup, özel ihtiyaçlarımızı tam olarak karşılamadığında, tamamen kendi kontrol ettiğimiz, hafif ve esnek bir çözüm geliştirme fikri doğdu. Böylece sadece arkadaş grubuyla güvenli bir şekilde iletişim kurmakla kalmadık, aynı zamanda oyun oynamak ve sosyal etkinlikler düzenlemek için tek bir platform oluşturabildik.

<p align="center">
  <img src="assets/funnel-talk-login.png" width="32%">
  <img src="assets/funnel-talk-main.png" width="32%">
  <img src="assets/funnel-talk-screen.png" width="32%">
</p>

![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Electron](https://img.shields.io/badge/Electron-31-47848F)
![License](https://img.shields.io/badge/license-Private-lightgrey)

---

## ✨ Özellikler

**Sesli & Görüntülü İletişim**
- Çoklu sesli kanal, tek tıkla katılım
- Kanala girmeden önce kimlerin içeride olduğunu görme (canlı önizleme)
- Ekran paylaşımı — kalite seçimi (480p'den 4K'ya, FPS ve bitrate kontrolü dahil)
- İzleme isteğe bağlı — herkes otomatik izlemez, bant genişliği boşa harcanmaz
- Kim izliyor bilgisi yayın sahibine gösterilir
- Tam ekran izleme desteği

**Ses Kalitesi & Kontrol**
- Kişiye özel ses seviyesi ayarı (%0–%300), her kullanıcı için bağımsız ve kalıcı
- Sesler cihaz kimliğine bağlı olarak saklanır — kullanıcı adını değiştirse bile ayar korunur
- Ses eşiği (voice activation threshold) — düşük seviyeli gürültüyü otomatik keser
- Yüksek ses sınırlayıcı (limiter) — ani bağırma/gürültüyü yumuşatır
- Gürültü engelleme (noise suppression) desteği
- Mikrofon/hoparlör cihaz seçimi, ana ses seviyesi kontrolü

**Soundboard (Ses Paneli)**
- Sunucu genelinde paylaşılan ses efektleri
- Sese basınca yalnızca bulunduğun kanal duyar
- Kolay ses ekleme (maks. 5 saniye, isimli/emoji etiketli)

**Metin Sohbeti & Dosya Paylaşımı**
- Kanal bazlı gerçek zamanlı yazışma, tüm mesajlar sunucuda kalıcı olarak saklanır
- Ayrı metin-only kanal desteği
- Dosya, fotoğraf ve video paylaşımı (100MB sınırı)
- Paylaşılan ekler (resim/video) sohbet içinde önizleme olarak gösterilir
- Klip veya dosyaya tıklayınca modal penceresinde açılır, X butonuyla kapatılabilir
- Tüm dosyalar indirilebilir (Save-As diyaloğu ile)
- Mesaj silinince bağlı dosya da sunucudan fiziksel olarak kaldırılır
- Admin ve mesaj yazarı mesaj silebilir
- Kanal değişildiğinde önceki mesajlar otomatik yüklenir

**Kişiselleştirme**
- 4 tema (Koyu, Açık, Gece Mavisi, Mor)
- Özelleştirilebilir genel kısayollar (mikrofon aç/kapat, yayını durdur) — uygulama arka plandayken de çalışır
- Google ile giriş (isteğe bağlı)
- Oturum ve tüm tercihler kalıcı olarak saklanır

**Altyapı**
- Otomatik güncelleme (GitHub Releases üzerinden)
- Sistem tepsisinde (tray) arka planda çalışma
- Aynı isimle birden fazla kişinin aynı kanala girmesini engelleyen çakışma kontrolü
- Giriş/çıkış, yayın başlama/bitme ve izleyici bildirimleri için ses efektleri

---

## 🏗️ Mimari

```
┌───────────────────┐        ┌───────────────────┐        ┌───────────────────────┐
│  Electron İstemci │◄──────►│   LiveKit Cloud   │◄──────►│   Electron İstemci    │
│    (Windows)      │ WebRTC │  (medya sunucusu) │ WebRTC │      (Windows)        │
└─────────┬─────────┘        └───────────────────┘        └───────────┬───────────┘
          │                                                           │
          │              HTTPS (jeton isteği)                         │
          ▼                                                           ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │          Token Sunucusu (Raspberry Pi + Tailscale Funnel)           │
    │   • Kimlik doğrulama jetonu üretir                                  │
    │   • Kanal başına isim çakışmasını engeller                          │
    │   • Soundboard dosyalarını barındırır                               │
    └─────────────────────────────────────────────────────────────────────┘
```

- **İstemci (Electron)** — arkadaşların bilgisayarına kurduğu masaüstü uygulaması. Tüm ses işleme (gürültü engelleme, limiter, eşik, ses seviyesi karışımı) istemci tarafında Web Audio API ile yapılır.
- **LiveKit Cloud** — sesin/görüntünün gerçek taşıyıcısı. WebRTC tabanlı SFU (Selective Forwarding Unit), medya trafiğini yönlendirir.
- **Token Sunucusu** — küçük bir Node.js/Express servisi, Raspberry Pi üzerinde 7/24 çalışır. Kısa ömürlü erişim jetonları üretir, soundboard dosyalarını ve sohbet eklerini barındırır; hiçbir ses/görüntü verisi buradan geçmez.

---

## 🧱 Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Masaüstü uygulama | Electron 31 |
| Gerçek zamanlı medya | LiveKit (livekit-client / livekit-server-sdk) |
| Token sunucusu | Node.js, Express |
| Ses işleme | Web Audio API (GainNode, DynamicsCompressor, AnalyserNode) |
| Paketleme & dağıtım | electron-builder, electron-updater |
| Barındırma | Raspberry Pi 5 + Tailscale Funnel |
| Kimlik doğrulama | Google OAuth 2.0 (isteğe bağlı) |

---

## 📦 Kurulum (Kullanıcılar için)

Arkadaş grubuna katılmak için geliştirme ortamına ihtiyacınız yok:

1. [Releases](https://github.com/metinncetinn/funnel-talk/releases/latest) sayfasından en son `Funnel-Talk-Setup-X.X.X.exe` dosyasını indirin.
2. Çift tıklayıp kurun. Windows SmartScreen uyarısı çıkarsa **"Daha fazla bilgi" → "Yine de çalıştır"** deyin (imzasız bir uygulama olduğu için normaldir).
3. Uygulamayı açın, adınızı girin (veya Google ile giriş yapın) ve bir kanala tıklayın.

Sonraki güncellemeler otomatik olarak arka planda indirilir; yeniden kurulum gerekmez.

---

## 🛠️ Kurulum (Kendi Sunucunuzu Barındırma)

Bu bölüm, Funnel Talk'ı arkadaş grubuyla paylaşmak için **token sunucusunu kendi bilgisayarda kurmak** isteyenler içindir. Kurulum ~20-30 dakika sürer, teknik bilgi gerekmez.

### Ön Koşullar

- **Node.js 18+** — [nodejs.org](https://nodejs.org/en) adresinden indirin
- **7/24 çalışan bir cihaz**:
  - Eski/atık bir bilgisayar (Windows/Mac/Linux)
  - Raspberry Pi 4+ (önerilir, az enerji tüketir, ~$100)
  - VPS/bulut sunucu (Hetzner, AWS EC2 gibi, aylık ~€5-10)
- **GitHub hesabı** (isteğe bağlı, otomatik güncelleme için)

### Hızlı Kurulum (5 Dakika)

Eğer Raspberry Pi veya Linux sunucusu varsa:

1. `server.js` dosyasını sunucuya kopyala
2. `.env` dosyasını oluştur (aşağıya bak)
3. Terminal aç, sunucu klasörüne git:
   ```bash
   npm install express multer livekit-server-sdk dotenv
   node server.js
   ```
4. Tailscale Funnel aç: `tailscale funnel --bg 3001`
5. Çıkan URL'i `renderer/config.js` içine yapıştır
6. Electron projesini derle: `npm run build`
7. Kurulum dosyasını arkadaşlara gönder

### Detaylı Kurulum (Baştan Başlayanlar için)

#### 1. LiveKit Cloud Hesabı Aç

1. [cloud.livekit.io](https://cloud.livekit.io) ziyaret et
2. Sign up → e-posta ver, hesap oluştur (ücretsiz)
3. Sol menüde **Keys** bölümü aç
4. Aşağıdaki 3 değeri not et:
   - **API Key**: `APxxxxxxxxxxxx`
   - **API Secret**: `xxxxxxxxxxxxxxxxxxxxxx`
   - **URL**: `wss://proj-xxxxx.livekit.cloud`

#### 2. Token Sunucusunu Kur

Bilgisayarında yeni bir klasör oluştur, örn: `funnel-talk-server`

Bu klasöre aşağıdaki 3 dosyayı koy:

**Dosya 1: `.env`**
```env
LIVEKIT_API_KEY=Adım1'den_kopyaladığın_API_KEY
LIVEKIT_API_SECRET=Adım1'den_kopyaladığın_API_SECRET
LIVEKIT_URL=Adım1'den_kopyaladığın_URL
PORT=3001
HOST=0.0.0.0
ADMIN_USERS=admin
```

**Dosya 2: `package.json`**
```json
{
  "name": "funnel-talk-server",
  "version": "1.0.0",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "multer": "^1.4.5",
    "livekit-server-sdk": "^0.6.0",
    "dotenv": "^16.0.0"
  }
}
```

**Dosya 3: `server.js`**

Bu depo içindeki `server.js` dosyasını kopyala (okunuyor dosya)

#### 3. Bağımlılıkları Kur

Terminal/PowerShell aç:
```bash
cd funnel-talk-server  # klasöre gir
npm install
```

#### 4. Test Et

```bash
npm start
```

Şu yazı çıkarsa başarılı:
```
Funnel Talk server 0.0.0.0:3001
```

`Ctrl+C` ile kapat.

#### 5. İnternete Aç (Tailscale Funnel)

[tailscale.com](https://tailscale.com) adresinden kayıt ol, uygulamayı indir ve kur.

Terminal'de:
```bash
tailscale funnel --bg 3001
```

Şu gibi bir URL görürsün:
```
https://bilgisayar-adin.tail123456.ts.net
```

Bu URL'yi **not et** (arkadaşlarınız bunu kullanacak).

#### 6. Electron Uygulamasını Ayarla

Bu depo içinde `renderer/config.js` dosyasını aç, şu satırı değiştir:

```js
TOKEN_SERVER_URL: 'https://bilgisayar-adin.tail123456.ts.net',  // ← Adım 5'teki URL
```

#### 7. Derle ve Gönder

Proje klasöründe (sunucu değil):
```bash
npm install
npm run build
```

`dist/` klasöründe `Funnel-Talk-Setup-X.X.X.exe` dosyası oluşur. Arkadaşlarına gönder, onlar kurup uygulamayı açabilir.

#### 8. Kalıcı Çalıştırma (İsteğe Bağlı)

Sunucu bilgisayar kapanınca açılsın diye:

**Windows (Task Scheduler):**
1. Başlat → "Task Scheduler" aç
2. Sağ taraf → "Create Basic Task"
3. "Trigger" → "At startup"
4. "Action" → Program: `node.exe`, Arguments: `C:\path\to\server.js`
5. "Create"

**Raspberry Pi/Linux (systemd):**
```bash
sudo cp sesli-oda-token.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable sesli-oda-token
sudo systemctl start sesli-oda-token
```

### 💡 Sorun Giderme

| Sorun | Çözüm |
|---|---|
| `PORT 3001 already in use` | Başka bir uygulamayı port'tan çıkart veya `.env`'de PORT'u değiştir |
| Sunucu çalışıyor ama URL'ye girilemiyorum | Tailscale'in yüklü olup `funnel` çalıştırıldığından emin ol |
| İstemci başlatılamıyor / token hatası | `config.js`'deki URL'nin doğru olup olmadığını kontrol et |
| Arkadaş bağlanemiyor | Arkadaş tarafından `.env`'deki değerleri `.env`'de değiştir veya server'ı yeniden başlat |

### 📋 Alternative Hosting

- **VPS (Hetzner, Linode)**: SSH ile bağlan, Node.js + server kur, daima açık
- **Docker**: `Dockerfile` yazıp `docker run` ile çalıştır (ileri seviye)
- **AWS Lambda** veya **Vercel**: Serverless (sunucu yönetimi yok ama biraz pahalı)

---

## ⚙️ Yapılandırma Referansı

| Dosya | Amaç |
|---|---|
| `renderer/config.js` | Token sunucusu adresi, kanal listesi |
| `main.js` | Google OAuth bilgileri, pencere/tray davranışı |
| `token-server/.env` | LiveKit kimlik bilgileri |
| `package.json` → `build` | Uygulama adı, ikon, yayın (publish) ayarları |

---

## ⌨️ Varsayılan Kısayollar

| Eylem | Varsayılan Kısayol |
|---|---|
| Mikrofon Aç/Kapat | `Ctrl+Shift+M` |
| Yayını Durdur | `Ctrl+Shift+S` |

Ayarlar → Kısayollar sekmesinden özelleştirilebilir. Bu kısayollar uygulama arka plandayken de (odak başka bir pencerede olsa bile) çalışır.

---

## 🔒 Güvenlik Notları

- Token sunucusu yalnızca kısa ömürlü (12 saat) LiveKit erişim jetonları üretir; ham API anahtarları hiçbir zaman istemciye gönderilmez.
- `.env` dosyası ve LiveKit kimlik bilgileri bu repoya dahil değildir — `token-server/` klasörü ayrı tutulmalı veya `.gitignore` ile hariç bırakılmalıdır.
- Google OAuth "test" modunda çalışır; yalnızca eklediğiniz test kullanıcıları giriş yapabilir, bu da küçük gruplar için ekstra bir doğrulama sürecine gerek bırakmaz.

---

## 📋 Bilinen Sınırlamalar

- Aynı anda yalnızca bir kişinin ekran paylaşımı ana alanda gösterilir.
- Ekran paylaşımı, işletim sistemi ve seçilen kaynağın izin verdiği durumlarda sistem sesini de paylaşır.
- Uygulama şu an yalnızca Windows için paketlenmektedir.

---

## 🗺️ Yol Haritası

Tamamlananlar:
- [x] Sesli kanallar, ekran paylaşımı ve izleme
- [x] Soundboard ses paneli
- [x] Kanal bazlı metin sohbeti
- [x] Sohbet geçmişinin kalıcı olarak sunucuda saklanması
- [x] Sohbette URL tıklanabilir link desteği
- [x] Sohbet dosya/fotoğraf/video ekleme (100MB sınırı)
- [x] Resim/video eklerin modal önizlemesi
- [x] Dosya indirme desteği
- [x] Admin tarafından mesaj silme yetkisi (dosya dahil temizleme)
- [x] Token sunucusu + LiveKit erişim jetonu üretimi
- [x] Kanal değişildiğinde mesaj geçmişi yükleme

Gelecek hedefler:
- [ ] Çoklu eş zamanlı yayın izleme desteği
- [ ] YouTube/müzik linki paylaşımı ile ortak dinleme botu
- [ ] macOS/Linux paketleme desteği
- [ ] Mesaj arama ve filtreleme

---

## 📄 Lisans

Bu proje özel (private) bir arkadaş grubu projesi olarak geliştirilmiştir.
