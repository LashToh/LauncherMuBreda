import { loadLauncherConfig } from './configStore.js';
import { getCachedCharacter, setCharacterClass } from './characterCache.js';
import {
  classIconUrl,
  detectClassGroupFromTitle,
  iconForClassId,
  iconForGroup,
} from './classIcons.js';
import { getGameRoot } from './paths.js';

let rankingsCache = { at: 0, items: [] };

async function fetchRankings(apiUrl) {
  if (!apiUrl) return [];
  const now = Date.now();
  if (now - rankingsCache.at < 60_000 && rankingsCache.items.length) {
    return rankingsCache.items;
  }

  const base = apiUrl.replace(/\/$/, '');
  const types = ['level', 'resets', 'master'];
  const collected = [];

  await Promise.all(
    types.map(async (type) => {
      try {
        const res = await fetch(`${base}/api/rankings/${type}?page=1&pageSize=100`, {
          signal: AbortSignal.timeout(4000),
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) return;
        const json = await res.json();
        const data = json?.data || json;
        const items = data?.items || data?.rows || data || [];
        if (Array.isArray(items)) collected.push(...items);
      } catch {
        // offline / API not ready
      }
    }),
  );

  rankingsCache = { at: now, items: collected };
  return collected;
}

function matchRankingItem(items, characterName) {
  const needle = String(characterName || '').trim().toLowerCase();
  if (!needle) return null;
  return (
    items.find((row) => {
      const name = String(row.name || row.Name || row.character || row.Character || '')
        .trim()
        .toLowerCase();
      return name === needle;
    }) || null
  );
}

/**
 * Resolve a WebEngine-style class avatar for a dock client.
 */
export async function resolveClientAvatar(client, gameRoot = getGameRoot()) {
  const name = client.label || client.title;
  const cached = getCachedCharacter(name, gameRoot);
  if (cached?.file) {
    return {
      classFile: cached.file,
      classLabel: cached.label,
      classGroup: cached.group,
      classIconUrl: classIconUrl(cached.file),
    };
  }

  const fromTitle = detectClassGroupFromTitle(client.title || '');
  if (fromTitle != null) {
    const icon = iconForGroup(fromTitle);
    setCharacterClass(name, { group: fromTitle }, gameRoot);
    return {
      classFile: icon.file,
      classLabel: icon.label,
      classGroup: icon.group,
      classIconUrl: classIconUrl(icon.file),
    };
  }

  const config = loadLauncherConfig(gameRoot);
  const rankings = await fetchRankings(config.apiUrl);
  const hit = matchRankingItem(rankings, name);
  if (hit) {
    const classId = hit.classId ?? hit.Class ?? hit.class ?? hit.class_id;
    if (classId != null && Number.isFinite(Number(classId))) {
      const icon = iconForClassId(classId);
      setCharacterClass(name, { classId }, gameRoot);
      return {
        classFile: icon.file,
        classLabel: icon.label,
        classGroup: icon.group,
        classIconUrl: classIconUrl(icon.file),
      };
    }
  }

  const fallback = iconForGroup(-1);
  return {
    classFile: fallback.file,
    classLabel: fallback.label,
    classGroup: fallback.group,
    classIconUrl: classIconUrl(fallback.file),
  };
}
