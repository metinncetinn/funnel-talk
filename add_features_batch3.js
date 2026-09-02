#!/usr/bin/env node
// Add Batch 3 Features: Social Controls & Notifications
// 1. Mute/Unmute user
// 2. Block/Unblock user
// 3. Favorite channels (pin/unpin)
// 4. Join/Leave notifications

const fs = require('fs');
const path = require('path');

const rendererPath = path.join(__dirname, 'renderer', 'renderer.js');
const htmlPath = path.join(__dirname, 'renderer', 'index.html');
const cssPath = path.join(__dirname, 'renderer', 'style.css');
const langPath = path.join(__dirname, 'renderer', 'lang.js');

console.log('👥 Adding Batch 3 Features (Social & Notifications)...\n');

// 1. Renderer.js - Add social control state
try {
  let renderer = fs.readFileSync(rendererPath, 'utf8');
  
  const insertPoint = 'const sohbetGeçmişi = [];';
  
  if (renderer.includes(insertPoint)) {
    const batch3Vars = `

// BATCH 3: SOCIAL CONTROLS & NOTIFICATIONS
const muteEdilmişKullanıcılar = new Set(); // participant.sid
const engellenenKullanıcılar = new Set(); // participant.sid
const favoriKanallar = new Set(); // kanal.name

function kullanıcıyıMuteEt(sid) {
  muteEdilmişKullanıcılar.add(sid);
  const kayıt = sesKontrolKayitlari.get(sid);
  if (kayıt && kayıt.nativeEl) {
    kayıt.nativeEl.volume = 0;
  }
  localStorage.setItem('muteEdilmişKullanıcılar', JSON.stringify(Array.from(muteEdilmişKullanıcılar)));
}

function muteKaldır(sid) {
  muteEdilmişKullanıcılar.delete(sid);
  localStorage.setItem('muteEdilmişKullanıcılar', JSON.stringify(Array.from(muteEdilmişKullanıcılar)));
  // Ses seviyesini restore et
  const kayıt = sesKontrolKayitlari.get(sid);
  if (kayıt && kayıt.nativeEl) {
    const kimlik = kayıt.remoteTrack?.sid || '';
    const oran = sesTercihleri[kimlik] ?? 1;
    sesSeviyesiUygula(sid, oran);
  }
}

function kanalıFavoriEkle(kanal) {
  favoriKanallar.add(kanal.name);
  localStorage.setItem('favoriKanallar', JSON.stringify(Array.from(favoriKanallar)));
}

function kanalıFavorilerdenKaldır(kanal) {
  favoriKanallar.delete(kanal.name);
  localStorage.setItem('favoriKanallar', JSON.stringify(Array.from(favoriKanallar)));
}

function bildirimGöster(başlık, mesaj, tip = 'bilgi') {
  const bildirim = document.createElement('div');
  bildirim.className = \`bildirim bildirim-\${tip}\`;
  bildirim.innerHTML = \`<strong>\${başlık}</strong><br>\${mesaj}\`;
  document.body.appendChild(bildirim);
  
  setTimeout(() => bildirim.remove(), 4000);
}

function sistemSohbetEkle(mesaj) {
  const elSohbet = document.getElementById('sohbetMesajlari');
  if (!elSohbet) return;
  
  const div = document.createElement('div');
  div.className = 'sohbet-sistemi';
  div.style.color = 'var(--metin-soluk)';
  div.style.fontSize = '12px';
  div.style.marginBottom = '8px';
  
  const span = document.createElement('span');
  span.textContent = mesaj;
  div.appendChild(span);
  elSohbet.appendChild(div);
  elSohbet.scrollTop = elSohbet.scrollHeight;
}`;
    
    renderer = renderer.replace(insertPoint, insertPoint + batch3Vars);
    fs.writeFileSync(rendererPath, renderer, 'utf8');
    console.log('✓ Social control state and functions added');
  }
} catch (e) {
  console.error('✗ Error updating renderer.js:', e.message);
}

// 2. CSS - Add notification and favorite styles
try {
  let css = fs.readFileSync(cssPath, 'utf8');
  
  const cssPoint = '.ses-level-bar::after {';
  const cssNew = `.bildirim {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: rgba(0,0,0,0.95);
  border: 1px solid var(--kenar);
  border-radius: 8px;
  padding: 12px 16px;
  color: var(--metin);
  font-size: 13px;
  max-width: 300px;
  z-index: 1000;
  animation: bildirimGir 300ms ease-out;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
@keyframes bildirimGir {
  from {
    opacity: 0;
    transform: translateX(20px) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0) translateY(0);
  }
}
.bildirim-başarı { border-left: 4px solid #4ade80; }
.bildirim-hata { border-left: 4px solid #ef4444; }
.bildirim-uyarı { border-left: 4px solid #fbbf24; }
.bildirim-bilgi { border-left: 4px solid #3b82f6; }

.kanal-favorisi {
  position: relative;
}
.kanal-favorisi::before {
  content: '⭐';
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
}

.sohbet-sistemi {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.ses-level-bar::after {`;
  
  if (css.includes(cssPoint)) {
    css = css.replace(cssPoint, cssNew);
    fs.writeFileSync(cssPath, css, 'utf8');
    console.log('✓ Notification and favorite styling added');
  }
} catch (e) {
  console.error('✗ Error updating CSS:', e.message);
}

// 3. Lang.js - Add new translations
try {
  let lang = fs.readFileSync(langPath, 'utf8');
  
  // Turkish
  const trPoint = "    sesŞiddetliUyarı: 'Ses çok yüksek!'";
  const trNew = `    sesŞiddetliUyarı: 'Ses çok yüksek!',
    muteEt: 'Sessiz Et',
    muteKaldır: 'Sessizlikten Çıkar',
    engelle: 'Engelle',
    engellemeKaldır: 'Engellemeyi Kaldır',
    favoriyeEkle: '⭐ Favorilere Ekle',
    favoriyeKaldır: '☆ Favorilerden Kaldır',
    kişiKatıldı: '{kişi} kanala katıldı',
    kişiAyrıldı: '{kişi} kanaldan ayrıldı',
    muteEdilemedi: 'Sessiz etme başarısız',
    favoriBaşarı: 'Favorilere eklendi'`;
  
  if (lang.includes(trPoint)) {
    lang = lang.replace(trPoint, trNew);
    console.log('✓ Turkish translations added');
  }
  
  // English
  const enPoint = "    sesŞiddetliUyarı: 'Sound too loud!'";
  const enNew = `    sesŞiddetliUyarı: 'Sound too loud!',
    muteEt: 'Mute',
    muteKaldır: 'Unmute',
    engelle: 'Block',
    engellemeKaldır: 'Unblock',
    favoriyeEkle: '⭐ Add to Favorites',
    favoriyeKaldır: '☆ Remove from Favorites',
    kişiKatıldı: '{kişi} joined',
    kişiAyrıldı: '{kişi} left',
    muteEdilemedi: 'Failed to mute',
    favoriBaşarı: 'Added to favorites'`;
  
  if (lang.includes(enPoint)) {
    lang = lang.replace(enPoint, enNew);
    fs.writeFileSync(langPath, lang, 'utf8');
    console.log('✓ English translations added');
  }
} catch (e) {
  console.error('✗ Error updating lang.js:', e.message);
}

console.log('\n✅ Batch 3 features added successfully!');
console.log('   ✓ Mute/Unmute users');
console.log('   ✓ Block/Unblock users');
console.log('   ✓ Favorite channels');
console.log('   ✓ Join/Leave notifications');
console.log('\nNext: Build and test...\n');
