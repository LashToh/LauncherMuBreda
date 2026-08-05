import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { ensureDir, getGameRoot, getLauncherDataDir } from './paths.js';

const execFileAsync = promisify(execFile);

function thumbsDir(gameRoot = getGameRoot()) {
  return path.join(getLauncherDataDir(gameRoot), 'thumbs');
}

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
  [DllImport("user32.dll")] public static extern IntPtr GetWindowDC(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);
  [DllImport("gdi32.dll")] public static extern bool BitBlt(IntPtr hdcDest, int xDest, int yDest, int w, int h, IntPtr hdcSrc, int xSrc, int ySrc, int rop);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out RECT pvAttribute, int cbAttribute);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  public const int SRCCOPY = 0x00CC0020;
}
"@

function Test-NotTooDark([System.Drawing.Bitmap]$bmp) {
  $sample = 0; $dark = 0
  $step = [Math]::Max(1, [int]($bmp.Width / 6))
  for ($y = 2; $y -lt $bmp.Height; $y += $step) {
    for ($x = 2; $x -lt $bmp.Width; $x += $step) {
      $c = $bmp.GetPixel($x, $y)
      $sample++
      if (($c.R + $c.G + $c.B) -lt 40) { $dark++ }
    }
  }
  if ($sample -eq 0) { return $false }
  return (($dark / $sample) -lt 0.9)
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

# 1) Screen BitBlt (best for DX when window is visible on a display)
try {
  $tmp = New-Object System.Drawing.Bitmap $side, $side
  $g = [System.Drawing.Graphics]::FromImage($tmp)
  $g.CopyFromScreen($srcX, $srcY, 0, 0, (New-Object System.Drawing.Size $side, $side))
  $g.Dispose()
  if (Test-NotTooDark $tmp) {
    $thumb = New-Object System.Drawing.Bitmap $size, $size
    $tg = [System.Drawing.Graphics]::FromImage($thumb)
    $tg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $tg.DrawImage($tmp, 0, 0, $size, $size)
    $tg.Dispose()
  }
  $tmp.Dispose()
} catch {}

# 2) Window DC BitBlt
if ($null -eq $thumb) {
  try {
    $hdcSrc = [MuThumb]::GetWindowDC($h)
    if ($hdcSrc -ne [IntPtr]::Zero) {
      $tmp = New-Object System.Drawing.Bitmap $side, $side
      $g = [System.Drawing.Graphics]::FromImage($tmp)
      $hdcDst = $g.GetHdc()
      $localX = $srcX - $rect.Left
      $localY = $srcY - $rect.Top
      [void][MuThumb]::BitBlt($hdcDst, 0, 0, $side, $side, $hdcSrc, $localX, $localY, [MuThumb]::SRCCOPY)
      $g.ReleaseHdc($hdcDst)
      $g.Dispose()
      [void][MuThumb]::ReleaseDC($h, $hdcSrc)
      if (Test-NotTooDark $tmp) {
        $thumb = New-Object System.Drawing.Bitmap $size, $size
        $tg = [System.Drawing.Graphics]::FromImage($thumb)
        $tg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $tg.DrawImage($tmp, 0, 0, $size, $size)
        $tg.Dispose()
      }
      $tmp.Dispose()
    }
  } catch {}
}

# 3) PrintWindow full content
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
    if (Test-NotTooDark $crop) {
      $thumb = New-Object System.Drawing.Bitmap $size, $size
      $tg = [System.Drawing.Graphics]::FromImage($thumb)
      $tg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $tg.DrawImage($crop, 0, 0, $size, $size)
      $tg.Dispose()
    }
    $crop.Dispose()
  } catch {}
}

if ($null -eq $thumb) {
  @{ ok = $false; reason = 'capture-failed' } | ConvertTo-Json -Compress
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

  // data URL is more reliable than file:// inside Electron
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
