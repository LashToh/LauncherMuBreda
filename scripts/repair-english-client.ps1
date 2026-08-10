#Requires -Version 5.1
<#
.SYNOPSIS
  Force MU Breda S21 client back to working English.

.DESCRIPTION
  This client pack only works in English in-game.
  Writes Language:0 + LangSelection=Eng + LauncherLang=English,
  and restores the newest skill BMD backup if present.
#>
param(
  [string]$GameRoot = "G:\Server Breda\MuDevs Season 21 cracked\Cliente Season 21 Beta"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $GameRoot)) {
  Write-Error "Game root not found: $GameRoot"
}

$optPath = Join-Path $GameRoot "LauncherOption.if"
$lines = @()
if (Test-Path -LiteralPath $optPath) {
  $lines = @(Get-Content -LiteralPath $optPath)
}

$out = @()
$sawLang = $false
foreach ($line in $lines) {
  if ($line -match '^\s*Language\s*:') {
    $out += "Language:0"
    $sawLang = $true
  } else {
    $out += $line
  }
}
if (-not $sawLang) {
  if ($out.Count -eq 0) {
    $out = @("DevModeIndex:8", "WindowMode:1", "ID:", "Language:0")
  } else {
    $out += "Language:0"
  }
}
Set-Content -LiteralPath $optPath -Value $out -Encoding ASCII
Write-Host "LauncherOption.if:"
Get-Content -LiteralPath $optPath

$regPath = "HKCU:\Software\Webzen\Mu\Config"
if (-not (Test-Path -LiteralPath $regPath)) {
  New-Item -Path $regPath -Force | Out-Null
}
Set-ItemProperty -Path $regPath -Name "LangSelection" -Value "Eng" -Type String
Set-ItemProperty -Path $regPath -Name "LauncherLang" -Value "English" -Type String
Write-Host "Registry:" (Get-ItemProperty $regPath | Select-Object LangSelection, LauncherLang | Out-String)

$backupRoot = Join-Path $GameRoot "Data\Local\_mubreda_backup"
if (Test-Path -LiteralPath $backupRoot) {
  $latest = Get-ChildItem -LiteralPath $backupRoot -Directory |
    Sort-Object Name -Descending |
    Select-Object -First 1
  if ($latest) {
    Write-Host "Restoring skill backup:" $latest.FullName
    $localDir = Join-Path $GameRoot "Data\Local"
    Get-ChildItem -LiteralPath $latest.FullName -File | ForEach-Object {
      Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $localDir $_.Name) -Force
      Write-Host "RESTORED" $_.Name
    }
  }
} else {
  Write-Host "No skill backup folder (ok if you never ran the old repair)."
}

Write-Host ""
Write-Host "Now start Main.exe (not the launcher) once and check English."
