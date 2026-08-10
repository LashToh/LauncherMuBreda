import fs from 'node:fs';
import {
  detectLanguageCodeFromSelection,
  isSafeLanguageId,
  resolveLangSelection,
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
  if (!isSafeLanguageId(languageId)) {
    languageId = 1;
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

  const fromRegistry = detectLanguageCodeFromSelection(registryLang);
  const language = fromRegistry || 'es';
  const languageId = isSafeLanguageId(launcherOption.languageId)
    ? launcherOption.languageId
    : 1;

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

  // Preserve client language index unless an explicit safe id is provided.
  if (partial.languageId !== undefined && isSafeLanguageId(partial.languageId)) {
    next.languageId = partial.languageId;
  } else {
    next.languageId = isSafeLanguageId(current.languageId) ? current.languageId : 1;
  }

  if (partial.language) {
    next.language = partial.language;
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

  if (partial.resolutionIndex !== undefined) {
    await writeMuResolution(next.resolutionIndex);
  }

  return next;
}

/**
 * Force client off Korean scripts.
 * Uses Language:1 + LangSelection Eng/Spn (prefer Spn if Local folder exists).
 */
export async function repairGameLanguage(gameRoot = getGameRoot()) {
  const launcherOptionPath = getLauncherOptionPath(gameRoot);
  const raw = fs.existsSync(launcherOptionPath)
    ? fs.readFileSync(launcherOptionPath, 'utf8')
    : '';
  const parsed = parseLauncherOption(
    raw || 'DevModeIndex:8\nWindowMode:1\nID:\nLanguage:1\n',
  );

  const needsRepair =
    !isSafeLanguageId(parsed.languageId) || Number(parsed.languageId) === 0;

  const languageId = needsRepair ? 1 : parsed.languageId;
  if (needsRepair || Number(parsed.languageId) !== Number(languageId)) {
    fs.writeFileSync(
      launcherOptionPath,
      serializeLauncherOption({ ...parsed, languageId }),
      'utf8',
    );
  }

  // Prefer Spanish Local folder for Breda; fall back to English.
  let selection = resolveLangSelection(gameRoot, 'es');
  const localPath = path.join(gameRoot, 'Data', 'Local', selection);
  if (!fs.existsSync(localPath)) {
    selection = resolveLangSelection(gameRoot, 'en');
  }

  const currentSelection = await readMuLanguage();
  if (!currentSelection || /^kor/i.test(currentSelection) || needsRepair) {
    await writeMuLanguage(selection);
  }

  return {
    ok: true,
    repaired: needsRepair,
    languageId,
    langSelection: selection,
  };
}
