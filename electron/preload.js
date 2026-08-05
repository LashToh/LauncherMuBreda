import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('mubreda', {
  getBootstrap: () => ipcRenderer.invoke('bootstrap:get'),
  getGameSettings: () => ipcRenderer.invoke('settings:get'),
  saveGameSettings: (partial) => ipcRenderer.invoke('settings:save', partial),
  saveLauncherConfig: (partial) => ipcRenderer.invoke('config:save', partial),
  launchGame: () => ipcRenderer.invoke('game:launch'),
  checkUpdates: () => ipcRenderer.invoke('update:check'),
  applyUpdate: () => ipcRenderer.invoke('update:apply'),
  openExternal: (url) => ipcRenderer.invoke('shell:open', url),
  windowMinimize: () => ipcRenderer.send('window:minimize'),
  windowClose: () => ipcRenderer.send('window:close'),
  onUpdateProgress: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('update:progress', handler);
    return () => ipcRenderer.removeListener('update:progress', handler);
  },
});
