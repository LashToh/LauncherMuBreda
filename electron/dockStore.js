import fs from 'node:fs';
import path from 'node:path';
import { ensureDir, getGameRoot, getLauncherDataDir } from './paths.js';

const DEFAULT_DOCK = {
  x: null,
  y: null,
  order: [], // character/title keys in preferred order
};

function dockPath(gameRoot = getGameRoot()) {
  return path.join(getLauncherDataDir(gameRoot), 'dock.json');
}

export function loadDockState(gameRoot = getGameRoot()) {
  ensureDir(getLauncherDataDir(gameRoot));
  const file = dockPath(gameRoot);
  try {
    if (!fs.existsSync(file)) return { ...DEFAULT_DOCK };
    return { ...DEFAULT_DOCK, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch {
    return { ...DEFAULT_DOCK };
  }
}

export function saveDockState(partial, gameRoot = getGameRoot()) {
  const next = { ...loadDockState(gameRoot), ...partial };
  ensureDir(getLauncherDataDir(gameRoot));
  fs.writeFileSync(dockPath(gameRoot), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

export function clientOrderKey(client) {
  return String(client.title || client.pid || client.hwnd)
    .trim()
    .toLowerCase();
}

export function applyClientOrder(clients, order = []) {
  if (!Array.isArray(clients) || !clients.length) return [];
  if (!order?.length) return clients;

  const rank = new Map(order.map((key, index) => [key, index]));
  return [...clients].sort((a, b) => {
    const ka = clientOrderKey(a);
    const kb = clientOrderKey(b);
    const ra = rank.has(ka) ? rank.get(ka) : Number.MAX_SAFE_INTEGER;
    const rb = rank.has(kb) ? rank.get(kb) : Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return Number(a.pid) - Number(b.pid);
  });
}
