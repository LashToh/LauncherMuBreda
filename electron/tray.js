import { Menu, Tray, app } from 'electron';
import { getAppIconImage } from './appIcon.js';

let tray = null;

export function createTray({ onShow, onQuit }) {
  if (tray) return tray;

  tray = new Tray(getAppIconImage(16));
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
