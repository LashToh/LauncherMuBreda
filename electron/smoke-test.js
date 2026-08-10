import { app } from 'electron';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { repairSkillData } from './clientRepair.js';
import { loadGameSettings, saveGameSettings } from './gameSettings.js';
import { loadLauncherConfig } from './configStore.js';
import { RESOLUTIONS } from './defaults.js';
import { checkForUpdates } from './updater.js';

const root = process.env.LAUNCHER_GAME_ROOT || path.resolve('dev-game-root');

function writeFakeBmd(filePath, contents, mtimeMs) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
  if (mtimeMs) {
    const date = new Date(mtimeMs);
    fs.utimesSync(filePath, date, date);
  }
}

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

  // Skill repair: Eng copy newer than outdated Local\\skill.bmd
  const localDir = path.join(root, 'Data', 'Local');
  const oldSkill = path.join(localDir, 'skill.bmd');
  const engSkill = path.join(localDir, 'Eng', 'Skill.bmd');
  writeFakeBmd(oldSkill, 'OLD-SKILL', Date.UTC(2022, 4, 19));
  writeFakeBmd(engSkill, 'NEW-SKILL-S21', Date.UTC(2026, 0, 26));
  writeFakeBmd(
    path.join(localDir, 'Eng', 'SkillTooltipText.bmd'),
    'NEW-TIP',
    Date.UTC(2026, 0, 26),
  );
  writeFakeBmd(
    path.join(localDir, 'SkillTooltipText.bmd'),
    'OLD-TIP',
    Date.UTC(2022, 4, 19),
  );

  const repaired = repairSkillData(root);
  assert.equal(repaired.ok, true);
  assert.ok(repaired.copied.some((c) => /skill\.bmd/i.test(c.file)));
  assert.equal(fs.readFileSync(oldSkill, 'utf8'), 'NEW-SKILL-S21');
  assert.equal(
    fs.readFileSync(path.join(localDir, 'SkillTooltipText.bmd'), 'utf8'),
    'NEW-TIP',
  );

  const second = repairSkillData(root);
  assert.equal(second.ok, true);
  assert.equal(second.copied.length, 0);

  console.log('smoke-test OK', {
    settings,
    resolutions: RESOLUTIONS.length,
    updateStatus: update.reason || update.remoteVersion || 'ready',
    skillCopied: repaired.copied.map((c) => c.file),
  });
  app.quit();
});
