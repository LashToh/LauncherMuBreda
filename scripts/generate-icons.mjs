import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const sources = [
  path.join(root, 'public', 'assets', 'apple-touch-icon.png'),
  path.join(root, 'public', 'assets', 'logo-b-mark.png'),
  path.join(root, 'public', 'assets', 'favicon.png'),
];

const source = sources.find((candidate) => fs.existsSync(candidate));
if (!source) {
  console.error('No source logo found for icon generation.');
  process.exit(1);
}

const sizes = [16, 24, 32, 48, 64, 128, 256, 512];
const buildDir = path.join(root, 'build');
const assetsDir = path.join(root, 'public', 'assets');
fs.mkdirSync(buildDir, { recursive: true });

const pngBuffers = [];
for (const size of sizes) {
  const buffer = await sharp(source)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    })
    .png()
    .toBuffer();
  pngBuffers.push(buffer);

  if (size === 256) {
    await fs.promises.writeFile(path.join(buildDir, 'icon.png'), buffer);
    await fs.promises.writeFile(path.join(assetsDir, 'favicon.png'), buffer);
  }
}

const ico = await pngToIco(pngBuffers.filter((_, index) => sizes[index] <= 256));
await fs.promises.writeFile(path.join(buildDir, 'icon.ico'), ico);
await fs.promises.writeFile(path.join(assetsDir, 'icon.ico'), ico);
await fs.promises.writeFile(path.join(assetsDir, 'favicon.ico'), ico);

console.log('Icons generated from', path.relative(root, source));
console.log('- build/icon.ico');
console.log('- build/icon.png');
console.log('- public/assets/icon.ico');
console.log('- public/assets/favicon.ico');
console.log('- public/assets/favicon.png');
