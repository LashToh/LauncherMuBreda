@echo off
setlocal EnableExtensions
cd /d "%~dp0"

REM Force working English for Breda S21 MuDevs client, then start Main.exe.
REM Do NOT use MuBreda-Launcher until it is rebuilt to 1.2.0+ (no language switch).

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root = (Get-Location).Path;" ^
  "$opt = Join-Path $root 'LauncherOption.if';" ^
  "$lines = @(); if (Test-Path -LiteralPath $opt) { $lines = @(Get-Content -LiteralPath $opt) };" ^
  "$out = @(); $saw = $false;" ^
  "foreach ($l in $lines) {" ^
  "  if ($l -match '^\s*Language\s*:') { $out += 'Language:0'; $saw = $true }" ^
  "  else { $out += $l }" ^
  "};" ^
  "if (-not $saw) {" ^
  "  if ($out.Count -eq 0) { $out = @('DevModeIndex:8','WindowMode:1','ID:','Language:0') }" ^
  "  else { $out += 'Language:0' }" ^
  "};" ^
  "Set-Content -LiteralPath $opt -Value $out -Encoding ASCII;" ^
  "$reg = 'HKCU:\Software\Webzen\Mu\Config';" ^
  "if (-not (Test-Path $reg)) { New-Item $reg -Force | Out-Null };" ^
  "Set-ItemProperty $reg -Name LangSelection -Value Eng -Type String;" ^
  "Set-ItemProperty $reg -Name LauncherLang -Value English -Type String;" ^
  "Write-Host 'OK Language:0 + Eng';" ^
  "Get-Content -LiteralPath $opt"

if not exist "Main.exe" if not exist "main.exe" (
  echo Main.exe not found in %CD%
  pause
  exit /b 1
)

if exist "Main.exe" (
  start "" "Main.exe"
) else (
  start "" "main.exe"
)

endlocal
