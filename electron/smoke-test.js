import { app } from 'electron';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadGameSettings, saveGameSettings, setGameLanguage } from './gameSettings.js';
import { loadLauncherConfig } from './configStore.js';
import { RESOLUTIONS } from './defaults.js';
import { resolveLanguageId } from './language.js';
import { checkForUpdates } from './updater.js';

const root = process.env.LAUNCHER_GAME_ROOT || path.resolve('dev-game-root');

app.whenReady().then(async () => {
  process.env.LAUNCHER_GAME_ROOT = root;

  const config = loadLauncherConfig(root);
  assert.equal(config.apiUrl, 'https://api.mubreda.net');
  assert.ok(config.discordUrl.startsWith('http'));
  assert.ok(RESOLUTIONS.length >= 8);

  // English must be Language:0 on this client (historical working mapping).
  assert.equal(resolveLanguageId(root, 'en'), 0);
  assert.equal(resolveLanguageId(root, 'es'), 1);
  assert.equal(resolveLanguageId(root, 'pt'), 2);

  await saveGameSettings(
    {
      soundOn: false,
      musicOn: true,
      resolutionIndex: 8,
      windowMode: false,
      language: 'pt',
    },
    root,
  );

  const settings = await loadGameSettings(root);
  assert.equal(settings.soundOn, false);
  assert.equal(settings.musicOn, true);
  assert.equal(settings.resolutionIndex, 8);
  assert.equal(settings.windowMode, false);
  assert.ok(settings.languageId >= 0);

  const optionIni = fs.readFileSync(path.join(root, 'option.ini'), 'utf8');
  assert.match(optionIni, /SoundOnOff=0/);
  assert.match(optionIni, /MusicOnOff=1/);

  const launcherOption = fs.readFileSync(path.join(root, 'LauncherOption.if'), 'utf8');
  assert.match(launcherOption, /DevModeIndex:8/);
  assert.match(launcherOption, /WindowMode:0/);
  assert.match(launcherOption, /Language:\d+/);

  const update = await checkForUpdates(root);
  assert.equal(update.allowPlay, true);

  fs.mkdirSync(path.join(root, 'Data', 'Local', 'Eng'), { recursive: true });
  const en = await setGameLanguage('en', root);
  assert.equal(en.ok, true);
  assert.equal(en.languageId, 0);
  const afterEn = fs.readFileSync(path.join(root, 'LauncherOption.if'), 'utf8');
  assert.match(afterEn, /Language:0/);

  const locked = await setGameLanguage('es', root);
  assert.equal(locked.ok, false);
  assert.equal(locked.code, 'GAME_LANG_LOCKED_EN');
  const stillEn = fs.readFileSync(path.join(root, 'LauncherOption.if'), 'utf8');
  assert.match(stillEn, /Language:0/);

  await saveGameSettings({ language: 'pt', languageId: 2 }, root);
  const afterSave = fs.readFileSync(path.join(root, 'LauncherOption.if'), 'utf8');
  assert.match(afterSave, /Language:0/);

  console.log('smoke-test OK', {
    settings,
    resolutions: RESOLUTIONS.length,
    updateStatus: update.reason || update.remoteVersion || 'ready',
    englishLanguageId: en.languageId,
    lockedEs: locked.code,
  });
  app.quit();
});
