import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_CONFIG } from './defaults.js';
import {
  ensureDir,
  getGameRoot,
  getLauncherConfigPath,
  getLauncherDataDir,
  getVersionPath,
} from './paths.js';

export function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return structuredClone(fallback);
    const raw = fs.readFileSync(filePath, 'utf8');
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return structuredClone(fallback);
  }
}

export function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export function loadLauncherConfig(gameRoot = getGameRoot()) {
  ensureDir(getLauncherDataDir(gameRoot));
  const configPath = getLauncherConfigPath(gameRoot);
  if (!fs.existsSync(configPath)) {
    writeJson(configPath, DEFAULT_CONFIG);
  }
  return readJsonSafe(configPath, DEFAULT_CONFIG);
}

export function saveLauncherConfig(partial, gameRoot = getGameRoot()) {
  const current = loadLauncherConfig(gameRoot);
  const next = { ...current, ...partial };
  writeJson(getLauncherConfigPath(gameRoot), next);
  return next;
}

export function loadLocalVersion(gameRoot = getGameRoot()) {
  return readJsonSafe(getVersionPath(gameRoot), {
    version: '0.0.0',
    updatedAt: null,
  });
}

export function saveLocalVersion(data, gameRoot = getGameRoot()) {
  writeJson(getVersionPath(gameRoot), data);
  return data;
}
