import { app } from 'electron';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadGameSettings, saveGameSettings, setGameLanguage } from './gameSettings.js';
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

  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(
    path.join(root, 'LauncherOption.if'),
    'DevModeIndex:9\nWindowMode:1\nID:\nLanguage:0\n',
    'utf8',
  );

  await saveGameSettings(
    {
      soundOn: false,
      musicOn: true,
      resolutionIndex: 8,
      windowMode: false,
    },
    root,
  );

  const settings = await loadGameSettings(root);
  assert.equal(settings.soundOn, false);
  assert.equal(settings.musicOn, true);
  assert.equal(settings.resolutionIndex, 8);
  assert.equal(settings.windowMode, false);

  const optionIni = fs.readFileSync(path.join(root, 'option.ini'), 'utf8');
  assert.match(optionIni, /SoundOnOff=0/);
  assert.match(optionIni, /MusicOnOff=1/);

  // Settings save must NOT rewrite Language:0.
  const launcherOption = fs.readFileSync(path.join(root, 'LauncherOption.if'), 'utf8');
  assert.match(launcherOption, /DevModeIndex:8/);
  assert.match(launcherOption, /WindowMode:0/);
  assert.match(launcherOption, /Language:0/);

  const update = await checkForUpdates(root);
  assert.equal(update.allowPlay, true);

  const noop = await setGameLanguage('en', root);
  assert.equal(noop.skipped, true);
  assert.match(
    fs.readFileSync(path.join(root, 'LauncherOption.if'), 'utf8'),
    /Language:0/,
  );

  // Even if disk had Language:1, saving settings must preserve it (no lang writes).
  fs.writeFileSync(
    path.join(root, 'LauncherOption.if'),
    'DevModeIndex:8\nWindowMode:0\nID:\nLanguage:1\n',
    'utf8',
  );
  await saveGameSettings({ soundOn: true }, root);
  assert.match(
    fs.readFileSync(path.join(root, 'LauncherOption.if'), 'utf8'),
    /Language:1/,
  );

  console.log('smoke-test OK', {
    settings,
    resolutions: RESOLUTIONS.length,
    updateStatus: update.reason || update.remoteVersion || 'ready',
    languageUntouched: true,
  });
  app.quit();
});
