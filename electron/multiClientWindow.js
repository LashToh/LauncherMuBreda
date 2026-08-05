import { BrowserWindow, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dockWindow = null;
let collapsed = false;

export function getDockCollapsed() {
  return collapsed;
}

export function setDockCollapsed(value) {
  collapsed = Boolean(value);
  resizeDock();
}

function resizeDock(clientCount = 0) {
  if (!dockWindow) return;
  const width = 72;
  const height = collapsed
    ? 72
    : Math.min(420, 88 + clientCount * 58 + 64);
  const display = screen.getPrimaryDisplay();
  const { width: sw, height: sh } = display.workAreaSize;
  dockWindow.setBounds({
    width,
    height,
    x: sw - width - 18,
    y: Math.round(sh / 2 - height / 2),
  });
}

export function createMultiClientWindow({ isDev, icon }) {
  if (dockWindow && !dockWindow.isDestroyed()) {
    dockWindow.show();
    return dockWindow;
  }

  dockWindow = new BrowserWindow({
    width: 72,
    height: 180,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    show: false,
    icon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  dockWindow.setAlwaysOnTop(true, 'screen-saver');
  dockWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (isDev) {
    dockWindow.loadURL('http://127.0.0.1:5173/multi-client.html');
  } else {
    dockWindow.loadFile(path.join(__dirname, '..', 'dist', 'multi-client.html'));
  }

  dockWindow.once('ready-to-show', () => {
    resizeDock(0);
    dockWindow.show();
  });

  dockWindow.on('closed', () => {
    dockWindow = null;
  });

  return dockWindow;
}

export function showMultiClientWindow() {
  if (!dockWindow || dockWindow.isDestroyed()) return;
  dockWindow.show();
}

export function hideMultiClientWindow() {
  if (!dockWindow || dockWindow.isDestroyed()) return;
  dockWindow.hide();
}

export function syncDockSize(clientCount) {
  resizeDock(clientCount);
}

export function getDockWindow() {
  return dockWindow;
}
