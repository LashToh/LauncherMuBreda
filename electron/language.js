import fs from 'node:fs';
import path from 'node:path';
import { loadLauncherConfig } from './configStore.js';

/**
 * Prefer exact client Local folder names when present.
 * Never select Korean Local folder (Kor) for Breda (ES/EN/PT).
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

/**
 * MuDevs Resolution Changer / LauncherOption.if Language: indexes
 * for this Season 21 client (confirmed working before launcher "fixes"):
 *   0 = English, 1 = Spanish, 2 = Portuguese
 * Do NOT treat 0 as Korean — Skill(Kor) text is a hardcoded client error string.
 */
const DEFAULT_GAME_LANGUAGE_IDS = {
  en: 0,
  es: 1,
  pt: 2,
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
  const custom = config.gameLanguageIds;
  // Ignore broken maps we briefly shipped (en:1 / es:3). English is 0 here.
  if (
    custom &&
    typeof custom === 'object' &&
    Number(custom.en) === 0 &&
    Number(custom.es) >= 0 &&
    Number(custom.pt) >= 0
  ) {
    return { ...DEFAULT_GAME_LANGUAGE_IDS, ...custom };
  }
  return { ...DEFAULT_GAME_LANGUAGE_IDS };
}

export function resolveLanguageId(gameRoot, languageCode) {
  const map = getGameLanguageIds(gameRoot);
  const id = Number(map[languageCode]);
  // 0 is valid (English). Only fall back when missing/invalid.
  if (!Number.isFinite(id) || id < 0) {
    return DEFAULT_GAME_LANGUAGE_IDS[languageCode] ?? 0;
  }
  return id;
}

export function isSafeLanguageId(languageId) {
  const n = Number(languageId);
  return Number.isFinite(n) && n >= 0;
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
