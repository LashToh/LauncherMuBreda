import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAppIconPath } from './appIcon.js';
import { DEFAULT_CONFIG, RESOLUTIONS } from './defaults.js';
import {
  loadLauncherConfig,
  loadLocalVersion,
  saveLauncherConfig,
} from './configStore.js';
import { loadGameSettings, saveGameSettings } from './gameSettings.js';
import { launchGame } from './launcher.js';
import { getGameRoot, getLauncherDataDir, ensureDir } from './paths.js';
import { createTray, destroyTray, hideToTray } from './tray.js';
import { applyUpdate, checkForUpdates } from './updater.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged && process.env.ELECTRON_DEV === '1';
let mainWindow = null;
let quitting = false;

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

  const iconPath = getAppIconPath();
  if (iconPath) {
    mainWindow.setIcon(iconPath);
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    quitLauncher();
  });

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
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

  ipcMain.handle('game:launch', async () => launchGame());

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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else showLauncher();
  });
});

app.on('before-quit', () => {
  quitting = true;
});

app.on('window-all-closed', () => {
  if (!quitting) return;
});
