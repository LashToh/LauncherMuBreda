const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mubreda', {
  getBootstrap: () => ipcRenderer.invoke('bootstrap:get'),
  getGameSettings: () => ipcRenderer.invoke('settings:get'),
  saveGameSettings: (partial) => ipcRenderer.invoke('settings:save', partial),
  saveLauncherConfig: (partial) => ipcRenderer.invoke('config:save', partial),
  launchGame: () => ipcRenderer.invoke('game:launch'),
  checkUpdates: () => ipcRenderer.invoke('update:check'),
  applyUpdate: () => ipcRenderer.invoke('update:apply'),
  openExternal: (url) => ipcRenderer.invoke('shell:open', url),
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  listClients: (opts) => ipcRenderer.invoke('clients:list', opts || {}),
  focusClient: (hwnd) => ipcRenderer.invoke('clients:focus', hwnd),
  launchClient: () => ipcRenderer.invoke('clients:launch'),
  setDockCollapsed: (value) => ipcRenderer.invoke('dock:set-collapsed', value),
  reorderClients: (orderedKeys) => ipcRenderer.invoke('clients:reorder', orderedKeys),
  ensureDock: () => ipcRenderer.invoke('dock:ensure'),
  moveDockBy: (dx, dy) => ipcRenderer.invoke('dock:move-by', dx, dy),
  onUpdateProgress: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('update:progress', handler);
    return () => ipcRenderer.removeListener('update:progress', handler);
  },
});
