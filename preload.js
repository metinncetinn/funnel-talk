const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),
  getSavedUser: () => ipcRenderer.invoke('get-saved-user'),
  saveUser: (user) => ipcRenderer.invoke('save-user', user),
  clearUser: () => ipcRenderer.invoke('clear-user'),
  isGoogleLoginAvailable: () => ipcRenderer.invoke('is-google-login-available'),
  googleLogin: () => ipcRenderer.invoke('google-login')
});
