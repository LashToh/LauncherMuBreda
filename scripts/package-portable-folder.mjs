import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const releaseDir = path.join(root, 'release');
const unpacked = path.join(releaseDir, 'win-unpacked');
const dropinDir = path.join(releaseDir, 'client-dropin');
const runtimeDir = path.join(dropinDir, 'MuBreda-Launcher');
const stubSrc = path.join(root, 'build', 'MuBreda-Launcher.exe');

if (!fs.existsSync(unpacked)) {
  console.error('Missing release/win-unpacked. Run electron-builder --win dir first.');
  process.exit(1);
}

// Ensure stub exists (prebuilt in repo, or rebuild if MinGW is present).
try {
  execFileSync(process.execPath, [path.join(root, 'scripts', 'build-stub.mjs')], {
    stdio: 'inherit',
  });
} catch {
  // build-stub exits 0 when prebuilt exists
}

if (!fs.existsSync(stubSrc)) {
  console.error('Missing build/MuBreda-Launcher.exe stub.');
  process.exit(1);
}

fs.rmSync(dropinDir, { recursive: true, force: true });
fs.mkdirSync(runtimeDir, { recursive: true });

// Runtime lives in MuBreda-Launcher\; rename Electron exe to *-App.exe
fs.cpSync(unpacked, runtimeDir, { recursive: true });

const appExeNames = [
  'MuBreda-Launcher-App.exe',
  'MuBreda-Launcher.exe',
  'MU Breda Launcher.exe',
];
let foundApp = null;
for (const name of fs.readdirSync(runtimeDir)) {
  if (name.toLowerCase().endsWith('.exe')) {
    foundApp = name;
    break;
  }
}
if (!foundApp) {
  console.error('No Electron exe found inside win-unpacked.');
  process.exit(1);
}
const appTarget = path.join(runtimeDir, 'MuBreda-Launcher-App.exe');
const appSource = path.join(runtimeDir, foundApp);
if (path.resolve(appSource) !== path.resolve(appTarget)) {
  fs.renameSync(appSource, appTarget);
}

// Stub stays loose next to Main.exe
fs.copyFileSync(stubSrc, path.join(dropinDir, 'MuBreda-Launcher.exe'));

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const zipName = `MuBreda-Launcher-${pkg.version}-client-dropin.zip`;
const zipPath = path.join(releaseDir, zipName);
if (fs.existsSync(zipPath)) fs.rmSync(zipPath);

try {
  if (process.platform === 'win32') {
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Compress-Archive -Path '${dropinDir.replace(/'/g, "''")}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`,
      ],
      { stdio: 'inherit' },
    );
  } else {
    execFileSync('tar', ['-a', '-cf', zipPath, '-C', dropinDir, '.'], {
      stdio: 'inherit',
    });
  }
} catch (error) {
  console.warn('Zip step failed (folder still available):', error.message);
}

console.log('Client drop-in ready: release/client-dropin/');
console.log('  MuBreda-Launcher.exe          <- copy next to Main.exe');
console.log('  MuBreda-Launcher\\             <- copy this folder next to Main.exe');
if (fs.existsSync(zipPath)) console.log(`Zip: release/${zipName}`);
