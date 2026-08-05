import { app, BrowserWindow, ipcMain, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_CONFIG, RESOLUTIONS } from './defaults.js';
import {
  loadLauncherConfig,
  loadLocalVersion,
  saveLauncherConfig,
} from './configStore.js';
import { loadGameSettings, saveGameSettings } from './gameSettings.js';
import { launchGame } from './launcher.js';
import { saveDockState } from './dockStore.js';
import {
  createMultiClientWindow,
  getDockCollapsed,
  moveDockBy,
  setDockCollapsed,
  showMultiClientWindow,
  syncDockSize,
} from './multiClientWindow.js';
import {
  focusMuClient,
  listMuClients,
  minimizeMuClients,
  restoreMuClients,
} from './muWindows.js';
import { getGameRoot, getLauncherDataDir, ensureDir } from './paths.js';
import { createTray, destroyTray, hideToTray } from './tray.js';
import { applyUpdate, checkForUpdates } from './updater.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged && process.env.ELECTRON_DEV === '1';
let mainWindow = null;
let quitting = false;
let lastKnownHwnds = [];

function getAppIconPath() {
  const candidates = [
    path.join(__dirname, '..', 'build', 'icon.ico'),
    path.join(__dirname, '..', 'public', 'assets', 'icon.ico'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function showLauncher() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  mainWindow.show();
  mainWindow.focus();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 680,
    minWidth: 1100,
    minHeight: 680,
    maxWidth: 1100,
    maxHeight: 680,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    backgroundColor: '#090909',
    show: false,
    icon: getAppIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    hideToTray(mainWindow);
  });

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

function ensureDock() {
  createMultiClientWindow({
    isDev,
    icon: getAppIconPath(),
  });
  showMultiClientWindow();
}

function registerIpc() {
  ipcMain.handle('bootstrap:get', async () => {
    const gameRoot = getGameRoot();
    ensureDir(getLauncherDataDir(gameRoot));
    const config = { ...DEFAULT_CONFIG, ...loadLauncherConfig(gameRoot) };
    const settings = await loadGameSettings(gameRoot);
    const version = loadLocalVersion(gameRoot);

    return {
      gameRoot,
      config,
      settings,
      version,
      resolutions: RESOLUTIONS,
      defaults: DEFAULT_CONFIG,
      isDev,
    };
  });

  ipcMain.handle('settings:get', async () => loadGameSettings());
  ipcMain.handle('settings:save', async (_e, partial) => saveGameSettings(partial || {}));
  ipcMain.handle('config:save', async (_e, partial) => saveLauncherConfig(partial || {}));

  ipcMain.handle('game:launch', async () => {
    const result = launchGame();
    if (result.ok) {
      ensureDock();
      setDockCollapsed(false);
    }
    return result;
  });

  ipcMain.handle('update:check', async () => checkForUpdates());
  ipcMain.handle('update:apply', async (event) => {
    try {
      return await applyUpdate({
        onProgress: (progress) => {
          event.sender.send('update:progress', progress);
        },
      });
    } catch (error) {
      return {
        ok: false,
        applied: false,
        allowPlay: true,
        message: error.message,
        reason: 'UPDATE_FAILED',
      };
    }
  });

  ipcMain.handle('shell:open', async (_e, url) => {
    if (typeof url !== 'string') {
      return { ok: false, message: 'Invalid URL' };
    }
    const normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) {
      return { ok: false, message: 'Invalid URL' };
    }
    try {
      await shell.openExternal(normalized);
      return { ok: true, url: normalized };
    } catch (error) {
      return { ok: false, message: error.message, url: normalized };
    }
  });

  ipcMain.handle('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (win === mainWindow || win?.id === mainWindow?.id) {
      hideToTray(mainWindow);
      return { ok: true, tray: true };
    }
    win?.minimize();
    return { ok: true };
  });

  ipcMain.handle('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (win === mainWindow || win?.id === mainWindow?.id) {
      hideToTray(mainWindow);
      return { ok: true, tray: true };
    }
    win?.close();
    return { ok: true };
  });

  ipcMain.handle('clients:list', async () => {
    const result = await listMuClients({ withThumbs: true });
    lastKnownHwnds = (result.clients || []).map((c) => c.hwnd);
    syncDockSize(result.clients?.length || 0);
    return {
      ...result,
      collapsed: getDockCollapsed(),
    };
  });

  ipcMain.handle('clients:focus', async (_e, hwnd) => focusMuClient(hwnd));

  ipcMain.handle('clients:launch', async () => {
    const result = launchGame();
    if (result.ok) {
      ensureDock();
      setDockCollapsed(false);
    }
    return result;
  });

  ipcMain.handle('clients:minimize-all', async () => {
    const listed = await listMuClients({ withThumbs: false });
    const hwnds = (listed.clients || []).map((c) => c.hwnd);
    lastKnownHwnds = hwnds;
    const result = await minimizeMuClients(hwnds);
    if (result.ok) setDockCollapsed(true);
    syncDockSize(hwnds.length);
    return { ...result, collapsed: true, clients: listed.clients || [] };
  });

  ipcMain.handle('clients:restore-all', async () => {
    const listed = await listMuClients({ withThumbs: false });
    const hwnds = (listed.clients || []).map((c) => c.hwnd);
    const target = hwnds.length ? hwnds : lastKnownHwnds;
    const result = await restoreMuClients(target);
    if (result.ok) setDockCollapsed(false);
    syncDockSize(target.length);
    return { ...result, collapsed: false };
  });

  ipcMain.handle('clients:reorder', async (_e, orderedKeys = []) => {
    const order = Array.isArray(orderedKeys)
      ? orderedKeys.map(String)
      : [];
    saveDockState({ order });
    return { ok: true, order };
  });

  ipcMain.handle('dock:ensure', async () => {
    ensureDock();
    return { ok: true, collapsed: getDockCollapsed() };
  });

  ipcMain.handle('dock:move-by', async (_e, dx, dy) => {
    const next = moveDockBy(Number(dx) || 0, Number(dy) || 0);
    return { ok: true, position: next };
  });
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('net.mubreda.launcher');
  }

  ensureDir(getLauncherDataDir());
  loadLauncherConfig();
  registerIpc();
  createWindow();

  createTray({
    onShow: () => showLauncher(),
    onQuit: () => {
      quitting = true;
      destroyTray();
      app.quit();
    },
  });

  // Keep dock available for multi-client usage
  ensureDock();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else showLauncher();
  });
});

app.on('before-quit', () => {
  quitting = true;
});

app.on('window-all-closed', () => {
  // Keep process alive for tray + multi-client dock.
});
