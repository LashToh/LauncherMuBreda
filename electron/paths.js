import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

/**
 * Game root = folder that contains main.exe and the launcher.
 * In production: directory of the executable.
 * In development: LAUNCHER_GAME_ROOT env, or repo /dev-game-root.
 */
export function getGameRoot() {
  if (process.env.LAUNCHER_GAME_ROOT) {
    return path.resolve(process.env.LAUNCHER_GAME_ROOT);
  }

  if (app.isPackaged) {
    return path.dirname(process.execPath);
  }

  const devRoot = path.resolve(process.cwd(), 'dev-game-root');
  return devRoot;
}

export function getLauncherDataDir(gameRoot = getGameRoot()) {
  return path.join(gameRoot, 'Data', 'Launcher');
}

export function getLauncherConfigPath(gameRoot = getGameRoot()) {
  return path.join(getLauncherDataDir(gameRoot), 'launcher.config.json');
}

export function getVersionPath(gameRoot = getGameRoot()) {
  return path.join(getLauncherDataDir(gameRoot), 'version.json');
}

export function getOptionIniPath(gameRoot = getGameRoot()) {
  return path.join(gameRoot, 'option.ini');
}

export function getLauncherOptionPath(gameRoot = getGameRoot()) {
  return path.join(gameRoot, 'LauncherOption.if');
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}
