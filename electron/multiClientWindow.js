import { BrowserWindow, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDockState, saveDockState } from './dockStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dockWindow = null;
let collapsed = false;
let lastClientCount = 0;

export function getDockCollapsed() {
  return collapsed;
}

export function setDockCollapsed(value) {
  collapsed = Boolean(value);
  resizeDock(lastClientCount);
}

function dockSize(clientCount = 0) {
  const width = 64;
  const height = collapsed
    ? 58
    : Math.min(380, 72 + clientCount * 50 + 56);
  return { width, height };
}

function defaultBottomRight(width, height) {
  const display = screen.getPrimaryDisplay();
  const { x: workX, y: workY, width: sw, height: sh } = display.workArea;
  const margin = 10;
  return {
    x: workX + sw - width - margin,
    y: workY + sh - height - margin,
  };
}

function clampToWorkArea(x, y, width, height) {
  const display = screen.getDisplayNearestPoint({ x, y });
  const { x: workX, y: workY, width: sw, height: sh } = display.workArea;
  const margin = 4;
  return {
    x: Math.min(Math.max(x, workX + margin), workX + sw - width - margin),
    y: Math.min(Math.max(y, workY + margin), workY + sh - height - margin),
  };
}

function resizeDock(clientCount = 0) {
  if (!dockWindow || dockWindow.isDestroyed()) return;
  lastClientCount = clientCount;
  const { width, height } = dockSize(clientCount);
  const state = loadDockState();
  const prev = dockWindow.getBounds();

  let x;
  let y;

  if (Number.isFinite(state.x) && Number.isFinite(state.y)) {
    // Keep bottom-left of previous bounds stable when height changes
    const bottom = prev.y + prev.height;
    x = state.x;
    y = bottom - height;
  } else {
    ({ x, y } = defaultBottomRight(width, height));
  }

  ({ x, y } = clampToWorkArea(x, y, width, height));
  dockWindow.setBounds({ width, height, x, y });
}

export function createMultiClientWindow({ isDev, icon }) {
  if (dockWindow && !dockWindow.isDestroyed()) {
    dockWindow.show();
    return dockWindow;
  }

  const { width, height } = dockSize(0);
  const pos = defaultBottomRight(width, height);
  const state = loadDockState();
  const start = Number.isFinite(state.x) && Number.isFinite(state.y)
    ? clampToWorkArea(state.x, state.y, width, height)
    : pos;

  dockWindow = new BrowserWindow({
    width,
    height,
    x: start.x,
    y: start.y,
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
      webSecurity: false, // allow file:// thumbnails
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

  dockWindow.on('moved', () => {
    if (!dockWindow || dockWindow.isDestroyed()) return;
    const bounds = dockWindow.getBounds();
    saveDockState({ x: bounds.x, y: bounds.y });
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

export function closeMultiClientWindow() {
  if (!dockWindow || dockWindow.isDestroyed()) {
    dockWindow = null;
    return;
  }
  dockWindow.destroy();
  dockWindow = null;
}

export function syncDockSize(clientCount) {
  resizeDock(clientCount);
}

export function getDockWindow() {
  return dockWindow;
}

export function moveDockBy(dx, dy) {
  if (!dockWindow || dockWindow.isDestroyed()) return null;
  const bounds = dockWindow.getBounds();
  const next = clampToWorkArea(bounds.x + dx, bounds.y + dy, bounds.width, bounds.height);
  dockWindow.setBounds({ ...bounds, ...next });
  saveDockState({ x: next.x, y: next.y });
  return next;
}
