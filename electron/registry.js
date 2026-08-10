import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { RESOLUTIONS } from './defaults.js';

const execFileAsync = promisify(execFile);
const REG_KEY = 'HKCU\\Software\\Webzen\\Mu\\Config';

/** Webzen / MuDevs LangSelection string values. */
export const LANG_SELECTION = {
  en: 'Eng',
  es: 'Spn',
  pt: 'Por',
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

export async function writeMuLanguage(languageCode) {
  if (process.platform !== 'win32') {
    return { ok: true, skipped: true, reason: 'NOT_WINDOWS' };
  }

  const selection = LANG_SELECTION[languageCode];
  if (!selection) {
    return { ok: false, message: `Unsupported language: ${languageCode}` };
  }

  try {
    await regAdd('LangSelection', 'REG_SZ', selection);
    return { ok: true, value: selection };
  } catch (error) {
    return { ok: false, message: error.message, value: selection };
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
    if (!match) return null;
    const value = match[1];
    const entry = Object.entries(LANG_SELECTION).find(([, v]) => v === value);
    return entry ? entry[0] : null;
  } catch {
    return null;
  }
}
