import fs from 'node:fs';
import path from 'node:path';

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

function listLocalFolders(gameRoot) {
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

export function resolveLangSelection(gameRoot, languageCode) {
  const folders = listLocalFolders(gameRoot);
  const folderMap = new Map(folders.map((name) => [name.toLowerCase(), name]));
  const candidates = CODE_TO_FOLDER_CANDIDATES[languageCode] || [];

  for (const candidate of candidates) {
    const hit = folderMap.get(candidate.toLowerCase());
    if (hit) return hit;
  }

  // Fallbacks when Local folders are missing/unreadable.
  if (languageCode === 'en') return 'Eng';
  if (languageCode === 'pt') return 'Por';
  return 'Spn';
}

export function detectLanguageCodeFromSelection(selection) {
  if (!selection) return null;
  return FOLDER_TO_CODE[String(selection).toLowerCase()] || null;
}

/**
 * MuDevs builds vary. Prefer Eng/Spn/Por order after Korean slot 0.
 * If Latam-style 0/1/2 without Korean is detected via folders only, still
 * avoid writing 0 from the launcher.
 */
export function resolveLanguageId(languageCode) {
  if (languageCode === 'en') return 1;
  if (languageCode === 'pt') return 2;
  if (languageCode === 'es') return 3;
  return 1;
}

export function isSafeLanguageId(languageId) {
  const n = Number(languageId);
  return Number.isFinite(n) && n > 0;
}
