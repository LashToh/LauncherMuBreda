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
 * Only screen-capture when the MU window is foreground (CopyFromScreen
 * otherwise grabs whatever is covering it — e.g. Cursor "launcher-11").
 * Otherwise try PrintWindow / window DC; reject black frames.
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
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdcBlt, int nFlags);
  [DllImport("user32.dll")] public static extern IntPtr GetWindowDC(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);
  [DllImport("gdi32.dll")] public static extern bool BitBlt(IntPtr hdcDest, int xDest, int yDest, int w, int h, IntPtr hdcSrc, int xSrc, int ySrc, int rop);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out RECT pvAttribute, int cbAttribute);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  public const int SRCCOPY = 0x00CC0020;
}
"@

function Test-GoodFrame([System.Drawing.Bitmap]$bmp) {
  $sample = 0; $dark = 0; $bright = 0
  $step = [Math]::Max(1, [int]($bmp.Width / 6))
  for ($y = 2; $y -lt $bmp.Height; $y += $step) {
    for ($x = 2; $x -lt $bmp.Width; $x += $step) {
      $c = $bmp.GetPixel($x, $y)
      $sum = $c.R + $c.G + $c.B
      $sample++
      if ($sum -lt 40) { $dark++ }
      if ($sum -gt 60) { $bright++ }
    }
  }
  if ($sample -eq 0) { return $false }
  if (($dark / $sample) -gt 0.88) { return $false }
  if ($bright -lt 3) { return $false }
  return $true
}

function Make-Thumb([System.Drawing.Bitmap]$src, [int]$size) {
  $thumb = New-Object System.Drawing.Bitmap $size, $size
  $tg = [System.Drawing.Graphics]::FromImage($thumb)
  $tg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $tg.DrawImage($src, 0, 0, $size, $size)
  $tg.Dispose()
  return $thumb
}

$h = [IntPtr]${Number(hwnd)}
if (-not [MuThumb]::IsWindowVisible($h)) { @{ ok=$false; reason='hidden' } | ConvertTo-Json -Compress; return }
if ([MuThumb]::IsIconic($h)) { @{ ok=$false; reason='minimized' } | ConvertTo-Json -Compress; return }

$rect = New-Object MuThumb+RECT
$dwm = [MuThumb]::DwmGetWindowAttribute($h, 9, [ref]$rect, [System.Runtime.InteropServices.Marshal]::SizeOf($rect))
if ($dwm -ne 0) { [void][MuThumb]::GetWindowRect($h, [ref]$rect) }

$winW = [Math]::Max(1, $rect.Right - $rect.Left)
$winH = [Math]::Max(1, $rect.Bottom - $rect.Top)
$side = [int]([Math]::Min($winW, $winH) * 0.45)
if ($side -lt 48) { $side = [Math]::Min($winW, $winH) }
$cx = [int]($rect.Left + $winW / 2)
$cy = [int]($rect.Top + $winH * 0.40)
$srcX = [Math]::Max($rect.Left, $cx - [int]($side/2))
$srcY = [Math]::Max($rect.Top, $cy - [int]($side/2))
if ($srcX + $side -gt $rect.Right) { $srcX = $rect.Right - $side }
if ($srcY + $side -gt $rect.Bottom) { $srcY = $rect.Bottom - $side }

$size = ${Number(size)}
$thumb = $null
$isForeground = ([MuThumb]::GetForegroundWindow() -eq $h)

# Screen capture ONLY if this MU window is in the foreground
if ($isForeground) {
  try {
    $tmp = New-Object System.Drawing.Bitmap $side, $side
    $g = [System.Drawing.Graphics]::FromImage($tmp)
    $g.CopyFromScreen($srcX, $srcY, 0, 0, (New-Object System.Drawing.Size $side, $side))
    $g.Dispose()
    if (Test-GoodFrame $tmp) { $thumb = Make-Thumb $tmp $size }
    $tmp.Dispose()
  } catch {}
}

# Window DC / PrintWindow (may be black on DirectX, but never steals other apps' pixels)
if ($null -eq $thumb) {
  try {
    $hdcSrc = [MuThumb]::GetWindowDC($h)
    if ($hdcSrc -ne [IntPtr]::Zero) {
      $tmp = New-Object System.Drawing.Bitmap $side, $side
      $g = [System.Drawing.Graphics]::FromImage($tmp)
      $hdcDst = $g.GetHdc()
      [void][MuThumb]::BitBlt($hdcDst, 0, 0, $side, $side, $hdcSrc, ($srcX-$rect.Left), ($srcY-$rect.Top), [MuThumb]::SRCCOPY)
      $g.ReleaseHdc($hdcDst)
      $g.Dispose()
      [void][MuThumb]::ReleaseDC($h, $hdcSrc)
      if (Test-GoodFrame $tmp) { $thumb = Make-Thumb $tmp $size }
      $tmp.Dispose()
    }
  } catch {}
}

if ($null -eq $thumb) {
  try {
    $bmp = New-Object System.Drawing.Bitmap $winW, $winH
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $hdc = $g.GetHdc()
    [void][MuThumb]::PrintWindow($h, $hdc, 2)
    $g.ReleaseHdc($hdc)
    $g.Dispose()
    $crop = $bmp.Clone((New-Object System.Drawing.Rectangle ($srcX-$rect.Left), ($srcY-$rect.Top), $side, $side), $bmp.PixelFormat)
    $bmp.Dispose()
    if (Test-GoodFrame $crop) { $thumb = Make-Thumb $crop $size }
    $crop.Dispose()
  } catch {}
}

if ($null -eq $thumb) {
  @{ ok = $false; reason = 'capture-failed'; foreground = $isForeground } | ConvertTo-Json -Compress
  return
}

$thumb.Save('${safeOut}', [System.Drawing.Imaging.ImageFormat]::Png)
$thumb.Dispose()
@{ ok = $true; foreground = $isForeground } | ConvertTo-Json -Compress
`;
}

async function runPowerShell(script) {
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
  );
  return stdout.trim();
}

export async function captureClientThumbnail(
  hwnd,
  gameRoot = getGameRoot(),
  { maxAgeMs = 1800 } = {},
) {
  if (process.platform !== 'win32') return null;
  const dir = thumbsDir(gameRoot);
  ensureDir(dir);
  const filePath = path.join(dir, `${hwnd}.png`);

  const freshEnough =
    fs.existsSync(filePath) && Date.now() - fs.statSync(filePath).mtimeMs < maxAgeMs;

  if (!freshEnough) {
    try {
      const raw = await runPowerShell(captureScript(hwnd, filePath, 96));
      const line = raw.split(/\r?\n/).filter(Boolean).pop() || '{}';
      let parsed = {};
      try {
        parsed = JSON.parse(line);
      } catch {
        parsed = {};
      }
      if (!parsed.ok && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }

  if (!fs.existsSync(filePath)) return null;
  const base64 = fs.readFileSync(filePath).toString('base64');
  return `data:image/png;base64,${base64}`;
}

export async function attachThumbnails(clients, gameRoot = getGameRoot()) {
  const enriched = [];
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
