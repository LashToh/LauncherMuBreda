import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const src = path.join(root, 'stub', 'mubreda-launcher-stub.c');
const out = path.join(root, 'build', 'MuBreda-Launcher.exe');

fs.mkdirSync(path.dirname(out), { recursive: true });

const mingw = 'x86_64-w64-mingw32-gcc';
const windres = 'x86_64-w64-mingw32-windres';
const icon = path.join(root, 'build', 'icon.ico');
const args = ['-O2', '-s', '-mwindows', src, '-o', out, '-lshell32'];

try {
  if (fs.existsSync(icon)) {
    const rcPath = path.join(root, 'build', 'stub.rc');
    const objPath = path.join(root, 'build', 'stub-icon.o');
    fs.writeFileSync(rcPath, `IDI_ICON1 ICON "icon.ico"\n`);
    execFileSync(windres, [rcPath, '-O', 'coff', '-o', objPath], {
      stdio: 'inherit',
      cwd: path.join(root, 'build'),
    });
    args.splice(args.length - 2, 0, objPath);
  }
  execFileSync(mingw, args, { stdio: 'inherit' });
  console.log('Stub built:', out);
} catch {
  if (fs.existsSync(out)) {
    console.warn('MinGW not available; using existing build/MuBreda-Launcher.exe');
  } else {
    console.error('Cannot build stub and no prebuilt build/MuBreda-Launcher.exe found.');
    process.exit(1);
  }
}
