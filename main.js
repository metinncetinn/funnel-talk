const { app, BrowserWindow, ipcMain, desktopCapturer, shell, globalShortcut, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { autoUpdater } = require("electron-updater");

// ==== GOOGLE ILE GIRIS AYARLARI ====
// Google Cloud Console > APIs & Services > Credentials > Create Credentials
// > OAuth client ID > Application type: "Desktop app" secerek olustur.
// Client ID ve Client Secret'i asagiya yapistir. Google ile giris istemiyorsan
// ikisini de bos birak, buton otomatik gizlenir.
const GOOGLE_CLIENT_ID = '';
const GOOGLE_CLIENT_SECRET = '';

let mainWindow;
let tray = null;
let isQuitting = false;

const oturumDosyasi = path.join(app.getPath('userData'), 'oturum.json');

const ayarlarDosyasi = path.join(app.getPath('userData'), 'ayarlar.json');
const varsayilanAyarlar = {
  tema: 'koyu',
  mikrofonId: '',
  hoparlorId: '',
  anaSesSeviyesi: 100,
  limiterAcik: true,
  limiterEsik: -12,
  kisayollar: {
    mikrofonAcKapat: 'CommandOrControl+Shift+M',
    yayinDurdur: 'CommandOrControl+Shift+S'
  }
};

function ayarlariOku() {
  try {
    return { ...varsayilanAyarlar, ...JSON.parse(fs.readFileSync(ayarlarDosyasi, 'utf-8')) };
  } catch {
    return varsayilanAyarlar;
  }
}

function kisayolKaydetTekli(accelerator, olayAdi) {
  try {
    globalShortcut.register(accelerator, () => {
      mainWindow?.webContents.send('kisayol-tetiklendi', olayAdi);
    });
    return globalShortcut.isRegistered(accelerator);
  } catch (e) {
    console.warn('Kısayol kaydedilemedi:', accelerator, e);
    return false;
  }
}

function kisayollariKaydet(kisayollar) {
  globalShortcut.unregisterAll();
  const sonuclar = {};
  if (kisayollar?.mikrofonAcKapat) {
    sonuclar.mikrofonAcKapat = kisayolKaydetTekli(kisayollar.mikrofonAcKapat, 'mikrofon');
  }
  if (kisayollar?.yayinDurdur) {
    sonuclar.yayinDurdur = kisayolKaydetTekli(kisayollar.yayinDurdur, 'yayinDurdur');
  }
  return sonuclar;
}

ipcMain.handle('get-settings', () => ayarlariOku());

ipcMain.handle('save-settings', (_event, ayarlar) => {
  fs.writeFileSync(ayarlarDosyasi, JSON.stringify(ayarlar), 'utf-8');
  const kisayolSonuclari = kisayollariKaydet(ayarlar.kisayollar);
  return { basarili: true, kisayolSonuclari };
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 780,
    minHeight: 560,
    backgroundColor: '#1e1f22',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

let sonGuncellemeKontrolu = Date.now();

function guncellemeKontroluGerekirse() {
  const simdi = Date.now();
  if (simdi - sonGuncellemeKontrolu > 15 * 60 * 1000) { // en fazla 15 dakikada bir
    sonGuncellemeKontrolu = simdi;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

function trayOlustur() {
  tray = new Tray(path.join(__dirname, 'icon.ico'));
  const menu = Menu.buildFromTemplate([
    { label: 'Göster', click: () => { mainWindow.show(); guncellemeKontroluGerekirse(); } },
    { label: 'Çıkış', click: () => { isQuitting = true; app.quit(); } }
  ]);
  tray.setToolTip('Sesli Oda');
  tray.setContextMenu(menu);
  tray.on('click', () => { mainWindow.show(); guncellemeKontroluGerekirse(); });
}

// Ekran paylasimi icin secilebilir pencere/ekran listesini renderer'a veriyoruz.
ipcMain.handle('get-screen-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: 200, height: 120 }
  });
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail.toDataURL()
  }));
});

// ---- Oturum hatirlama (basit yerel dosya, sadece isim/e-posta) ----
ipcMain.handle('get-saved-user', () => {
  try {
    const veri = fs.readFileSync(oturumDosyasi, 'utf-8');
    return JSON.parse(veri);
  } catch {
    return null;
  }
});

ipcMain.handle('save-user', (_event, user) => {
  fs.writeFileSync(oturumDosyasi, JSON.stringify(user), 'utf-8');
  return true;
});

ipcMain.handle('clear-user', () => {
  try { fs.unlinkSync(oturumDosyasi); } catch {}
  return true;
});

const cihazKimligiDosyasi = path.join(app.getPath('userData'), 'cihaz-kimligi.json');
const sesTercihleriDosyasi = path.join(app.getPath('userData'), 'ses-tercihleri.json');

function cihazKimligiAl() {
  try {
    const veri = JSON.parse(fs.readFileSync(cihazKimligiDosyasi, 'utf-8'));
    if (veri.kimlik) return veri.kimlik;
  } catch {}
  const yeniKimlik = 'cihaz-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  fs.writeFileSync(cihazKimligiDosyasi, JSON.stringify({ kimlik: yeniKimlik }), 'utf-8');
  return yeniKimlik;
}

ipcMain.handle('get-cihaz-kimligi', () => cihazKimligiAl());

ipcMain.handle('get-ses-tercihleri', () => {
  try {
    return JSON.parse(fs.readFileSync(sesTercihleriDosyasi, 'utf-8'));
  } catch {
    return {};
  }
});

ipcMain.handle('save-ses-tercihleri', (_event, tercihler) => {
  fs.writeFileSync(sesTercihleriDosyasi, JSON.stringify(tercihler), 'utf-8');
  return true;
});

ipcMain.handle('is-google-login-available', () => Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET));

// ---- Google ile giris (loopback OAuth akisi) ----
ipcMain.handle('google-login', async () => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google girisi yapilandirilmamis.');
  }

  return new Promise((resolve, reject) => {
    let port;
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, 'http://127.0.0.1');
        const code = url.searchParams.get('code');

        if (!code) {
          res.end('Giris basarisiz. Bu pencereyi kapatabilirsin.');
          server.close();
          return reject(new Error('Kod alinamadi'));
        }

        res.end('<html><body style="font-family:sans-serif;text-align:center;padding-top:60px"><h2>Giris basarili ✅</h2><p>Bu sekmeyi kapatip uygulamaya donebilirsin.</p></body></html>');
        server.close();

        const redirectUri = `http://127.0.0.1:${port}`;
        const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
          })
        });
        const tokenData = await tokenResp.json();
        if (!tokenData.access_token) throw new Error('Token alinamadi');

        const profilResp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const profil = await profilResp.json();

        resolve({ name: profil.name || profil.email, email: profil.email });
      } catch (err) {
        reject(err);
      }
    });

    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      const redirectUri = `http://127.0.0.1:${port}`;
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        prompt: 'select_account'
      });
      shell.openExternal(authUrl);
    });

    // 2 dakika icinde giris yapilmazsa iptal et
    setTimeout(() => {
      try { server.close(); } catch {}
      reject(new Error('Zaman asimi'));
    }, 120000);
  });
});

app.whenReady().then(() => {
  createWindow();
  trayOlustur();
  autoUpdater.checkForUpdatesAndNotify();
  kisayollariKaydet(ayarlariOku().kisayollar);

  // Uygulama artik kapaninca arka plana gizlendigi icin (tray),
  // sadece ilk acilista degil, belirli araliklarla da kontrol edelim.
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 2 * 60 * 60 * 1000); // 2 saatte bir
});
app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
