import fs from 'node:fs';
import path from 'node:path';
import { setGameLanguage } from './gameSettings.js';
import { getGameRoot } from './paths.js';

/**
 * Root Local skill tables that MuDevs Main.exe loads.
 * Season 21 packs ship updated copies under Data\\Local\\Eng\\;
 * an outdated Data\\Local\\skill.bmd (e.g. 2022) triggers
 * "Skill(Kor) ... 잘못된 값" even when LangSelection=Eng.
 */
const SKILL_FILE_ALIASES = [
  {
    rootNames: ['skill.bmd', 'Skill.bmd'],
    langNames: ['Skill.bmd', 'skill.bmd'],
  },
  {
    rootNames: ['SkillTooltipText.bmd', 'skilltooltiptext.bmd'],
    langNames: ['SkillTooltipText.bmd', 'skilltooltiptext.bmd'],
  },
  {
    rootNames: ['masterskilltreedata.bmd', 'MasterSkillTreeData.bmd'],
    langNames: ['MasterSkillTreeData.bmd', 'masterskilltreedata.bmd'],
  },
  {
    rootNames: ['masterskilltooltip.bmd', 'MasterSkillTooltip.bmd'],
    langNames: ['MasterSkillTooltip.bmd', 'masterskilltooltip.bmd'],
  },
  {
    rootNames: ['monsterskill.bmd', 'MonsterSkill.bmd'],
    langNames: ['MonsterSkill.bmd', 'monsterskill.bmd'],
  },
];

const PREFER_LANG_FOLDERS = ['Eng', 'ENG', 'Spn', 'SPN', 'Por', 'POR'];

function listFilesLowerMap(dir) {
  const map = new Map();
  if (!fs.existsSync(dir)) return map;
  try {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      try {
        if (fs.statSync(full).isFile()) {
          map.set(name.toLowerCase(), name);
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
  return map;
}

function findNamedFile(dir, candidates) {
  const map = listFilesLowerMap(dir);
  for (const candidate of candidates) {
    const real = map.get(String(candidate).toLowerCase());
    if (real) return path.join(dir, real);
  }
  return null;
}

function findLangSource(localDir, langNames) {
  for (const folder of PREFER_LANG_FOLDERS) {
    const langDir = path.join(localDir, folder);
    if (!fs.existsSync(langDir)) continue;
    const hit = findNamedFile(langDir, langNames);
    if (hit) return { folder, path: hit };
  }
  return null;
}

function shouldReplace(destPath, sourcePath) {
  if (!fs.existsSync(destPath)) return true;
  try {
    const dest = fs.statSync(destPath);
    const source = fs.statSync(sourcePath);
    if (source.size !== dest.size) return true;
    // Prefer newer language-pack copy (S21 Eng dated 2026 vs root 2022).
    if (source.mtimeMs > dest.mtimeMs + 1000) return true;
  } catch {
    return true;
  }
  return false;
}

function backupFile(localDir, destPath) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = path.join(localDir, '_mubreda_backup', stamp);
  fs.mkdirSync(backupDir, { recursive: true });
  const destName = path.basename(destPath);
  const backupPath = path.join(backupDir, destName);
  fs.copyFileSync(destPath, backupPath);
  return backupPath;
}

/**
 * Copy newer Eng/Spn/Por skill BMDs over outdated Data\\Local root files.
 */
export function repairSkillData(gameRoot = getGameRoot()) {
  const localDir = path.join(gameRoot, 'Data', 'Local');
  const result = {
    ok: true,
    localDir,
    copied: [],
    skipped: [],
    missing: [],
  };

  if (!fs.existsSync(localDir)) {
    result.ok = false;
    result.message = `No existe Data\\Local en:\n${gameRoot}`;
    return result;
  }

  for (const entry of SKILL_FILE_ALIASES) {
    const source = findLangSource(localDir, entry.langNames);
    if (!source) {
      result.missing.push(entry.rootNames[0]);
      continue;
    }

    const destPath =
      findNamedFile(localDir, entry.rootNames) ||
      path.join(localDir, entry.rootNames[0]);

    if (!shouldReplace(destPath, source.path)) {
      result.skipped.push({
        file: path.basename(destPath),
        reason: 'up-to-date',
        source: source.path,
      });
      continue;
    }

    try {
      let backup = null;
      if (fs.existsSync(destPath)) {
        backup = backupFile(localDir, destPath);
      }
      fs.copyFileSync(source.path, destPath);
      result.copied.push({
        file: path.basename(destPath),
        from: source.path,
        folder: source.folder,
        backup,
      });
    } catch (error) {
      result.ok = false;
      result.message = error?.message || String(error);
      result.failed = {
        file: path.basename(destPath),
        from: source.path,
        error: result.message,
      };
      return result;
    }
  }

  if (result.copied.length === 0 && result.missing.includes('skill.bmd')) {
    result.ok = false;
    result.message =
      'No encontré Skill.bmd en Data\\Local\\Eng (ni Spn/Por). ' +
      'Sin ese archivo el cliente falla con Skill(Kor).';
  }

  return result;
}

/**
 * Repair skill tables + force client locale to English (Eng / Language:1).
 * Needed so Main.exe loads Eng scripts with matching S21 skill data.
 */
export async function prepareEnglishClient(gameRoot = getGameRoot()) {
  const skill = repairSkillData(gameRoot);
  const language = await setGameLanguage('en', gameRoot);

  const ok = skill.ok !== false && language.ok !== false;
  return {
    ok,
    skill,
    language,
    message: !ok
      ? skill.message || language.message || 'No se pudo preparar el cliente en inglés.'
      : skill.copied.length
        ? `Skill data updated (${skill.copied.length} file(s)) and language set to Eng.`
        : 'English locale ready (skill data already up to date).',
  };
}
