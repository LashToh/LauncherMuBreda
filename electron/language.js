import fs from 'node:fs';
import path from 'node:path';
import { loadLauncherConfig } from './configStore.js';

/**
 * Prefer exact client Local folder names when present.
 * Never select Korean for Breda (ES/EN/PT).
 */
const CODE_TO_FOLDER_CANDIDATES = {
  en: ['Eng', 'ENG', 'English', 'en'],
  es: ['Spn', 'SPN', 'Esp', 'ESP', 'Spa', 'SPA', 'Spanish', 'es'],
  pt: ['Por', 'POR', 'Ptg', 'PTG', 'Portuguese', 'pt'],
};

const FOLDER_TO_CODE = Object.fromEntries(
  Object.entries(CODE_TO_FOLDER_CANDIDATES).flatMap(([code, names]) =>
    names.map((name) => [name.toLowerCase(), code]),
  ),
);

/** Default MuDevs indexes with Korean reserved at 0. Overridable via config. */
const DEFAULT_GAME_LANGUAGE_IDS = {
  en: 1,
  pt: 2,
  es: 3,
};

export function listLocalFolders(gameRoot) {
  const localDir = path.join(gameRoot, 'Data', 'Local');
  if (!fs.existsSync(localDir)) return [];
  try {
    return fs
      .readdirSync(localDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => !/^kor/i.test(name));
  } catch {
    return [];
  }
}

export function resolveLangSelection(gameRoot, languageCode, { requireFolder = false } = {}) {
  const folders = listLocalFolders(gameRoot);
  const folderMap = new Map(folders.map((name) => [name.toLowerCase(), name]));
  const candidates = CODE_TO_FOLDER_CANDIDATES[languageCode] || [];

  for (const candidate of candidates) {
    const hit = folderMap.get(candidate.toLowerCase());
    if (hit) return hit;
  }

  if (requireFolder) return null;

  if (languageCode === 'en') return 'Eng';
  if (languageCode === 'pt') return 'Por';
  return 'Spn';
}

export function detectLanguageCodeFromSelection(selection) {
  if (!selection) return null;
  return FOLDER_TO_CODE[String(selection).toLowerCase()] || null;
}

export function getGameLanguageIds(gameRoot) {
  const config = loadLauncherConfig(gameRoot);
  return {
    ...DEFAULT_GAME_LANGUAGE_IDS,
    ...(config.gameLanguageIds || {}),
  };
}

export function resolveLanguageId(gameRoot, languageCode) {
  const map = getGameLanguageIds(gameRoot);
  const id = Number(map[languageCode]);
  if (!Number.isFinite(id) || id <= 0) {
    return DEFAULT_GAME_LANGUAGE_IDS[languageCode] || 1;
  }
  return id;
}

export function isSafeLanguageId(languageId) {
  const n = Number(languageId);
  return Number.isFinite(n) && n > 0;
}

export function listAvailableUiLanguages(gameRoot) {
  return ['es', 'en', 'pt'].map((code) => {
    const folder = resolveLangSelection(gameRoot, code, { requireFolder: true });
    return {
      code,
      folder,
      available: Boolean(folder),
      languageId: resolveLanguageId(gameRoot, code),
    };
  });
}
