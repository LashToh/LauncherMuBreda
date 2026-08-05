import { app, BrowserWindow, ipcMain, shell } from 'electron';
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
import { getGameRoot, getLauncherDataDir, ensureDir } from './paths.js';
import { applyUpdate, checkForUpdates } from './updater.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged && process.env.ELECTRON_DEV === '1';
let mainWindow = null;

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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

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
    const config = loadLauncherConfig(gameRoot);
    const settings = loadGameSettings(gameRoot);
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
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return { ok: false, message: 'Invalid URL' };
    }
    await shell.openExternal(url);
    return { ok: true };
  });

  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:close', () => mainWindow?.close());
}

app.whenReady().then(() => {
  ensureDir(getLauncherDataDir());
  loadLauncherConfig();
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
