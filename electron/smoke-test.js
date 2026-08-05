import { app } from 'electron';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadGameSettings, saveGameSettings } from './gameSettings.js';
import { loadLauncherConfig } from './configStore.js';
import { checkForUpdates } from './updater.js';

const root = process.env.LAUNCHER_GAME_ROOT || path.resolve('dev-game-root');

app.whenReady().then(async () => {
  process.env.LAUNCHER_GAME_ROOT = root;

  const config = loadLauncherConfig(root);
  assert.equal(config.apiUrl, 'https://api.mubreda.net');

  saveGameSettings(
    {
      soundOn: false,
      musicOn: true,
      resolutionIndex: 10,
      windowMode: false,
      language: 'pt',
    },
    root,
  );

  const settings = loadGameSettings(root);
  assert.equal(settings.soundOn, false);
  assert.equal(settings.musicOn, true);
  assert.equal(settings.resolutionIndex, 10);
  assert.equal(settings.windowMode, false);
  assert.equal(settings.language, 'pt');
  assert.equal(settings.languageId, 2);

  const optionIni = fs.readFileSync(path.join(root, 'option.ini'), 'utf8');
  assert.match(optionIni, /SoundOnOff=0/);
  assert.match(optionIni, /MusicOnOff=1/);

  const launcherOption = fs.readFileSync(path.join(root, 'LauncherOption.if'), 'utf8');
  assert.match(launcherOption, /DevModeIndex:10/);
  assert.match(launcherOption, /WindowMode:0/);
  assert.match(launcherOption, /Language:2/);

  const update = await checkForUpdates(root);
  assert.equal(update.allowPlay, true);

  console.log('smoke-test OK', { settings, updateStatus: update.reason || update.remoteVersion || 'ready' });
  app.quit();
});
