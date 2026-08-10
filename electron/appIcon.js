import { app, nativeImage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function candidatePaths() {
  const roots = [
    path.join(__dirname, '..'),
    app.isPackaged ? process.resourcesPath : null,
    app.isPackaged ? path.dirname(process.execPath) : null,
    app.isPackaged ? app.getAppPath() : null,
  ].filter(Boolean);

  const relative = [
    ['build', 'icon.ico'],
    ['build', 'icon.png'],
    ['public', 'assets', 'icon.ico'],
    ['public', 'assets', 'favicon.ico'],
    ['public', 'assets', 'favicon.png'],
    ['assets', 'icon.ico'],
    ['icon.ico'],
  ];

  const paths = [];
  for (const root of roots) {
    for (const parts of relative) {
      paths.push(path.join(root, ...parts));
    }
  }
  return paths;
}

export function getAppIconPath() {
  return candidatePaths().find((candidate) => fs.existsSync(candidate)) || undefined;
}

export function getAppIconImage(size) {
  const iconPath = getAppIconPath();
  if (!iconPath) return nativeImage.createEmpty();
  const image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) return image;
  if (!size) return image;
  return image.resize({ width: size, height: size });
}
