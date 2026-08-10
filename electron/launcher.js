import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { shell } from 'electron';
import { prepareEnglishClient } from './clientRepair.js';
import { loadLauncherConfig } from './configStore.js';
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

  // Outdated Data\\Local\\skill.bmd causes Skill(Kor) popups; Eng pack has S21 data.
  // Also align Language / LangSelection / LauncherLang to English before Main.exe.
  let repair = null;
  try {
    repair = await prepareEnglishClient(gameRoot);
  } catch (error) {
    repair = {
      ok: false,
      message: error?.message || 'No se pudo reparar datos de idioma/skills.',
    };
  }

  if (repair && repair.ok === false && repair.skill?.ok === false) {
    return {
      ok: false,
      code: 'CLIENT_REPAIR_FAILED',
      gameRoot,
      exe: gameExe,
      repair,
      message:
        repair.message ||
        'No se pudo reparar skill.bmd / idioma inglés del cliente.',
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
        repair,
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
      repair,
    };
  }

  return {
    ok: false,
    code: 'LAUNCH_EACCES',
    gameRoot,
    exe: gameExe,
    repair,
    message:
      `No se pudo abrir Main.exe (permiso denegado).\n\n` +
      `Probá:\n` +
      `• Ejecutar el launcher como Administrador\n` +
      `• Permitir Main.exe en el antivirus\n` +
      `• Abrir Main.exe a mano una vez desde la carpeta del cliente\n\n` +
      `${gameExe}`,
  };
}
