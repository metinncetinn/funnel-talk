# Funnel Talk v1.2 - Yeni Özellikler Implementation Plan

## Phase 1: Kritik 4 Özellik (Şu an)
- [x] 1. Otomatik Yeniden Bağlantı Mekanizması
- [x] 2. AFK (Hareketsiz) Status Sistemi  
- [x] 3. Bağlantı Durumu Göstergesi (UX)
- [x] 4. Ekran Paylaşımı Sesli Yayın Cleanup

## Phase 2: UX Geliştirmeleri (Sonraki)
- [ ] 5. Ses Level Meter Visual
- [ ] 6. Mikrofon Aktif/Kapalı Göstergesi
- [ ] 7. Kanal Başına Çevrimiçi Sayısı
- [ ] 8. Kullanıcı Renkleri/Emoji Avatarlar
- [ ] 9. Mesaj Timestamp'ları

## Phase 3: Sosyal & Kontrol (Sonra)
- [ ] 10. Mute/Unmute User
- [ ] 11. Block/Unblock User
- [ ] 12. Kanal Favorileri
- [ ] 13. Giriş/Çıkış Bildirimleri

## Phase 4: Güvenlik & Stabilite
- [ ] 14. Kanal Şifrelemesi (Token)
- [ ] 15. Token Expiry Kontrol
- [ ] 16. Fallback Kalite Seçimi
- [ ] 17. Memory Leak Temizliği

## Phase 5: Diğer
- [ ] 18. Mesaj Geçmişi Scroll
- [ ] 19. Settings Export/Import
- [ ] 20. Idle Mode Optimizasyonu

---

## Implementation Status

### Phase 1 Details

#### 1. Otomatik Yeniden Bağlantı
```js
// room disconnect olursa → 5 saniye sonra otomatik retry
// max 5 attempt, exponential backoff
let otomatikBağlantıDenemesi = 0;
const MAX_BAĞLANTI_DENEMESI = 5;

room.on(RoomEvent.Disconnected, async () => {
  if (otomatikBağlantıDenemesi < MAX_BAĞLANTI_DENEMESI) {
    const backoff = Math.pow(2, otomatikBağlantıDenemesi) * 1000;
    setTimeout(() => kanalaGec(aktifKanal), backoff);
    otomatikBağlantıDenemesi++;
  }
});
```

#### 2. AFK Status
```js
// 5 dakika konuşma olmayınca "AFK" yazacak
const AFK_TIMEOUT = 5 * 60 * 1000;
let sonSesAktivitesi = Date.now();
let afkDurumu = false;

// Konuşma anında reset et
room.localParticipant.audioTrackPublications.forEach(pub => {
  pub.track?.addEventListener('update', () => {
    sonSesAktivitesi = Date.now();
  });
});
```

#### 3. Bağlantı Durumu Göstergesi
```html
<div id="bağlantıDurumu" class="bağlantı-durumu">🟡 Bağlanıyor...</div>
```

#### 4. Ekran Paylaşımı Sesli Yayın Cleanup
```js
// screenShareAudio track'i disconnect sırasında temizle
room.on(RoomEvent.TrackUnsubscribed, (track, pub, participant) => {
  if (pub.source === Track.Source.ScreenShareAudio) {
    screenShareAudioTracks.delete(participant.sid);
  }
});
```

---

## Test Plan

1. **Otomatik Bağlantı**: 
   - Token sunucusunu kapat → reconnect olmalı
   - Ağ kesilir → reconnect olmalı

2. **AFK Status**:
   - 5+ dakika konuşma yok → "AFK" yazacak
   - Mikrofon aç → AFK temizlenecek

3. **Bağlantı Durumu**:
   - Rengi yeşil/sarı/kırmızı değişecek
   - Metin dinamik güncelle

4. **Ses Cleanup**:
   - Ekran paylaşım bitse sesli yayın sesi bitsin
   - Memory leak olmasın

---

## Git Strategy
- Feature branch `develop/v1.2-features` oluş tur
- 4 critical ekle + test → commit
- Diğer 16'yı merge → commit
- v1.2.0 tag'i oluştur
- Release yap

## Build & Deploy
```bash
npm version 1.2.0 -m "Release v1.2 with 20 new features"
git push origin main --follow-tags
# GitHub Actions otomatik build & release oluşturacak
```
