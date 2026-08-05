import fs from 'node:fs';
import path from 'node:path';
import { ensureDir, getGameRoot, getLauncherDataDir } from './paths.js';
import { iconForClassId, iconForGroup } from './classIcons.js';

function cachePath(gameRoot = getGameRoot()) {
  return path.join(getLauncherDataDir(gameRoot), 'characters.json');
}

export function loadCharacterCache(gameRoot = getGameRoot()) {
  ensureDir(getLauncherDataDir(gameRoot));
  const file = cachePath(gameRoot);
  try {
    if (!fs.existsSync(file)) return {};
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

export function saveCharacterCache(cache, gameRoot = getGameRoot()) {
  ensureDir(getLauncherDataDir(gameRoot));
  fs.writeFileSync(cachePath(gameRoot), `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
}

export function setCharacterClass(name, { classId, group } = {}, gameRoot = getGameRoot()) {
  const key = String(name || '').trim().toLowerCase();
  if (!key) return null;
  const cache = loadCharacterCache(gameRoot);
  const icon =
    classId != null ? iconForClassId(classId) : iconForGroup(group);
  cache[key] = {
    name: String(name).trim(),
    classId: classId != null ? Number(classId) : null,
    group: icon.group,
    file: icon.file,
    label: icon.label,
    updatedAt: new Date().toISOString(),
  };
  saveCharacterCache(cache, gameRoot);
  return cache[key];
}

export function getCachedCharacter(name, gameRoot = getGameRoot()) {
  const key = String(name || '').trim().toLowerCase();
  if (!key) return null;
  return loadCharacterCache(gameRoot)[key] || null;
}
