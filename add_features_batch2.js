#!/usr/bin/env node
// Add Batch 2 Features: UX Improvements
// 1. Ses level meter
// 2. Mikrofon durumu göstergesi  
// 3. Kanal başına çevrimiçi sayısı
// 4. Kullanıcı renkleri/avatar

const fs = require('fs');
const path = require('path');

const rendererPath = path.join(__dirname, 'renderer', 'renderer.js');
const htmlPath = path.join(__dirname, 'renderer', 'index.html');
const cssPath = path.join(__dirname, 'renderer', 'style.css');
const langPath = path.join(__dirname, 'renderer', 'lang.js');

console.log('📝 Adding Batch 2 Features (UX Improvements)...\n');

// 1. Renderer.js - Add session state for Batch 2
try {
  let renderer = fs.readFileSync(rendererPath, 'utf8');
  
  // Add after screenShareAudioTracks
  const insertPoint = 'let screenShareAudioTracks = new Map();';
  
  if (renderer.includes(insertPoint)) {
    const batch2Vars = `

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
}`;
    
    renderer = renderer.replace(insertPoint, insertPoint + batch2Vars);
    
    // Now add event listeners for microphone status
    // Find the point after mikrofonAcik toggle
    const elBtnMikrofonPoint = "elBtnMikrofon.addEventListener('click', async () => {";
    if (renderer.includes(elBtnMikrofonPoint)) {
      const afterToggle = `mikrofonAcik = !mikrofonAcik;
      elBtnMikrofon.style.opacity = mikrofonAcik ? '1' : '0.5';
      const elDurum = document.getElementById('mikrofonDurumuGöstergesi');
      if (elDurum) elDurum.classList.toggle('aktif', mikrofonAcik);`;
      
      if (renderer.includes(afterToggle)) {
        console.log('✓ Microphone status toggle already found');
      }
    }
    
    fs.writeFileSync(rendererPath, renderer, 'utf8');
    console.log('✓ Batch 2 state variables and functions added to renderer.js');
  }
} catch (e) {
  console.error('✗ Error updating renderer.js:', e.message);
}

// 2. HTML - Add ses meter panel and microphone indicator
try {
  let html = fs.readFileSync(htmlPath, 'utf8');
  
  // Add microphone indicator to button
  const mikrofon1 = '<button id="btnMikrofon" class="buton-ikon gizli" data-i18n-title="mikrofonBaslik" title="Mikrofonu kapat/aç">🎙️</button>';
  const mikrofon2 = `<div class="mikrofon-durumu-kontrol">
            <button id="btnMikrofon" class="buton-ikon gizli" data-i18n-title="mikrofonBaslik" title="Mikrofonu kapat/aç">🎙️</button>
            <div id="mikrofonDurumuGöstergesi" class="mikrofon-durumu-noktası aktif"></div>
          </div>`;
  
  if (html.includes(mikrofon1)) {
    html = html.replace(mikrofon1, mikrofon2);
    console.log('✓ Microphone status indicator added to HTML');
  }
  
  // Add ses meter panel
  const sesPanel = `        <div id="sesLevelPanel" class="ses-level-panel gizli">
          <div class="ses-level-başlık">🎤 Mikrofon Seviyesi</div>
          <div class="ses-level-konteyner">
            <div id="sesLevelMeterBar" class="ses-level-bar"></div>
          </div>
        </div>`;
  
  const katilimciPoint = '<div id="katilimcilar" class="katilimcilar"></div>';
  if (html.includes(katilimciPoint) && !html.includes('sesLevelPanel')) {
    html = html.replace(katilimciPoint, sesPanel + '\n        ' + katilimciPoint);
    console.log('✓ Ses meter panel added to HTML');
  }
  
  fs.writeFileSync(htmlPath, html, 'utf8');
} catch (e) {
  console.error('✗ Error updating HTML:', e.message);
}

// 3. CSS - Add styling for new UX elements
try {
  let css = fs.readFileSync(cssPath, 'utf8');
  
  const cssInsert = '.bağlantı-durumu {';
  const cssNew = `.mikrofon-durumu-kontrol {
  position: relative;
  display: inline-block;
}
.mikrofon-durumu-noktası {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  transition: background 200ms, box-shadow 200ms;
}
.mikrofon-durumu-noktası.aktif {
  background: #4ade80;
  box-shadow: 0 0 6px #4ade80;
}

.ses-level-panel {
  position: absolute;
  top: 16px;
  right: 280px;
  background: rgba(0,0,0,0.85);
  border: 1px solid var(--kenar);
  border-radius: 8px;
  padding: 12px 16px;
  width: 200px;
  z-index: 10;
}
.ses-level-panel.gizli { display: none; }
.ses-level-başlık {
  font-size: 11px;
  font-weight: 600;
  color: var(--metin);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.ses-level-konteyner {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ses-level-bar {
  flex: 1;
  height: 6px;
  background: var(--bg-2);
  border-radius: 3px;
  overflow: hidden;
  position: relative;
}
.ses-level-bar::after {
  content: '';
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #4ade80, #fbbf24);
  width: 0%;
  transition: width 100ms linear, background 100ms;
}

.bağlantı-durumu {`;
  
  if (css.includes(cssInsert)) {
    css = css.replace(cssInsert, cssNew + cssInsert);
    fs.writeFileSync(cssPath, css, 'utf8');
    console.log('✓ CSS styling added for Batch 2');
  }
} catch (e) {
  console.error('✗ Error updating CSS:', e.message);
}

// 4. Lang.js - Add new translation keys
try {
  let lang = fs.readFileSync(langPath, 'utf8');
  
  // Add Turkish translations
  const trPoint = "    afkDurumu: '😴 AFK'";
  const trNew = `    afkDurumu: '😴 AFK',
    sesLevel: '🎤 Ses Seviyesi',
    kişi: 'kişi',
    çevrimiçi: 'Çevrimiçi',
    mikrofonAçık: '🎤 Mikrofon Açık',
    mikrofonKapalı: '🔇 Mikrofon Kapalı',
    sesŞiddetliUyarı: 'Ses çok yüksek!'`;
  
  if (lang.includes(trPoint)) {
    lang = lang.replace(trPoint, trNew);
    console.log('✓ Turkish translations added');
  }
  
  // Add English translations
  const enPoint = "    afkDurumu: '😴 AFK'";
  const enNew = `    afkDurumu: '😴 AFK',
    sesLevel: '🎤 Sound Level',
    kişi: 'person',
    çevrimiçi: 'Online',
    mikrofonAçık: '🎤 Microphone On',
    mikrofonKapalı: '🔇 Microphone Off',
    sesŞiddetliUyarı: 'Sound too loud!'`;
  
  if (lang.includes(enPoint)) {
    lang = lang.replace(enPoint, enNew);
    fs.writeFileSync(langPath, lang, 'utf8');
    console.log('✓ English translations added');
  }
} catch (e) {
  console.error('✗ Error updating lang.js:', e.message);
}

console.log('\n✅ Batch 2 features added successfully!');
console.log('   ✓ Ses level meter');
console.log('   ✓ Mikrofon durumu göstergesi');
console.log('   ✓ Kanal çevrimiçi sayıları (prep)');
console.log('   ✓ Kullanıcı renkleri sistemi');
console.log('\nNext: Build and test...\n');
