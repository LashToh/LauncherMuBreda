import { Menu, Tray, nativeImage, app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let tray = null;

function resolveTrayIcon() {
  const candidates = [
    path.join(__dirname, '..', 'build', 'icon.ico'),
    path.join(__dirname, '..', 'public', 'assets', 'icon.ico'),
    path.join(__dirname, '..', 'build', 'icon.png'),
    path.join(__dirname, '..', 'public', 'assets', 'favicon.png'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const image = nativeImage.createFromPath(candidate);
      if (!image.isEmpty()) return image.resize({ width: 16, height: 16 });
    }
  }
  return nativeImage.createEmpty();
}

export function createTray({ onShow, onQuit }) {
  if (tray) return tray;

  tray = new Tray(resolveTrayIcon());
  tray.setToolTip('MU Breda Launcher');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir launcher',
      click: () => onShow?.(),
    },
    { type: 'separator' },
    {
      label: 'Salir',
      click: () => onQuit?.(),
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => onShow?.());
  tray.on('click', () => {
    if (process.platform === 'win32') onShow?.();
  });

  return tray;
}

export function destroyTray() {
  if (!tray) return;
  tray.destroy();
  tray = null;
}

export function hideToTray(mainWindow) {
  if (!mainWindow) return;
  mainWindow.hide();
  if (process.platform === 'win32') {
    app.setAppUserModelId('net.mubreda.launcher');
  }
}
