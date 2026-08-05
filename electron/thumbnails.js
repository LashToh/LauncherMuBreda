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
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MuThumb {
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdcBlt, int nFlags);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
"@
$h = [IntPtr]${Number(hwnd)}
if ([MuThumb]::IsIconic($h)) { return }
$rect = New-Object MuThumb+RECT
[void][MuThumb]::GetClientRect($h, [ref]$rect)
$w = [Math]::Max(1, $rect.Right - $rect.Left)
$hgt = [Math]::Max(1, $rect.Bottom - $rect.Top)
$bmp = New-Object System.Drawing.Bitmap $w, $hgt
$g = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $g.GetHdc()
[void][MuThumb]::PrintWindow($h, $hdc, 2)
$g.ReleaseHdc($hdc)
$g.Dispose()
$size = ${Number(size)}
$thumb = New-Object System.Drawing.Bitmap $size, $size
$tg = [System.Drawing.Graphics]::FromImage($thumb)
$tg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$tg.Clear([System.Drawing.Color]::FromArgb(20,20,20))
$scale = [Math]::Max([double]$size / $w, [double]$size / $hgt)
$nw = [int]($w * $scale)
$nh = [int]($hgt * $scale)
$x = [int](($size - $nw) / 2)
$y = [int](($size - $nh) / 2)
$tg.DrawImage($bmp, $x, $y, $nw, $nh)
$tg.Dispose()
$bmp.Dispose()
$thumb.Save('${safeOut}', [System.Drawing.Imaging.ImageFormat]::Png)
$thumb.Dispose()
`;
}

async function runPowerShell(script) {
  await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { windowsHide: true, maxBuffer: 2 * 1024 * 1024 },
  );
}

export async function captureClientThumbnail(
  hwnd,
  gameRoot = getGameRoot(),
  { maxAgeMs = 2500 } = {},
) {
  if (process.platform !== 'win32') return null;
  const dir = thumbsDir(gameRoot);
  ensureDir(dir);
  const filePath = path.join(dir, `${hwnd}.png`);

  const freshEnough =
    fs.existsSync(filePath) && Date.now() - fs.statSync(filePath).mtimeMs < maxAgeMs;

  if (!freshEnough) {
    try {
      await runPowerShell(captureScript(hwnd, filePath, 96));
    } catch {
      // keep previous thumb if capture fails
    }
  }

  if (!fs.existsSync(filePath)) return null;
  const stamp = fs.statSync(filePath).mtimeMs;
  return `file://${filePath.replace(/\\/g, '/')}?t=${stamp}`;
}

export async function attachThumbnails(clients, gameRoot = getGameRoot()) {
  const enriched = [];
  for (const client of clients) {
    const thumbUrl = await captureClientThumbnail(client.hwnd, gameRoot);
    enriched.push({ ...client, thumbUrl });
  }
  return enriched;
}
