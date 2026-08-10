const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mubreda', {
  getBootstrap: () => ipcRenderer.invoke('bootstrap:get'),
  getGameSettings: () => ipcRenderer.invoke('settings:get'),
  saveGameSettings: (partial) => ipcRenderer.invoke('settings:save', partial),
  saveLauncherConfig: (partial) => ipcRenderer.invoke('config:save', partial),
  setGameLanguage: (code) => ipcRenderer.invoke('language:set', code),
  launchGame: () => ipcRenderer.invoke('game:launch'),
  checkUpdates: () => ipcRenderer.invoke('update:check'),
  applyUpdate: () => ipcRenderer.invoke('update:apply'),
  openExternal: (url) => ipcRenderer.invoke('shell:open', url),
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  onUpdateProgress: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('update:progress', handler);
    return () => ipcRenderer.removeListener('update:progress', handler);
  },
});
