import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

function looksLikeGameRoot(dir) {
  if (!dir) return false;
  try {
    const entries = fs.readdirSync(dir).map((name) => name.toLowerCase());
    return entries.includes('main.exe');
  } catch {
    return false;
  }
}

/**
 * Game root = folder that contains main.exe / StartGame.exe.
 * Priority:
 * 1. LAUNCHER_GAME_ROOT (dev/override)
 * 2. PORTABLE_EXECUTABLE_DIR (electron-builder portable)
 * 3. Directory of the packaged exe / unpacked build
 * 4. Dev fallback ./dev-game-root
 */
export function getGameRoot() {
  if (process.env.LAUNCHER_GAME_ROOT) {
    return path.resolve(process.env.LAUNCHER_GAME_ROOT);
  }

  const candidates = [];

  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    candidates.push(path.resolve(process.env.PORTABLE_EXECUTABLE_DIR));
  }

  if (app.isPackaged) {
    candidates.push(path.dirname(process.execPath));
  } else {
    candidates.push(path.resolve(process.cwd(), 'dev-game-root'));
  }

  for (const candidate of candidates) {
    if (looksLikeGameRoot(candidate)) {
      return candidate;
    }
  }

  return candidates[0] || path.resolve(process.cwd(), 'dev-game-root');
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
