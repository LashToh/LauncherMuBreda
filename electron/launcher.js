import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { shell } from 'electron';
import { loadLauncherConfig } from './configStore.js';
import { setGameLanguage } from './gameSettings.js';
import { getGameRoot } from './paths.js';

/** Resolve Main.exe / main.exe with the real casing from disk. */
function resolveGameExe(gameRoot) {
  try {
    const entries = fs.readdirSync(gameRoot);
    const match = entries.find((name) => name.toLowerCase() === 'main.exe');
    if (match) return path.join(gameRoot, match);
  } catch {
    // ignore
  }

  for (const name of ['Main.exe', 'main.exe']) {
    const full = path.join(gameRoot, name);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

function spawnViaCmd(gameExe, gameRoot) {
  return new Promise((resolve) => {
    // `start "" "path"` — empty title is required when the path is quoted.
    const child = spawn(
      process.env.ComSpec || 'cmd.exe',
      ['/d', '/s', '/c', `start "" "${gameExe}"`],
      {
        cwd: gameRoot,
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      },
    );

    child.once('error', (error) => {
      resolve({ ok: false, error });
    });

    child.once('spawn', () => {
      child.unref();
      resolve({ ok: true });
    });
  });
}

export async function launchGame(gameRoot = getGameRoot()) {
  loadLauncherConfig(gameRoot);
  const gameExe = resolveGameExe(gameRoot);

  if (!gameExe) {
    return {
      ok: false,
      code: 'MAIN_MISSING',
      gameRoot,
      message:
        `No se encontró Main.exe en:\n${gameRoot}\n\nColocá el launcher portable en la carpeta del cliente (junto a Main.exe).`,
    };
  }

  // This MuDevs client uses Language:0 = English (not Korean).
  // Earlier launcher builds rewrote that to Language:1 and broke EN — put it back.
  let language = null;
  try {
    language = await setGameLanguage('en', gameRoot);
  } catch (error) {
    language = {
      ok: false,
      message: error?.message || 'No se pudo restaurar Language:0 / LangSelection=Eng.',
    };
  }

  // Prefer Electron shell.openPath (handles permissions / associations better on Windows).
  try {
    const openError = await shell.openPath(gameExe);
    if (!openError) {
      return {
        ok: true,
        code: 'LAUNCHED',
        exe: gameExe,
        method: 'openPath',
        language,
      };
    }
  } catch {
    // fall through to cmd start
  }

  const viaCmd = await spawnViaCmd(gameExe, gameRoot);
  if (viaCmd.ok) {
    return {
      ok: true,
      code: 'LAUNCHED',
      exe: gameExe,
      method: 'cmd-start',
      language,
    };
  }

  return {
    ok: false,
    code: 'LAUNCH_EACCES',
    gameRoot,
    exe: gameExe,
    language,
    message:
      `No se pudo abrir Main.exe (permiso denegado).\n\n` +
      `Probá:\n` +
      `• Ejecutar el launcher como Administrador\n` +
      `• Permitir Main.exe en el antivirus\n` +
      `• Abrir Main.exe a mano una vez desde la carpeta del cliente\n\n` +
      `${gameExe}`,
  };
}
