/** WebEngine-style static class avatars (group → image file). */
export const CLASS_ICONS = {
  0: { key: 'dw', file: 'dw.jpg', label: 'Dark Wizard' },
  7: { key: 'dk', file: 'dk.jpg', label: 'Dark Knight' },
  14: { key: 'elf', file: 'elf.jpg', label: 'Fairy Elf' },
  21: { key: 'mg', file: 'mg.jpg', label: 'Magic Gladiator' },
  28: { key: 'dl', file: 'dl.jpg', label: 'Dark Lord' },
  35: { key: 'sum', file: 'sum.jpg', label: 'Summoner' },
  42: { key: 'rf', file: 'rf.jpg', label: 'Rage Fighter' },
  49: { key: 'gl', file: 'gl.jpg', label: 'Grow Lancer' },
  56: { key: 'rw', file: 'rw.jpg', label: 'Rune Wizard' },
  63: { key: 'sl', file: 'sl.jpg', label: 'Slayer' },
  70: { key: 'gc', file: 'gc.jpg', label: 'Gun Crusher' },
  77: { key: 'liw', file: 'liw.jpg', label: 'Light Wizard' },
  84: { key: 'lem', file: 'lem.jpg', label: 'Lemuria Mage' },
  91: { key: 'ik', file: 'ik.jpg', label: 'Illusion Knight' },
  98: { key: 'alc', file: 'alc.jpg', label: 'Alchemist' },
  105: { key: 'cru', file: 'cru.jpg', label: 'Crusader' },
};

export const CLASS_PICK_LIST = Object.entries(CLASS_ICONS).map(([group, meta]) => ({
  group: Number(group),
  ...meta,
}));

/** Exact classId → group icon (Season 21 map, aligned with CMSMuBreda). */
const CLASS_ID_TO_GROUP = {
  0: 0, 1: 0, 2: 0, 3: 0,
  7: 7, 8: 7, 9: 7, 10: 7,
  14: 14, 15: 14, 16: 14, 17: 14,
  21: 21, 22: 21, 23: 21,
  28: 28, 29: 28, 30: 28,
  35: 35, 36: 35, 37: 35, 38: 35,
  42: 42, 43: 42, 44: 42,
  49: 49, 50: 49, 51: 49,
  56: 56, 57: 56, 58: 56,
  63: 63, 64: 63, 65: 63,
  70: 70, 71: 70, 72: 70,
  77: 77, 78: 77, 79: 77,
  84: 84, 85: 84, 86: 84,
  91: 91, 92: 91, 93: 91,
  98: 98, 99: 98, 100: 98,
  105: 105, 106: 105, 107: 105,
};

const TITLE_CLASS_HINTS = [
  [/magic\s*gladiator|\bm\s*g\b|\bmg\b|duel\s*master/i, 21],
  [/summoner|bloody\s*summoner|dimension/i, 35],
  [/dark\s*knight|blade\s*knight|blade\s*master|dragon\s*knight|\bdk\b/i, 7],
  [/dark\s*wizard|soul\s*master|grand\s*master|\bdw\b/i, 0],
  [/fairy\s*elf|muse\s*elf|high\s*elf|\belf\b/i, 14],
  [/dark\s*lord|lord\s*emperor|\bdl\b/i, 28],
  [/rage\s*fighter|fist\s*master|\brf\b/i, 42],
  [/grow\s*lancer|mirage\s*lancer|\bgl\b/i, 49],
  [/rune\s*wizard|\brw\b/i, 56],
  [/slayer/i, 63],
  [/gun\s*crusher|\bgc\b/i, 70],
  [/light\s*wizard|\bliw\b/i, 77],
  [/lemuria|\blem\b/i, 84],
  [/illusion\s*knight|\bik\b/i, 91],
  [/alchemist|\balc\b/i, 98],
  [/crusader|paladin/i, 105],
];

export function iconForGroup(group) {
  const meta = CLASS_ICONS[Number(group)] || null;
  if (!meta) {
    return { key: 'avatar', file: 'avatar.jpg', label: 'Unknown', group: -1 };
  }
  return { ...meta, group: Number(group) };
}

export function iconForClassId(classId) {
  const group = CLASS_ID_TO_GROUP[Number(classId)];
  if (group == null) return iconForGroup(-1);
  return iconForGroup(group);
}

export function detectClassGroupFromTitle(title = '') {
  const classField = title.match(/class\s*:\s*([^|]+)/i);
  const haystack = classField ? classField[1] : title;
  for (const [pattern, group] of TITLE_CLASS_HINTS) {
    if (pattern.test(haystack)) return group;
  }
  return null;
}

export function classIconUrl(fileName) {
  return `./assets/classes/${fileName || 'avatar.jpg'}`;
}
