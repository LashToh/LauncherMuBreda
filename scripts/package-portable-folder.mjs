import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const releaseDir = path.join(root, 'release');
const unpacked = path.join(releaseDir, 'win-unpacked');
const folderName = 'MuBreda-Launcher';
const outFolder = path.join(releaseDir, folderName);

if (!fs.existsSync(unpacked)) {
  console.error('Missing release/win-unpacked. Run electron-builder --win dir first.');
  process.exit(1);
}

fs.rmSync(outFolder, { recursive: true, force: true });
fs.cpSync(unpacked, outFolder, { recursive: true });

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const zipName = `MuBreda-Launcher-${pkg.version}-client-files.zip`;
const zipPath = path.join(releaseDir, zipName);

if (fs.existsSync(zipPath)) fs.rmSync(zipPath);

// Zip the *contents* (not a nested folder) so extract lands next to Main.exe.
try {
  if (process.platform === 'win32') {
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Compress-Archive -Path '${outFolder.replace(/'/g, "''")}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`,
      ],
      { stdio: 'inherit' },
    );
  } else {
    execFileSync('tar', ['-a', '-cf', zipPath, '-C', outFolder, '.'], {
      stdio: 'inherit',
    });
  }
} catch (error) {
  console.warn('Zip step failed (folder still available):', error.message);
}

console.log(`Ready: release/${folderName}/`);
if (fs.existsSync(zipPath)) {
  console.log(`Zip ready: release/${zipName}`);
}
console.log(
  'Copy EVERYTHING inside release/MuBreda-Launcher/ into the client folder (same place as Main.exe).',
);
console.log('Then run MuBreda-Launcher.exe from that client folder.');
