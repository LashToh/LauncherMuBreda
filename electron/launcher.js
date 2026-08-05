import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { loadLauncherConfig } from './configStore.js';
import { getGameRoot } from './paths.js';

function resolveBootstrap(gameRoot, config) {
  const candidates = [
    config.bootstrapExe,
    config.bootstrapFallback,
    'StartGame.exe',
    '1 - StartGame.exe',
  ].filter(Boolean);

  for (const name of candidates) {
    const full = path.join(gameRoot, name);
    if (fs.existsSync(full)) return full;
  }

  return null;
}

export function launchGame(gameRoot = getGameRoot()) {
  const config = loadLauncherConfig(gameRoot);
  const bootstrap = resolveBootstrap(gameRoot, config);

  if (!bootstrap) {
    return {
      ok: false,
      code: 'BOOTSTRAP_MISSING',
      message:
        'No se encontró StartGame.exe. Colocá el launcher en la carpeta del cliente junto a main.exe / StartGame.exe.',
    };
  }

  const child = spawn(bootstrap, [], {
    cwd: gameRoot,
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });

  child.unref();

  return {
    ok: true,
    code: 'LAUNCHED',
    bootstrap,
  };
}
