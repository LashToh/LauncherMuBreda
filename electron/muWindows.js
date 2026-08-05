import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { loadLauncherConfig } from './configStore.js';
import { resolveClientAvatar } from './classLookup.js';
import { applyClientOrder, loadDockState } from './dockStore.js';
import { getGameRoot } from './paths.js';

const execFileAsync = promisify(execFile);

const LIST_SCRIPT = `
Add-Type @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class MuWin {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}
"@

$targets = @('main','Main')
$results = New-Object System.Collections.Generic.List[object]

[MuWin]::EnumWindows({
  param($hWnd, $lParam)
  if (-not [MuWin]::IsWindowVisible($hWnd)) { return $true }
  $sb = New-Object System.Text.StringBuilder 512
  [void][MuWin]::GetWindowText($hWnd, $sb, $sb.Capacity)
  $title = $sb.ToString()
  if ([string]::IsNullOrWhiteSpace($title)) { return $true }

  $cb = New-Object System.Text.StringBuilder 256
  [void][MuWin]::GetClassName($hWnd, $cb, $cb.Capacity)
  $className = $cb.ToString()

  $procId = 0
  [void][MuWin]::GetWindowThreadProcessId($hWnd, [ref]$procId)
  try { $proc = Get-Process -Id $procId -ErrorAction Stop } catch { return $true }
  $name = $proc.ProcessName
  if ($targets -notcontains $name) { return $true }

  $exePath = $null
  try { $exePath = $proc.Path } catch { $exePath = $null }

  $results.Add([pscustomobject]@{
    hwnd = [int64]$hWnd
    pid = [int]$procId
    title = $title
    className = $className
    processName = $name
    exePath = $exePath
    minimized = [bool][MuWin]::IsIconic($hWnd)
  }) | Out-Null
  return $true
}, [IntPtr]::Zero) | Out-Null

$results | ConvertTo-Json -Compress
`;

function focusScript(hwnd) {
  return `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MuFocus {
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}
"@
$h = [IntPtr]${Number(hwnd)}
if ([MuFocus]::IsIconic($h)) { [void][MuFocus]::ShowWindow($h, 9) }
else { [void][MuFocus]::ShowWindow($h, 5) }
[void][MuFocus]::SetForegroundWindow($h)
`;
}

function minimizeAllScript(hwnds) {
  const list = hwnds.map((h) => Number(h)).filter(Boolean).join(',');
  return `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MuMin {
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
@(${list}) | ForEach-Object { [void][MuMin]::ShowWindow([IntPtr]$_, 6) }
`;
}

function restoreAllScript(hwnds) {
  const list = hwnds.map((h) => Number(h)).filter(Boolean).join(',');
  return `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MuRestore {
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
@(${list}) | ForEach-Object {
  $h = [IntPtr]$_
  [void][MuRestore]::ShowWindow($h, 9)
  [void][MuRestore]::SetForegroundWindow($h)
}
`;
}

async function runPowerShell(script) {
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { windowsHide: true, maxBuffer: 1024 * 1024 },
  );
  return stdout.trim();
}

function normalizePath(value = '') {
  return String(value).replace(/\//g, '\\').toLowerCase().replace(/\\+$/, '');
}

function isUnderGameRoot(exePath, gameRoot) {
  if (!exePath || !gameRoot) return false;
  const root = normalizePath(gameRoot);
  const exe = normalizePath(exePath);
  const dir = normalizePath(path.dirname(exePath));
  return exe === root || dir === root || exe.startsWith(`${root}\\`) || dir.startsWith(`${root}\\`);
}

function titleScore(title = '') {
  let score = title.length;
  if (/name\s*:/i.test(title)) score += 100;
  if (/level\s*:/i.test(title)) score += 20;
  if (/breda/i.test(title)) score += 50;
  if (/argmus/i.test(title)) score -= 200;
  return score;
}

function dedupeByPid(items) {
  const best = new Map();
  for (const item of items) {
    const prev = best.get(item.pid);
    if (!prev || titleScore(item.title) > titleScore(prev.title)) {
      best.set(item.pid, item);
    }
  }
  return [...best.values()];
}

function gameRootLooksValid(gameRoot) {
  if (!gameRoot || !fs.existsSync(gameRoot)) return false;
  return [
    'main.exe',
    'StartGame.exe',
    '1 - StartGame.exe',
  ].some((name) => fs.existsSync(path.join(gameRoot, name)));
}

function matchesFilters(item, config, gameRoot) {
  const title = String(item.title || '');
  const exePath = String(item.exePath || '');
  const haystack = `${title} ${exePath}`.toLowerCase();

  // Skip tiny helper/tool windows
  if (title.length < 2) return false;
  if (/^(msctfime|default ime|gdi\+)/i.test(title)) return false;

  const exclude = [
    'argmus',
    ...(config.clientTitleExclude || []).map((v) => String(v).toLowerCase()),
  ];
  if (exclude.some((token) => token && haystack.includes(token))) return false;

  const include = (config.clientTitleInclude || [])
    .map((v) => String(v).toLowerCase())
    .filter(Boolean);
  if (include.length && !include.some((token) => haystack.includes(token))) {
    return false;
  }

  // Preferred: only main.exe from THIS Breda client folder
  if (gameRootLooksValid(gameRoot)) {
    return isUnderGameRoot(exePath, gameRoot);
  }

  // Fallback while developing outside the client folder:
  // keep only paths/titles that look like MU Breda.
  return /breda/i.test(haystack);
}

export async function listMuClients() {
  if (process.platform !== 'win32') {
    return { ok: true, clients: [], skipped: true };
  }

  const gameRoot = getGameRoot();
  const config = loadLauncherConfig(gameRoot);

  try {
    const raw = await runPowerShell(LIST_SCRIPT);
    if (!raw) return { ok: true, clients: [] };
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [parsed];

    const filtered = dedupeByPid(
      list.filter((item) => item && item.hwnd && matchesFilters(item, config, gameRoot)),
    );

    let clients = filtered.map((item, index) => ({
      hwnd: String(item.hwnd),
      pid: Number(item.pid),
      title: String(item.title || `Client ${index + 1}`),
      processName: String(item.processName || 'main'),
      exePath: String(item.exePath || ''),
      minimized: Boolean(item.minimized),
      label: characterLabel(String(item.title || `Client ${index + 1}`)),
      initial: initialFromTitle(String(item.title || `C${index + 1}`)),
      color: colorFromId(Number(item.pid) || index),
    }));

    const dock = loadDockState(gameRoot);
    clients = applyClientOrder(clients, dock.order || []);

    // WebEngine-style class avatars (no live screenshots)
    clients = await Promise.all(
      clients.map(async (client) => {
        const avatar = await resolveClientAvatar(client, gameRoot);
        return { ...client, ...avatar, thumbUrl: null };
      }),
    );

    return { ok: true, clients, gameRoot };
  } catch (error) {
    return { ok: false, clients: [], message: error.message, gameRoot };
  }
}

export async function focusMuClient(hwnd) {
  if (process.platform !== 'win32') return { ok: false, message: 'Windows only' };
  try {
    await runPowerShell(focusScript(hwnd));
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

export async function minimizeMuClients(hwnds = []) {
  if (process.platform !== 'win32') return { ok: false, message: 'Windows only' };
  if (!hwnds.length) return { ok: true };
  try {
    await runPowerShell(minimizeAllScript(hwnds));
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

export async function restoreMuClients(hwnds = []) {
  if (process.platform !== 'win32') return { ok: false, message: 'Windows only' };
  if (!hwnds.length) return { ok: true };
  try {
    await runPowerShell(restoreAllScript(hwnds));
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

function characterLabel(title) {
  const raw = String(title || '').replace(/\s+/g, ' ').trim();
  const patterns = [
    /name\s*:\s*([^|:]+)/i,
    /character\s*:\s*([^|:]+)/i,
    /char\s*:\s*([^|:]+)/i,
    /\|\|\s*([^|]+?)\s*\|\|/i,
    /-\s*([^-|]+)$/i,
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (!match) continue;
    const value = match[1].trim();
    if (value && !/^(mu|main|mubreda|breda)$/i.test(value)) return value;
  }

  // Prefer a token that doesn't look like the client/process name
  const parts = raw.split(/[|:\-–]/g).map((p) => p.trim()).filter(Boolean);
  const named = parts.find((p) => !/^(mu|main|mubreda|breda|argmus|name|level|resets)$/i.test(p));
  return named || shortenTitle(raw);
}

function shortenTitle(title) {
  const cleaned = title.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= 18) return cleaned;
  return `${cleaned.slice(0, 16)}…`;
}

function initialFromTitle(title) {
  const label = characterLabel(title);
  const cleaned = label.replace(/[^a-zA-Z0-9À-ÿ]/g, '').trim();
  if (!cleaned || /^(mu|main)$/i.test(cleaned)) return '•';
  return cleaned[0].toUpperCase();
}

function colorFromId(id) {
  const palette = ['#c61717', '#7a4bff', '#2f9e44', '#d97706', '#0891b2', '#db2777'];
  return palette[Math.abs(id) % palette.length];
}
