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
  saveSesTercihleri: (tercihler) => ipcRenderer.invoke('save-ses-tercihleri', tercihler),
  onGuncellemeHazir: (callback) => ipcRenderer.on('guncelleme-hazir', (_e, bilgi) => callback(bilgi)),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  openExternal: (url) => ipcRenderer.send('open-external-link', url),
  saveFileFromUrl: (url, filename) => ipcRenderer.invoke('save-url-to-file', { url, filename }),
  nativeAudioCaptureAvailable: () => ipcRenderer.invoke('native-audio-capture-available'),
  startNativeAudioCapture: () => ipcRenderer.invoke('start-native-audio-capture'),
  stopNativeAudioCapture: () => ipcRenderer.invoke('stop-native-audio-capture'),
  onNativeAudioData: (callback) => ipcRenderer.on('native-audio-data', (_event, data, meta) => callback(data, meta))
});
