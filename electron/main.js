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
import { setCharacterClass } from './characterCache.js';
import { CLASS_PICK_LIST, classIconUrl, iconForGroup } from './classIcons.js';
import { saveDockState } from './dockStore.js';
import {
  closeMultiClientWindow,
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
let lastClientsCache = [];
let listInFlight = null;

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

function quitLauncher() {
  quitting = true;
  closeMultiClientWindow();
  destroyTray();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
  }
  app.quit();
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
    // Closing the launcher exits the app and the dock.
    event.preventDefault();
    quitLauncher();
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
      quitLauncher();
      return { ok: true, quit: true };
    }
    win?.close();
    return { ok: true };
  });

  ipcMain.handle('clients:list', async () => {
    if (listInFlight) {
      const pending = await listInFlight;
      return {
        ...pending,
        collapsed: getDockCollapsed(),
        classOptions: CLASS_PICK_LIST,
      };
    }

    listInFlight = listMuClients()
      .then((result) => {
        lastClientsCache = result.clients || [];
        lastKnownHwnds = lastClientsCache.map((c) => c.hwnd);
        if (!getDockCollapsed()) {
          syncDockSize(lastClientsCache.length);
        }
        return result;
      })
      .finally(() => {
        listInFlight = null;
      });

    const result = await listInFlight;
    return {
      ...result,
      collapsed: getDockCollapsed(),
      classOptions: CLASS_PICK_LIST,
    };
  });

  ipcMain.handle('clients:set-class', async (_e, payload = {}) => {
    const name = payload.name || payload.label;
    const group = Number(payload.group);
    if (!name || !Number.isFinite(group)) {
      return { ok: false, message: 'Invalid class payload' };
    }
    const saved = setCharacterClass(name, { group });
    const icon = iconForGroup(group);
    // refresh cache entry in memory
    lastClientsCache = lastClientsCache.map((client) => {
      if (String(client.label).toLowerCase() !== String(name).toLowerCase()) {
        return client;
      }
      return {
        ...client,
        classFile: icon.file,
        classLabel: icon.label,
        classGroup: icon.group,
        classIconUrl: classIconUrl(icon.file),
      };
    });
    return { ok: true, saved, clients: lastClientsCache };
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

  // Arrow only collapses/expands the dock UI — never minimizes MU clients.
  ipcMain.handle('dock:set-collapsed', async (_e, value) => {
    setDockCollapsed(Boolean(value));
    syncDockSize(lastKnownHwnds.length || lastClientsCache.length);
    return {
      ok: true,
      collapsed: getDockCollapsed(),
      clients: lastClientsCache,
    };
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
    onQuit: () => quitLauncher(),
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
  closeMultiClientWindow();
});

app.on('window-all-closed', () => {
  if (!quitting) return;
  // Allow quit when launcher was closed explicitly.
});
