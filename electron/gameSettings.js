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
import { readMuResolution, writeMuResolution } from './registry.js';

function parseLauncherOption(raw) {
  const settings = {
    resolutionIndex: 8,
    windowMode: true,
    languageId: 1,
    id: '',
  };

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(':');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();

    if (key === 'DevModeIndex') settings.resolutionIndex = Number(value) || 0;
    if (key === 'WindowMode') settings.windowMode = value === '1';
    if (key === 'Language') settings.languageId = Number(value) || 0;
    if (key === 'ID') settings.id = value;
  }

  return settings;
}

function serializeLauncherOption(settings) {
  return [
    `DevModeIndex:${settings.resolutionIndex}`,
    `WindowMode:${settings.windowMode ? 1 : 0}`,
    `ID:${settings.id || ''}`,
    `Language:${settings.languageId}`,
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

export async function loadGameSettings(gameRoot = getGameRoot()) {
  const optionPath = getOptionIniPath(gameRoot);
  const launcherOptionPath = getLauncherOptionPath(gameRoot);

  const option = fs.existsSync(optionPath)
    ? parseOptionIni(fs.readFileSync(optionPath, 'utf8'))
    : parseOptionIni('');

  const launcherOption = fs.existsSync(launcherOptionPath)
    ? parseLauncherOption(fs.readFileSync(launcherOptionPath, 'utf8'))
    : parseLauncherOption('DevModeIndex:8\nWindowMode:1\nID:\nLanguage:1\n');

  const registryResolution = await readMuResolution();
  const resolutionIndex =
    registryResolution != null ? registryResolution : launcherOption.resolutionIndex;

  return {
    soundOn: option.soundOn,
    musicOn: option.musicOn,
    effect: option.effect,
    resolutionIndex,
    windowMode: launcherOption.windowMode,
    languageId: launcherOption.languageId,
    language: GAME_TO_UI_LANG[launcherOption.languageId] || 'es',
    id: launcherOption.id,
  };
}

export async function saveGameSettings(partial, gameRoot = getGameRoot()) {
  const current = await loadGameSettings(gameRoot);
  const next = { ...current, ...partial };

  if (partial.language && UI_TO_GAME_LANG[partial.language] !== undefined) {
    next.languageId = UI_TO_GAME_LANG[partial.language];
    next.language = partial.language;
  }

  if (partial.languageId !== undefined) {
    next.languageId = partial.languageId;
    next.language = GAME_TO_UI_LANG[partial.languageId] || next.language;
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

  await writeMuResolution(next.resolutionIndex);

  return next;
}
