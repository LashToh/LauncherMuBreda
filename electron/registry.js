import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { RESOLUTIONS } from './defaults.js';

const execFileAsync = promisify(execFile);
const REG_KEY = 'HKCU\\Software\\Webzen\\Mu\\Config';

const LAUNCHER_LANG_NAMES = {
  Eng: 'English',
  Spn: 'Spanish',
  Por: 'Portuguese',
};

export function resolutionRegistryValue(resolutionIndex) {
  const match = RESOLUTIONS.find((item) => item.index === Number(resolutionIndex));
  return match?.registry ?? Number(resolutionIndex);
}

async function regAdd(name, type, data) {
  await execFileAsync('reg', [
    'add',
    REG_KEY,
    '/v',
    name,
    '/t',
    type,
    '/d',
    String(data),
    '/f',
  ]);
}

export async function writeMuResolution(resolutionIndex) {
  if (process.platform !== 'win32') {
    return { ok: true, skipped: true, reason: 'NOT_WINDOWS' };
  }

  const value = resolutionRegistryValue(resolutionIndex);
  try {
    await regAdd('Resolution', 'REG_DWORD', value);
    return { ok: true, value };
  } catch (error) {
    return { ok: false, message: error.message, value };
  }
}

/**
 * Keep Webzen language keys in sync:
 * - LangSelection = Eng|Spn|Por (Data\\Local folder)
 * - LauncherLang = English|Spanish|Portuguese
 */
export async function writeMuLanguage(selection) {
  if (process.platform !== 'win32') {
    return { ok: true, skipped: true, reason: 'NOT_WINDOWS' };
  }

  const value = String(selection || '').trim();
  if (!value || /^kor/i.test(value)) {
    return { ok: false, message: 'Refusing to write Korean LangSelection' };
  }

  const launcherLang =
    LAUNCHER_LANG_NAMES[value] ||
    LAUNCHER_LANG_NAMES[
      Object.keys(LAUNCHER_LANG_NAMES).find(
        (key) => key.toLowerCase() === value.toLowerCase(),
      )
    ] ||
    value;

  try {
    await regAdd('LangSelection', 'REG_SZ', value);
    await regAdd('LauncherLang', 'REG_SZ', launcherLang);
    return { ok: true, value, launcherLang };
  } catch (error) {
    return { ok: false, message: error.message, value, launcherLang };
  }
}

export async function readMuResolution() {
  if (process.platform !== 'win32') return null;
  try {
    const { stdout } = await execFileAsync('reg', [
      'query',
      REG_KEY,
      '/v',
      'Resolution',
    ]);
    const match = stdout.match(/Resolution\s+REG_DWORD\s+0x([0-9a-fA-F]+)/);
    if (!match) return null;
    return Number.parseInt(match[1], 16);
  } catch {
    return null;
  }
}

export async function readMuLanguage() {
  if (process.platform !== 'win32') return null;
  try {
    const { stdout } = await execFileAsync('reg', [
      'query',
      REG_KEY,
      '/v',
      'LangSelection',
    ]);
    const match = stdout.match(/LangSelection\s+REG_SZ\s+(\S+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
