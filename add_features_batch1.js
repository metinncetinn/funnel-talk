#!/usr/bin/env node
// Add Batch 1 Features to Funnel Talk v1.2

const fs = require('fs');
const path = require('path');

const rendererPath = path.join(__dirname, 'renderer', 'renderer.js');
const htmlPath = path.join(__dirname, 'renderer', 'index.html');
const cssPath = path.join(__dirname, 'renderer', 'style.css');
const langPath = path.join(__dirname, 'renderer', 'lang.js');

console.log('📝 Adding Batch 1 Features...\n');

// 1. Renderer.js - Add state variables
try {
  let renderer = fs.readFileSync(rendererPath, 'utf8');
  const insertPoint = 'const sesElementleri = new Map();';
  
  if (renderer.includes(insertPoint)) {
    const stateVars = `

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

function başlantıDurumuGüncelle(durum) {
  bağlantıDurumu = durum;
  const elDurum = document.getElementById('bağlantıDurumu');
  if (!elDurum) return;
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
}`;
    
    renderer = renderer.replace(insertPoint, insertPoint + stateVars);
    fs.writeFileSync(rendererPath, renderer, 'utf8');
    console.log('✓ State variables added to renderer.js');
  } else {
    console.log('✗ Could not find insertion point in renderer.js');
  }
} catch (e) {
  console.error('✗ Error updating renderer.js:', e.message);
}

// 2. HTML - Add connection status indicator
try {
  let html = fs.readFileSync(htmlPath, 'utf8');
  const htmlInsert = '<div class="ust-bar">';
  const htmlNew = '<div class="ust-bar">\n        <div id="bağlantıDurumu" class="bağlantı-durumu">🟡 Bağlanıyor...</div>';
  
  if (html.includes(htmlInsert)) {
    html = html.replace(htmlInsert, htmlNew);
    fs.writeFileSync(htmlPath, html, 'utf8');
    console.log('✓ Connection status indicator added to HTML');
  } else {
    console.log('✗ Could not find insertion point in HTML');
  }
} catch (e) {
  console.error('✗ Error updating HTML:', e.message);
}

// 3. CSS - Add styling
try {
  let css = fs.readFileSync(cssPath, 'utf8');
  const cssInsert = '.buton-tam-ekran:hover { background: rgba(0,0,0,0.75); }';
  const cssNew = `.buton-tam-ekran:hover { background: rgba(0,0,0,0.75); }

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
}`;
  
  if (css.includes(cssInsert)) {
    css = css.replace(cssInsert, cssNew);
    fs.writeFileSync(cssPath, css, 'utf8');
    console.log('✓ CSS styling added');
  } else {
    console.log('✗ Could not find CSS insertion point');
  }
} catch (e) {
  console.error('✗ Error updating CSS:', e.message);
}

// 4. Lang.js - Add translations
try {
  let lang = fs.readFileSync(langPath, 'utf8');
  
  // Turkish translations
  const trInsert = "    yayinVarIzle: '🖥️ Yayın var · izle'";
  const trNew = `    yayinVarIzle: '🖥️ Yayın var · izle',
    bağlantıDurumu: '🟡 Bağlanıyor...',
    baglıDurum: '🟢 Bağlı',
    baglantıKesildi: '🔴 Bağlantı Kesildi',
    yenidenbağlanılıyor: '🟠 Yeniden Bağlanılıyor...',
    afkDurumu: '😴 AFK'`;
  
  if (lang.includes(trInsert)) {
    lang = lang.replace(trInsert, trNew);
    console.log('✓ Turkish translations added');
  }
  
  // English translations  
  const enInsert = "    yayinVarIzle: '🖥️ Broadcast available · watch'";
  const enNew = `    yayinVarIzle: '🖥️ Broadcast available · watch',
    bağlantıDurumu: '🟡 Connecting...',
    baglıDurum: '🟢 Connected',
    baglantıKesildi: '🔴 Disconnected',
    yenidenbağlanılıyor: '🟠 Reconnecting...',
    afkDurumu: '😴 AFK'`;
  
  if (lang.includes(enInsert)) {
    lang = lang.replace(enInsert, enNew);
    console.log('✓ English translations added');
  }
  
  fs.writeFileSync(langPath, lang, 'utf8');
} catch (e) {
  console.error('✗ Error updating lang.js:', e.message);
}

console.log('\n✅ Batch 1 features added successfully!');
console.log('Next: Build and test...\n');
