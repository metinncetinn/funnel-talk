# 🎙️ Funnel Talk

**[🇹🇷 Türkçe](README.md) | [🇬🇧 English](README.en.md)**

Arkadaş grupları için hafif, kendi kendine barındırılan (self-hosted) sesli/görüntülü sohbet uygulaması. Discord'un temel özelliklerini (sesli kanallar, ekran paylaşımı, soundboard, metin sohbeti) küçük bir arkadaş grubu için basit ve tamamen kontrol edilebilir bir altyapı üzerinde sunar.

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

**Metin Sohbeti**
- Kanal bazlı gerçek zamanlı yazışma
- Ayrı metin-only kanal desteği

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
- **Token Sunucusu** — küçük bir Node.js/Express servisi, Raspberry Pi üzerinde 7/24 çalışır. Yalnızca kısa ömürlü erişim jetonları üretir ve soundboard dosyalarını barındırır; hiçbir ses/görüntü verisi buradan geçmez.

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

## 🛠️ Kurulum (Geliştirme / Kendi Sunucunuzu Barındırma)

Bu bölüm, projeyi sıfırdan ayağa kaldırmak isteyenler içindir.

### Ön Koşullar

- Node.js 18+
- Bir [LiveKit Cloud](https://cloud.livekit.io) hesabı (ücretsiz katman yeterli)
- 7/24 açık kalabilecek bir sunucu (Raspberry Pi veya benzeri) veya bulut tabanlı bir alternatif
- GitHub hesabı (otomatik güncelleme için)

### 1. LiveKit Cloud Kurulumu

1. [cloud.livekit.io](https://cloud.livekit.io) üzerinde bir proje oluşturun.
2. **API Key**, **API Secret** ve **WebSocket URL**'i not edin.

### 2. Token Sunucusu

```bash
git clone <bu-repo>
Sunucu projesi bu istemci deposundan ayrı çalıştırılır. Sunucu projesinde `npm install` çalıştırıp `.env` dosyasını oluşturun.
cp .env.example .env
```

`.env` dosyasını doldurun:

```env
LIVEKIT_API_KEY=xxxxx
LIVEKIT_API_SECRET=xxxxx
LIVEKIT_URL=wss://sizin-projeniz.livekit.cloud
PORT=3001
```

Test edin:

```bash
npm start
```

**Kalıcı çalıştırma (Linux / Raspberry Pi, systemd ile):**

```bash
sudo cp sesli-oda-token.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable sesli-oda-token
sudo systemctl start sesli-oda-token
```

**Dışarıya açma (Tailscale Funnel ile, önerilir):**

```bash
sudo tailscale funnel --bg 3001
```

Bu size `https://cihaz-adiniz.tailxxxx.ts.net` gibi herkese açık bir HTTPS adresi verir — arkadaşlarınızın Tailscale kurmasına gerek kalmaz.

### 3. Electron İstemcisini Yapılandırma

`renderer/config.js`:

```js
window.APP_CONFIG = {
  TOKEN_SERVER_URL: 'https://cihaz-adiniz.tailxxxx.ts.net',
  CHANNELS: [
    { name: 'Genel', type: 'voice' },
    { name: 'Oyun', type: 'voice' },
    { name: 'Sohbet', type: 'text' }
  ]
};
```

### 4. Derleme

```bash
npm install
npm run build
```

Kurulum dosyası `dist/` klasöründe oluşur.

### 5. Otomatik Güncelleme (isteğe bağlı ama önerilir)

`package.json` içindeki `build.publish` alanını doldurun:

```json
"publish": {
  "provider": "github",
  "owner": "kullanici-adiniz",
  "repo": "repo-adiniz",
  "draft": false
}
```

Yayınlamak için bir [GitHub Personal Access Token](https://github.com/settings/tokens) (`repo` yetkisiyle) oluşturun:

```bash
$env:GH_TOKEN="ghp_xxxxxxxxxxxx"
npm run release
```

Bu komut hem derler hem doğrudan GitHub Releases'e yükler. Kurulu istemciler bunu arka planda algılayıp kendini günceller.

### 6. Google ile Giriş (isteğe bağlı)

1. [Google Cloud Console](https://console.cloud.google.com)'da bir proje oluşturun.
2. OAuth consent screen'i "External" olarak yapılandırın.
3. **Desktop app** türünde bir OAuth Client ID oluşturun.
4. `main.js` dosyasının en üstüne Client ID/Secret'i girin:

```js
const GOOGLE_CLIENT_ID = 'xxxxx';
const GOOGLE_CLIENT_SECRET = 'xxxxx';
```

Boş bırakılırsa Google ile giriş butonu otomatik gizlenir.

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
- Metin sohbeti geçicidir (kanaldan ayrılınca/değiştirilince mesaj geçmişi silinir).
- Uygulama şu an yalnızca Windows için paketlenmektedir.

---

## 🗺️ Yol Haritası

- [ ] Sohbet geçmişinin kalıcı olarak saklanması
- [ ] Çoklu eş zamanlı yayın izleme desteği
- [ ] YouTube/müzik linki paylaşımı ile ortak dinleme botu
- [ ] macOS/Linux paketleme desteği

---

## 📄 Lisans

Bu proje özel (private) bir arkadaş grubu projesi olarak geliştirilmiştir.
