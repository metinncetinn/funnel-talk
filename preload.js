const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),
  getSavedUser: () => ipcRenderer.invoke('get-saved-user'),
  saveUser: (user) => ipcRenderer.invoke('save-user', user),
  clearUser: () => ipcRenderer.invoke('clear-user'),
  isGoogleLoginAvailable: () => ipcRenderer.invoke('is-google-login-available'),
  googleLogin: () => ipcRenderer.invoke('google-login'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (ayarlar) => ipcRenderer.invoke('save-settings', ayarlar),
  onKisayolTetiklendi: (callback) => ipcRenderer.on('kisayol-tetiklendi', (_e, eylem) => callback(eylem)),
  getCihazKimligi: () => ipcRenderer.invoke('get-cihaz-kimligi'),
  getSesTercihleri: () => ipcRenderer.invoke('get-ses-tercihleri'),
  saveSesTercihleri: (tercihler) => ipcRenderer.invoke('save-ses-tercihleri', tercihler)
});
