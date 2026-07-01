const { app, BrowserWindow, ipcMain, desktopCapturer, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

// ==== GOOGLE ILE GIRIS AYARLARI ====
// Google Cloud Console > APIs & Services > Credentials > Create Credentials
// > OAuth client ID > Application type: "Desktop app" secerek olustur.
// Client ID ve Client Secret'i asagiya yapistir. Google ile giris istemiyorsan
// ikisini de bos birak, buton otomatik gizlenir.
const GOOGLE_CLIENT_ID = '';
const GOOGLE_CLIENT_SECRET = '';

let mainWindow;
const oturumDosyasi = path.join(app.getPath('userData'), 'oturum.json');

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

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
