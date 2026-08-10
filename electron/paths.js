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
 * Game root = folder that contains Main.exe.
 *
 * Supports:
 * - launcher exe sitting next to Main.exe
 * - launcher inside a subfolder (MuBreda-Launcher/) next to Main.exe
 * - electron-builder single-file portable (PORTABLE_EXECUTABLE_DIR)
 * - LAUNCHER_GAME_ROOT override / dev-game-root
 */
export function getGameRoot() {
  if (process.env.LAUNCHER_GAME_ROOT) {
    return path.resolve(process.env.LAUNCHER_GAME_ROOT);
  }

  const candidates = [];

  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    const portableDir = path.resolve(process.env.PORTABLE_EXECUTABLE_DIR);
    candidates.push(portableDir);
    candidates.push(path.dirname(portableDir));
  }

  if (app.isPackaged) {
    const exeDir = path.dirname(process.execPath);
    candidates.push(exeDir);
    candidates.push(path.dirname(exeDir));
  } else {
    candidates.push(path.resolve(process.cwd(), 'dev-game-root'));
  }

  const seen = new Set();
  for (const candidate of candidates) {
    const normalized = path.resolve(candidate);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    if (looksLikeGameRoot(normalized)) {
      return normalized;
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
