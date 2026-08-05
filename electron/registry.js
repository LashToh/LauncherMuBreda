import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { RESOLUTIONS } from './defaults.js';

const execFileAsync = promisify(execFile);
const REG_KEY = 'HKCU\\Software\\Webzen\\Mu\\Config';

export function resolutionRegistryValue(resolutionIndex) {
  const match = RESOLUTIONS.find((item) => item.index === Number(resolutionIndex));
  return match?.registry ?? Number(resolutionIndex);
}

export async function writeMuResolution(resolutionIndex) {
  if (process.platform !== 'win32') {
    return { ok: true, skipped: true, reason: 'NOT_WINDOWS' };
  }

  const value = resolutionRegistryValue(resolutionIndex);
  try {
    await execFileAsync('reg', [
      'add',
      REG_KEY,
      '/v',
      'Resolution',
      '/t',
      'REG_DWORD',
      '/d',
      String(value),
      '/f',
    ]);
    return { ok: true, value };
  } catch (error) {
    return { ok: false, message: error.message, value };
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
