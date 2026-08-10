import { app } from 'electron';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadGameSettings, saveGameSettings } from './gameSettings.js';
import { loadLauncherConfig } from './configStore.js';
import { RESOLUTIONS } from './defaults.js';
import { checkForUpdates } from './updater.js';

const root = process.env.LAUNCHER_GAME_ROOT || path.resolve('dev-game-root');

app.whenReady().then(async () => {
  process.env.LAUNCHER_GAME_ROOT = root;

  const config = loadLauncherConfig(root);
  assert.equal(config.apiUrl, 'https://api.mubreda.net');
  assert.ok(config.discordUrl.startsWith('http'));
  assert.ok(RESOLUTIONS.length >= 8);

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
  assert.ok(settings.languageId > 0);

  const optionIni = fs.readFileSync(path.join(root, 'option.ini'), 'utf8');
  assert.match(optionIni, /SoundOnOff=0/);
  assert.match(optionIni, /MusicOnOff=1/);

  const launcherOption = fs.readFileSync(path.join(root, 'LauncherOption.if'), 'utf8');
  assert.match(launcherOption, /DevModeIndex:8/);
  assert.match(launcherOption, /WindowMode:0/);
  assert.match(launcherOption, /Language:[1-9]/);

  const update = await checkForUpdates(root);
  assert.equal(update.allowPlay, true);

  console.log('smoke-test OK', {
    settings,
    resolutions: RESOLUTIONS.length,
    updateStatus: update.reason || update.remoteVersion || 'ready',
  });
  app.quit();
});
