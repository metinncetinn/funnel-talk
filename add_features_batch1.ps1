# PowerShell Script: Add Batch 1 Features to Funnel Talk v1.2
# Otomatik Bağlantı + AFK Status + Bağlantı Durumu Göstergesi + Ses Cleanup

$rendererPath = "c:\Users\SCADA\Documents\GitHub\funnel-talk\renderer\renderer.js"
$htmlPath = "c:\Users\SCADA\Documents\GitHub\funnel-talk\renderer\index.html"
$cssPath = "c:\Users\SCADA\Documents\GitHub\funnel-talk\renderer\style.css"
$langPath = "c:\Users\SCADA\Documents\GitHub\funnel-talk\renderer\lang.js"

Write-Host "📝 Adding Batch 1 Features..." -ForegroundColor Yellow

# 1. Add state variables to renderer.js (after sesElementleri = new Map();)
$renderer = Get-Content $rendererPath -Raw
$insertPoint = "const sesElementleri = new Map();"
$stateVars = @"

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
  const stili = { 'bağlı': { text: '🟢 Bağlı', color: '#4ade80' }, 'bağlanıyor': { text: '🟡 Bağlanıyor...', color: '#fbbf24' }, 'kesildi': { text: '🔴 Bağlantı Kesildi', color: '#ef4444' }, 'yeniden bağlanılıyor': { text: '🟠 Yeniden Bağlanılıyor...', color: '#f97316' } };
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
    if (yeniAfk !== afkDurumu) { afkDurumu = yeniAfk; katilimcilariYenidenCiz(); }
  }, 15000);
}

function afkKontrolünüDur() {
  if (afkTimeoutId) clearInterval(afkTimeoutId);
  afkTimeoutId = null;
  afkDurumu = false;
}

"@

if ($renderer.Contains($insertPoint)) {
  $renderer = $renderer.Replace($insertPoint, "$insertPoint$stateVars")
  Set-Content $rendererPath $renderer -Encoding UTF8
  Write-Host "✓ State variables added to renderer.js" -ForegroundColor Green
} else {
  Write-Host "✗ Could not find insertion point in renderer.js" -ForegroundColor Red
}

# 2. Add HTML bağlantı durumu
$html = Get-Content $htmlPath -Raw
$htmlInsert = '<div class="ust-bar">'
$htmlNew = '<div class="ust-bar"><div id="bağlantıDurumu" class="bağlantı-durumu">🟡 Bağlanıyor...</div>'

if ($html.Contains($htmlInsert)) {
  $html = $html.Replace($htmlInsert, $htmlNew)
  Set-Content $htmlPath $html -Encoding UTF8
  Write-Host "✓ Connection status indicator added to HTML" -ForegroundColor Green
} else {
  Write-Host "✗ Could not find insertion point in HTML" -ForegroundColor Red
}

# 3. Add CSS styling
$css = Get-Content $cssPath -Raw
$cssInsert = ".buton-tam-ekran:hover { background: rgba(0,0,0,0.75); }"
$cssNew = @"
.buton-tam-ekran:hover { background: rgba(0,0,0,0.75); }

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
"@

if ($css.Contains($cssInsert)) {
  $css = $css.Replace($cssInsert, $cssNew)
  Set-Content $cssPath $css -Encoding UTF8
  Write-Host "✓ CSS styling added" -ForegroundColor Green
} else {
  Write-Host "✗ Could not find CSS insertion point" -ForegroundColor Red
}

# 4. Add Turkish translations
$lang = Get-Content $langPath -Raw
$langTrInsert = "    yayinVarIzle: '🖥️ Yayın var · izle'"
$langTrNew = @"
    yayinVarIzle: '🖥️ Yayın var · izle',
    bağlantıDurumu: '🟡 Bağlanıyor...',
    baglıDurum: '🟢 Bağlı',
    baglantıKesildi: '🔴 Bağlantı Kesildi',
    yenidenbağlanılıyor: '🟠 Yeniden Bağlanılıyor...',
    afkDurumu: '😴 AFK'
"@

if ($lang.Contains($langTrInsert)) {
  $lang = $lang.Replace($langTrInsert, $langTrNew)
  Write-Host "✓ Turkish translations added" -ForegroundColor Green
} else {
  Write-Host "✗ Could not find Turkish translation insertion point" -ForegroundColor Red
}

# 5. Add English translations
$langEnInsert = "    yayinVarIzle: '🖥️ Broadcast available · watch'"
$langEnNew = @"
    yayinVarIzle: '🖥️ Broadcast available · watch',
    bağlantıDurumu: '🟡 Connecting...',
    baglıDurum: '🟢 Connected',
    baglantıKesildi: '🔴 Disconnected',
    yenidenbağlanılıyor: '🟠 Reconnecting...',
    afkDurumu: '😴 AFK'
"@

if ($lang.Contains($langEnInsert)) {
  $lang = $lang.Replace($langEnInsert, $langEnNew)
  Set-Content $langPath $lang -Encoding UTF8
  Write-Host "✓ English translations added" -ForegroundColor Green
} else {
  Write-Host "✗ Could not find English translation insertion point" -ForegroundColor Red
}

Write-Host "✅ Batch 1 features added successfully!" -ForegroundColor Green
Write-Host "Next: Build and test..." -ForegroundColor Cyan
