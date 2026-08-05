import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { applyClientOrder, loadDockState } from './dockStore.js';
import { attachThumbnails } from './thumbnails.js';
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
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}
"@

$targets = @('main','Main','MU','mu')
$results = New-Object System.Collections.Generic.List[object]

[MuWin]::EnumWindows({
  param($hWnd, $lParam)
  if (-not [MuWin]::IsWindowVisible($hWnd)) { return $true }
  $sb = New-Object System.Text.StringBuilder 512
  [void][MuWin]::GetWindowText($hWnd, $sb, $sb.Capacity)
  $title = $sb.ToString()
  if ([string]::IsNullOrWhiteSpace($title)) { return $true }

  $procId = 0
  [void][MuWin]::GetWindowThreadProcessId($hWnd, [ref]$procId)
  try { $proc = Get-Process -Id $procId -ErrorAction Stop } catch { return $true }
  $name = $proc.ProcessName
  if ($targets -notcontains $name) { return $true }

  $results.Add([pscustomobject]@{
    hwnd = [int64]$hWnd
    pid = [int]$procId
    title = $title
    processName = $name
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

export async function listMuClients({ withThumbs = true } = {}) {
  if (process.platform !== 'win32') {
    return { ok: true, clients: [], skipped: true };
  }

  try {
    const raw = await runPowerShell(LIST_SCRIPT);
    if (!raw) return { ok: true, clients: [] };
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    let clients = list
      .filter((item) => item && item.hwnd)
      .map((item, index) => ({
        hwnd: String(item.hwnd),
        pid: Number(item.pid),
        title: String(item.title || `Client ${index + 1}`),
        processName: String(item.processName || 'main'),
        minimized: Boolean(item.minimized),
        label: shortenTitle(String(item.title || `Client ${index + 1}`)),
        initial: initialFromTitle(String(item.title || `C${index + 1}`)),
        color: colorFromId(Number(item.pid) || index),
      }));

    const dock = loadDockState(getGameRoot());
    clients = applyClientOrder(clients, dock.order || []);

    if (withThumbs) {
      clients = await attachThumbnails(clients, getGameRoot());
    }

    return { ok: true, clients };
  } catch (error) {
    return { ok: false, clients: [], message: error.message };
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

function shortenTitle(title) {
  const cleaned = title.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= 14) return cleaned;
  return `${cleaned.slice(0, 12)}…`;
}

function initialFromTitle(title) {
  const cleaned = title.replace(/[^a-zA-Z0-9À-ÿ]/g, '').trim();
  return (cleaned[0] || 'M').toUpperCase();
}

function colorFromId(id) {
  const palette = ['#c61717', '#7a4bff', '#2f9e44', '#d97706', '#0891b2', '#db2777'];
  return palette[Math.abs(id) % palette.length];
}
