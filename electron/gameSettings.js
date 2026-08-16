import fs from 'node:fs';
import {
  GAME_TO_UI_LANG,
  UI_TO_GAME_LANG,
} from './defaults.js';
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
    languageId: 1, // Spanish default for Breda
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
      // 0 = English is valid on this client.
      if (Number.isFinite(n)) settings.languageId = n;
    }
    if (key === 'ID') settings.id = value;
  }

  return settings;
}

function serializeLauncherOption(settings) {
  let languageId = Number(settings.languageId);
  // 0 (English) is valid — only reject NaN / negative.
  if (!Number.isFinite(languageId) || languageId < 0) {
    languageId = UI_TO_GAME_LANG.es;
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

function resolveUiLanguage(languageId, registryLang) {
  // readMuLanguage() already returns en/es/pt when possible.
  if (registryLang && UI_TO_GAME_LANG[registryLang] !== undefined) {
    return registryLang;
  }
  return GAME_TO_UI_LANG[languageId] || 'es';
}

export async function loadGameSettings(gameRoot = getGameRoot()) {
  const optionPath = getOptionIniPath(gameRoot);
  const launcherOptionPath = getLauncherOptionPath(gameRoot);

  const option = fs.existsSync(optionPath)
    ? parseOptionIni(fs.readFileSync(optionPath, 'utf8'))
    : parseOptionIni('');

  const launcherOption = fs.existsSync(launcherOptionPath)
    ? parseLauncherOption(fs.readFileSync(launcherOptionPath, 'utf8'))
    : parseLauncherOption('DevModeIndex:8\nWindowMode:1\nID:\nLanguage:1\n');

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

  let languageId = launcherOption.languageId;
  if (!Number.isFinite(Number(languageId)) || Number(languageId) < 0) {
    languageId = UI_TO_GAME_LANG.es;
  }

  const language = resolveUiLanguage(languageId, registryLang);
  if (UI_TO_GAME_LANG[language] !== undefined) {
    languageId = UI_TO_GAME_LANG[language];
  }

  return {
    soundOn: option.soundOn,
    musicOn: option.musicOn,
    effect: option.effect,
    resolutionIndex,
    windowMode: launcherOption.windowMode,
    languageId,
    language,
    id: launcherOption.id,
  };
}

export async function saveGameSettings(partial, gameRoot = getGameRoot()) {
  const current = await loadGameSettings(gameRoot);
  const next = { ...current, ...partial };
  const resolutionChanged =
    partial.resolutionIndex !== undefined &&
    Number(partial.resolutionIndex) !== Number(current.resolutionIndex);
  const languageChanged =
    (partial.language !== undefined && partial.language !== current.language) ||
    (partial.languageId !== undefined &&
      Number(partial.languageId) !== Number(current.languageId));

  if (partial.language && UI_TO_GAME_LANG[partial.language] !== undefined) {
    next.languageId = UI_TO_GAME_LANG[partial.language];
    next.language = partial.language;
  }

  if (partial.languageId !== undefined) {
    next.languageId = partial.languageId;
    next.language = GAME_TO_UI_LANG[partial.languageId] || next.language;
  }

  // 0 = English is valid. Only heal missing / negative ids.
  if (!Number.isFinite(Number(next.languageId)) || Number(next.languageId) < 0) {
    next.languageId = UI_TO_GAME_LANG[next.language] ?? UI_TO_GAME_LANG.es;
  }

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
      languageId: next.languageId,
      id: next.id,
    }),
    'utf8',
  );

  if (resolutionChanged || partial.resolutionIndex !== undefined) {
    await writeMuResolution(next.resolutionIndex);
  }

  if (languageChanged || partial.language !== undefined) {
    await writeMuLanguage(next.language || 'es');
  }

  return next;
}
