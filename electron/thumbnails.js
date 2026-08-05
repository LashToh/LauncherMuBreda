import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { ensureDir, getGameRoot, getLauncherDataDir } from './paths.js';

const execFileAsync = promisify(execFile);

function thumbsDir(gameRoot = getGameRoot()) {
  return path.join(getLauncherDataDir(gameRoot), 'thumbs');
}

/**
 * Capture visible window contents via screen BitBlt (works with DirectX MU clients).
 * Crops a centered square where the character usually is.
 * Returns JSON: { ok: true } or { ok: false, reason }
 */
function captureScript(hwnd, outPath, size = 96) {
  const safeOut = outPath.replace(/'/g, "''");
  return `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MuThumb {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdcBlt, int nFlags);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out RECT pvAttribute, int cbAttribute);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
"@

$h = [IntPtr]${Number(hwnd)}
if (-not [MuThumb]::IsWindowVisible($h)) { @{ ok = $false; reason = 'hidden' } | ConvertTo-Json -Compress; return }
if ([MuThumb]::IsIconic($h)) { @{ ok = $false; reason = 'minimized' } | ConvertTo-Json -Compress; return }

$rect = New-Object MuThumb+RECT
# DWMWA_EXTENDED_FRAME_BOUNDS = 9 (better for DPI / shadows)
$dwm = [MuThumb]::DwmGetWindowAttribute($h, 9, [ref]$rect, [System.Runtime.InteropServices.Marshal]::SizeOf($rect))
if ($dwm -ne 0) { [void][MuThumb]::GetWindowRect($h, [ref]$rect) }

$winW = [Math]::Max(1, $rect.Right - $rect.Left)
$winH = [Math]::Max(1, $rect.Bottom - $rect.Top)

# Center crop biased a bit upward (character torso/head in MU)
$side = [int]([Math]::Min($winW, $winH) * 0.42)
if ($side -lt 64) { $side = [Math]::Min($winW, $winH) }
$cx = [int]($rect.Left + $winW / 2)
$cy = [int]($rect.Top + $winH * 0.42)
$srcX = [Math]::Max($rect.Left, $cx - [int]($side / 2))
$srcY = [Math]::Max($rect.Top, $cy - [int]($side / 2))
if ($srcX + $side -gt $rect.Right) { $srcX = $rect.Right - $side }
if ($srcY + $side -gt $rect.Bottom) { $srcY = $rect.Bottom - $side }

$size = ${Number(size)}
$thumb = New-Object System.Drawing.Bitmap $size, $size
$tg = [System.Drawing.Graphics]::FromImage($thumb)
$tg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$tg.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$tg.Clear([System.Drawing.Color]::FromArgb(18,18,18))

$ok = $false
try {
  # Screen capture — works for DirectX games when the window is visible
  $tg.CopyFromScreen($srcX, $srcY, 0, 0, (New-Object System.Drawing.Size $side, $side))
  $ok = $true
} catch {
  $ok = $false
}

# Fallback PrintWindow if screen copy failed
if (-not $ok) {
  $bmp = New-Object System.Drawing.Bitmap $winW, $winH
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $hdc = $g.GetHdc()
  [void][MuThumb]::PrintWindow($h, $hdc, 2)
  $g.ReleaseHdc($hdc)
  $g.Dispose()
  $tg.DrawImage($bmp, (New-Object System.Drawing.Rectangle 0,0,$size,$size), (New-Object System.Drawing.Rectangle ($srcX-$rect.Left), ($srcY-$rect.Top), $side, $side), [System.Drawing.GraphicsUnit]::Pixel)
  $bmp.Dispose()
}

# Reject near-black frames (failed DX capture)
$sample = 0
$dark = 0
for ($i = 0; $i -lt 36; $i++) {
  $px = ($i % 6) * [int]($size / 6) + 2
  $py = [int]($i / 6) * [int]($size / 6) + 2
  if ($px -ge $size) { $px = $size - 1 }
  if ($py -ge $size) { $py = $size - 1 }
  $c = $thumb.GetPixel($px, $py)
  $sample++
  if (($c.R + $c.G + $c.B) -lt 45) { $dark++ }
}
$tg.Dispose()

if ($sample -gt 0 -and ($dark / $sample) -gt 0.85) {
  $thumb.Dispose()
  @{ ok = $false; reason = 'too-dark' } | ConvertTo-Json -Compress
  return
}

$thumb.Save('${safeOut}', [System.Drawing.Imaging.ImageFormat]::Png)
$thumb.Dispose()
@{ ok = $true } | ConvertTo-Json -Compress
`;
}

async function runPowerShell(script) {
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { windowsHide: true, maxBuffer: 2 * 1024 * 1024 },
  );
  return stdout.trim();
}

function fileUrl(filePath) {
  const stamp = fs.statSync(filePath).mtimeMs;
  return `file://${filePath.replace(/\\/g, '/')}?t=${stamp}`;
}

export async function captureClientThumbnail(
  hwnd,
  gameRoot = getGameRoot(),
  { maxAgeMs = 2000 } = {},
) {
  if (process.platform !== 'win32') return null;
  const dir = thumbsDir(gameRoot);
  ensureDir(dir);
  const filePath = path.join(dir, `${hwnd}.png`);

  const freshEnough =
    fs.existsSync(filePath) && Date.now() - fs.statSync(filePath).mtimeMs < maxAgeMs;

  if (freshEnough) return fileUrl(filePath);

  try {
    const raw = await runPowerShell(captureScript(hwnd, filePath, 96));
    let parsed = null;
    try {
      parsed = JSON.parse(raw.split('\n').filter(Boolean).pop() || '{}');
    } catch {
      parsed = null;
    }

    if (parsed?.ok && fs.existsSync(filePath)) {
      return fileUrl(filePath);
    }

    // Remove failed/black frames so UI falls back to initials
    if (fs.existsSync(filePath) && parsed && parsed.ok === false) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }

  return fs.existsSync(filePath) ? fileUrl(filePath) : null;
}

export async function attachThumbnails(clients, gameRoot = getGameRoot()) {
  const enriched = [];
  // Capture in parallel (bounded) for snappier dock updates
  const chunkSize = 2;
  for (let i = 0; i < clients.length; i += chunkSize) {
    const chunk = clients.slice(i, i + chunkSize);
    const thumbs = await Promise.all(
      chunk.map((client) => captureClientThumbnail(client.hwnd, gameRoot)),
    );
    chunk.forEach((client, idx) => {
      enriched.push({ ...client, thumbUrl: thumbs[idx] });
    });
  }
  return enriched;
}
