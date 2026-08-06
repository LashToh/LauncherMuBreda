import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { loadLauncherConfig } from './configStore.js';
import { getGameRoot } from './paths.js';

function resolveGameExe(gameRoot) {
  const full = path.join(gameRoot, 'main.exe');
  return fs.existsSync(full) ? full : null;
}

export function launchGame(gameRoot = getGameRoot()) {
  // Always launch the client binary directly (no StartGame bootstrap).
  loadLauncherConfig(gameRoot);
  const gameExe = resolveGameExe(gameRoot);

  if (!gameExe) {
    return {
      ok: false,
      code: 'MAIN_MISSING',
      gameRoot,
      message:
        `No se encontró main.exe en:\n${gameRoot}\n\nColocá el launcher portable en la carpeta del cliente (junto a main.exe).`,
    };
  }

  const child = spawn(gameExe, [], {
    cwd: gameRoot,
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });

  child.unref();

  return {
    ok: true,
    code: 'LAUNCHED',
    bootstrap: gameExe,
    exe: gameExe,
  };
}
