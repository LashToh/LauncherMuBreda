import fs from 'node:fs';
import {
  detectLanguageCodeFromSelection,
  isSafeLanguageId,
  listAvailableUiLanguages,
} from './language.js';
import {
  getGameRoot,
  getLauncherOptionPath,
  getOptionIniPath,
} from './paths.js';
import {
  readMuLanguage,
  readMuResolution,
  writeMuResolution,
} from './registry.js';

function parseLauncherOption(raw) {
  const settings = {
    resolutionIndex: 8,
    windowMode: true,
    languageId: 0,
    id: '',
  };

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(':');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();

    if (key === 'DevModeIndex') {
      const n = Number(value);
      if (Number.isFinite(n)) settings.resolutionIndex = n;
    }
    if (key === 'WindowMode') settings.windowMode = value === '1';
    if (key === 'Language') {
      const n = Number(value);
      if (Number.isFinite(n)) settings.languageId = n;
    }
    if (key === 'ID') settings.id = value;
  }

  return settings;
}

/**
 * Write resolution/window/ID only. Never rewrite Language: —
 * this Breda pack must stay on Language:0 (English) set outside the launcher.
 */
function writeLauncherOptionPreservingLanguage(gameRoot, settings) {
  const launcherOptionPath = getLauncherOptionPath(gameRoot);
  const existing = fs.existsSync(launcherOptionPath)
    ? fs.readFileSync(launcherOptionPath, 'utf8')
    : '';

  const languageMatch = existing.match(/^\s*Language\s*:.*$/m);
  // If missing on a brand-new file, default to English (0). Never change an existing value.
  const languageLine = languageMatch ? languageMatch[0].trim() : 'Language:0';

  const body = [
    `DevModeIndex:${settings.resolutionIndex}`,
    `WindowMode:${settings.windowMode ? 1 : 0}`,
    `ID:${settings.id || ''}`,
    languageLine,
    '',
  ].join('\n');

  fs.writeFileSync(launcherOptionPath, body, 'utf8');
}

function parseOptionIni(raw) {
  const result = {
    effect: 4,
    soundOn: true,
    musicOn: true,
  };

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('[') || trimmed.startsWith(';')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim().toLowerCase();
    const value = trimmed.slice(eq + 1).trim();

    if (key === 'effect') result.effect = Number(value) || 4;
    if (key === 'soundonoff' || key === 'sound') {
      result.soundOn = value === '1' || value.toLowerCase() === 'true';
    }
    if (key === 'musiconoff' || key === 'music') {
      result.musicOn = value === '1' || value.toLowerCase() === 'true';
    }
  }

  return result;
}

function serializeOptionIni(settings) {
  return [
    '[OPTION]',
    `Effect=${settings.effect}`,
    `SoundOnOff=${settings.soundOn ? 1 : 0}`,
    `MusicOnOff=${settings.musicOn ? 1 : 0}`,
    '',
  ].join('\n');
}

function readLauncherOptionFile(gameRoot) {
  const launcherOptionPath = getLauncherOptionPath(gameRoot);
  const raw = fs.existsSync(launcherOptionPath)
    ? fs.readFileSync(launcherOptionPath, 'utf8')
    : '';
  return {
    path: launcherOptionPath,
    parsed: parseLauncherOption(
      raw || 'DevModeIndex:8\nWindowMode:1\nID:\nLanguage:0\n',
    ),
  };
}

export async function loadGameSettings(gameRoot = getGameRoot()) {
  const optionPath = getOptionIniPath(gameRoot);
  const { parsed: launcherOption } = readLauncherOptionFile(gameRoot);

  const option = fs.existsSync(optionPath)
    ? parseOptionIni(fs.readFileSync(optionPath, 'utf8'))
    : parseOptionIni('');

  let registryResolution = null;
  let registryLang = null;
  try {
    [registryResolution, registryLang] = await Promise.all([
      Promise.race([
        readMuResolution(),
        new Promise((resolve) => setTimeout(() => resolve(null), 250)),
      ]),
      Promise.race([
        readMuLanguage(),
        new Promise((resolve) => setTimeout(() => resolve(null), 250)),
      ]),
    ]);
  } catch {
    registryResolution = null;
    registryLang = null;
  }

  const resolutionIndex =
    registryResolution != null ? registryResolution : launcherOption.resolutionIndex;

  const fromRegistry = detectLanguageCodeFromSelection(registryLang);
  const language = fromRegistry || 'en';
  const languageId = isSafeLanguageId(launcherOption.languageId)
    ? launcherOption.languageId
    : 0;

  return {
    soundOn: option.soundOn,
    musicOn: option.musicOn,
    effect: option.effect,
    resolutionIndex,
    windowMode: launcherOption.windowMode,
    languageId,
    language,
    langSelection: registryLang || null,
    availableLanguages: listAvailableUiLanguages(gameRoot),
    id: launcherOption.id,
  };
}

export async function saveGameSettings(partial, gameRoot = getGameRoot()) {
  const current = await loadGameSettings(gameRoot);
  const next = { ...current, ...partial };

  fs.writeFileSync(
    getOptionIniPath(gameRoot),
    serializeOptionIni({
      effect: next.effect,
      soundOn: next.soundOn,
      musicOn: next.musicOn,
    }),
    'utf8',
  );

  // Resolution / window / ID only — Language: line is left untouched.
  writeLauncherOptionPreservingLanguage(gameRoot, {
    resolutionIndex: next.resolutionIndex,
    windowMode: next.windowMode,
    id: next.id,
  });

  if (partial.resolutionIndex !== undefined) {
    await writeMuResolution(next.resolutionIndex);
  }

  // Re-read so returned languageId matches whatever is still on disk.
  return loadGameSettings(gameRoot);
}

/**
 * Intentionally a no-op. The launcher must never change game language.
 * Set Language:0 + LangSelection=Eng outside the launcher (or Play-English.bat).
 */
export async function setGameLanguage() {
  return {
    ok: true,
    skipped: true,
    code: 'GAME_LANG_UNTOUCHED',
    message: 'El launcher no modifica el idioma del juego.',
  };
}

export async function repairGameLanguage() {
  return setGameLanguage();
}
