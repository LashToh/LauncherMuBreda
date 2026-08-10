import fs from 'node:fs';
import path from 'node:path';
import {
  detectLanguageCodeFromSelection,
  isSafeLanguageId,
  listAvailableUiLanguages,
  resolveLangSelection,
  resolveLanguageId,
} from './language.js';
import {
  getGameRoot,
  getLauncherOptionPath,
  getOptionIniPath,
} from './paths.js';
import {
  readMuLanguage,
  readMuResolution,
  writeMuLanguage,
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

function serializeLauncherOption(settings) {
  let languageId = Number(settings.languageId);
  // 0 = English on this client — never coerce it away.
  if (!isSafeLanguageId(languageId)) {
    languageId = 0;
  }

  return [
    `DevModeIndex:${settings.resolutionIndex}`,
    `WindowMode:${settings.windowMode ? 1 : 0}`,
    `ID:${settings.id || ''}`,
    `Language:${languageId}`,
    '',
  ].join('\n');
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

  // This Breda S21 pack only works in English in-game. Never persist ES/PT indexes.
  next.languageId = 0;
  next.language = 'en';

  fs.writeFileSync(
    getOptionIniPath(gameRoot),
    serializeOptionIni({
      effect: next.effect,
      soundOn: next.soundOn,
      musicOn: next.musicOn,
    }),
    'utf8',
  );

  fs.writeFileSync(
    getLauncherOptionPath(gameRoot),
    serializeLauncherOption({
      resolutionIndex: next.resolutionIndex,
      windowMode: next.windowMode,
      languageId: 0,
      id: next.id,
    }),
    'utf8',
  );

  if (partial.resolutionIndex !== undefined) {
    await writeMuResolution(next.resolutionIndex);
  }

  // Keep registry on Eng even when saving unrelated settings.
  await writeMuLanguage(
    resolveLangSelection(gameRoot, 'en', { requireFolder: true }) || 'Eng',
  );

  return next;
}

/**
 * Force in-game language to English only.
 * Spn/Por break this Breda client (Skill(Kor)); ES/PT launcher UI is separate.
 */
export async function setGameLanguage(languageCode, gameRoot = getGameRoot()) {
  const requested = String(languageCode || '').toLowerCase();
  if (requested && requested !== 'en') {
    // Refuse to switch the game client off English.
    return {
      ok: false,
      code: 'GAME_LANG_LOCKED_EN',
      message:
        'Este cliente Breda solo funciona en inglés in-game. ' +
        'ES/PT del launcher no cambian el idioma del juego.',
      language: 'en',
      languageId: 0,
    };
  }

  const folder =
    resolveLangSelection(gameRoot, 'en', { requireFolder: true }) || 'Eng';
  const languageId = 0;

  const { path: launcherOptionPath, parsed } = readLauncherOptionFile(gameRoot);
  fs.writeFileSync(
    launcherOptionPath,
    serializeLauncherOption({
      ...parsed,
      languageId,
    }),
    'utf8',
  );

  const reg = await writeMuLanguage(folder);
  if (!reg.ok && !reg.skipped) {
    return {
      ok: false,
      message: `No se pudo escribir LangSelection: ${reg.message}`,
      folder,
      languageId,
    };
  }

  return {
    ok: true,
    language: 'en',
    languageId,
    langSelection: folder,
    launcherLang: reg.launcherLang || null,
    availableLanguages: listAvailableUiLanguages(gameRoot),
  };
}

/**
 * Always put the game client back on English (Language:0 + Eng).
 */
export async function repairGameLanguage(gameRoot = getGameRoot()) {
  return setGameLanguage('en', gameRoot);
}
