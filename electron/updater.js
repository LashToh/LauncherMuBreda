import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { loadLauncherConfig, loadLocalVersion, saveLocalVersion } from './configStore.js';
import { ensureDir, getGameRoot } from './paths.js';

async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function unwrapPayload(json) {
  if (json && typeof json === 'object' && 'data' in json) return json.data;
  return json;
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

async function downloadFile(url, destPath, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed HTTP ${res.status}`);

  ensureDir(path.dirname(destPath));
  const total = Number(res.headers.get('content-length') || 0);
  const chunks = [];
  let received = 0;

  if (!res.body) {
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(destPath, buf);
    onProgress?.({ received: buf.length, total: buf.length });
    return;
  }

  for await (const chunk of res.body) {
    const buf = Buffer.from(chunk);
    chunks.push(buf);
    received += buf.length;
    onProgress?.({ received, total });
  }

  fs.writeFileSync(destPath, Buffer.concat(chunks));
}

export async function checkForUpdates(gameRoot = getGameRoot()) {
  const config = loadLauncherConfig(gameRoot);
  const local = loadLocalVersion(gameRoot);

  if (!config.apiUrl) {
    return {
      ok: true,
      available: false,
      skipped: true,
      reason: 'NO_API_URL',
      localVersion: local.version,
      allowPlay: true,
    };
  }

  const manifestUrl = `${config.apiUrl.replace(/\/$/, '')}/api/launcher/manifest`;

  try {
    const json = await fetchJson(manifestUrl);
    const manifest = unwrapPayload(json) || {};
    const remoteVersion = manifest.version || '0.0.0';
    const files = Array.isArray(manifest.files) ? manifest.files : [];
    const available = remoteVersion !== local.version && files.length > 0;

    return {
      ok: true,
      available,
      skipped: false,
      localVersion: local.version,
      remoteVersion,
      changelog: manifest.changelog || '',
      mandatory: Boolean(manifest.mandatory),
      files,
      allowPlay: config.allowPlayWithoutUpdate !== false,
    };
  } catch (error) {
    return {
      ok: false,
      available: false,
      skipped: true,
      reason: 'API_UNAVAILABLE',
      message: error.message,
      localVersion: local.version,
      allowPlay: true,
    };
  }
}

export async function applyUpdate({ onProgress } = {}, gameRoot = getGameRoot()) {
  const check = await checkForUpdates(gameRoot);
  if (!check.ok) return check;
  if (!check.available) {
    return { ...check, applied: false };
  }

  const files = check.files;
  let done = 0;

  for (const file of files) {
    if (!file?.path || !file?.url) {
      throw new Error('Manifest file entry missing path/url');
    }

    const root = path.resolve(gameRoot);
    const dest = path.resolve(root, file.path.replace(/^[/\\]+/, ''));
    if (dest !== root && !dest.startsWith(root + path.sep)) {
      throw new Error(`Invalid update path: ${file.path}`);
    }

    await downloadFile(file.url, dest, (progress) => {
      onProgress?.({
        phase: 'download',
        file: file.path,
        fileIndex: done,
        fileCount: files.length,
        ...progress,
      });
    });

    if (file.sha256) {
      const digest = sha256File(dest);
      if (digest.toLowerCase() !== String(file.sha256).toLowerCase()) {
        throw new Error(`Hash mismatch for ${file.path}`);
      }
    }

    done += 1;
    onProgress?.({
      phase: 'file-done',
      file: file.path,
      fileIndex: done,
      fileCount: files.length,
    });
  }

  saveLocalVersion(
    {
      version: check.remoteVersion,
      updatedAt: new Date().toISOString(),
      changelog: check.changelog || '',
    },
    gameRoot,
  );

  return {
    ok: true,
    applied: true,
    remoteVersion: check.remoteVersion,
    changelog: check.changelog || '',
    allowPlay: true,
  };
}
