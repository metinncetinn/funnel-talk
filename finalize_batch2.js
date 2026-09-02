#!/usr/bin/env node
// Finalize Batch 2: Add channel user count display and user color styling

const fs = require('fs');
const path = require('path');

const rendererPath = path.join(__dirname, 'renderer', 'renderer.js');
const cssPath = path.join(__dirname, 'renderer', 'style.css');

console.log('🎨 Finalizing Batch 2 (Channel counts & user colors)...\n');

try {
  let renderer = fs.readFileSync(rendererPath, 'utf8');
  
  // Update kanal katilimci gösterimi - add sayı display
  const updatePoint = `isimler.forEach((ad) => {
          const satir = document.createElement('div');
          satir.className = 'kanal-katilimci-satiri';
          satir.textContent = \`🟢 \${ad}\`;
          element.appendChild(satir);
        });`;
  
  if (renderer.includes(updatePoint)) {
    const updated = `isimler.forEach((ad) => {
          const satir = document.createElement('div');
          satir.className = 'kanal-katilimci-satiri';
          satir.textContent = \`🟢 \${ad}\`;
          element.appendChild(satir);
        });
        // Sayı göster
        const sayıDiv = document.createElement('div');
        sayıDiv.className = 'kanal-katilimci-sayı';
        sayıDiv.textContent = \`(\${isimler.length})\`;
        element.appendChild(sayıDiv);`;
    
    renderer = renderer.replace(updatePoint, updated);
    console.log('✓ Channel user count display added');
  }
  
  // Add ses meter panel show/hide logic
  const sesPanelLogic = `function sesMeterPaneliniGöster(göster) {
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
}`;
  
  // Add before kanalaGec function
  const kanalaGecPoint = 'async function kanalaGec(kanal) {';
  if (renderer.includes(kanalaGecPoint) && !renderer.includes('sesMeterPaneliniGöster')) {
    renderer = renderer.replace(kanalaGecPoint, sesPanelLogic + '\n\n' + kanalaGecPoint);
    console.log('✓ Ses meter panel toggle logic added');
  }
  
  // Update microphone button to show/hide ses meter
  const btnMikrofonPoint = `elBtnMikrofon.addEventListener('click', async () => {`;
  if (renderer.includes(btnMikrofonPoint)) {
    const replacement = `elBtnMikrofon.addEventListener('click', async () => {
    mikrofonAcik = !mikrofonAcik;
    elBtnMikrofon.style.opacity = mikrofonAcik ? '1' : '0.5';
    const elDurum = document.getElementById('mikrofonDurumuGöstergesi');
    if (elDurum) elDurum.classList.toggle('aktif', mikrofonAcik);
    sesMeterPaneliniGöster(mikrofonAcik);`;
    
    if (renderer.includes('mikrofonAcik = !mikrofonAcik;')) {
      // Already has the toggle, just update it
      const oldToggle = `mikrofonAcik = !mikrofonAcik;
    elBtnMikrofon.style.opacity = mikrofonAcik ? '1' : '0.5';`;
      if (renderer.includes(oldToggle)) {
        const newToggle = `mikrofonAcik = !mikrofonAcik;
    elBtnMikrofon.style.opacity = mikrofonAcik ? '1' : '0.5';
    const elDurum = document.getElementById('mikrofonDurumuGöstergesi');
    if (elDurum) elDurum.classList.toggle('aktif', mikrofonAcik);
    sesMeterPaneliniGöster(mikrofonAcik);`;
        renderer = renderer.replace(oldToggle, newToggle);
        console.log('✓ Microphone button now toggles ses meter');
      }
    }
  }
  
  fs.writeFileSync(rendererPath, renderer, 'utf8');
} catch (e) {
  console.error('✗ Error updating renderer.js:', e.message);
}

// Add CSS for channel count and user color styling
try {
  let css = fs.readFileSync(cssPath, 'utf8');
  
  const cssInsert = '.ses-level-bar::after {';
  const cssNew = `.kanal-katilimci-sayı {
  font-size: 10px;
  color: var(--metin-soluk);
  margin-top: 4px;
  text-align: right;
  font-weight: 500;
}

.kullanıcı-avatar {
  display: inline-block;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  margin-right: 6px;
  vertical-align: middle;
  font-weight: 600;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
}

.kisi-ad {
  display: flex;
  align-items: center;
}

.ses-level-bar::after {`;
  
  if (css.includes(cssInsert)) {
    css = css.replace(cssInsert, cssNew);
    fs.writeFileSync(cssPath, css, 'utf8');
    console.log('✓ CSS styling for user colors added');
  }
} catch (e) {
  console.error('✗ Error updating CSS:', e.message);
}

console.log('\n✅ Batch 2 finalization complete!');
console.log('   ✓ Kanal katılımcı sayıları');
console.log('   ✓ Ses meter toggle');
console.log('   ✓ Kullanıcı renk avatar CSS');
console.log('\nBuilding...\n');
