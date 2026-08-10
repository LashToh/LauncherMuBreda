#Requires -Version 5.1
<#
.SYNOPSIS
  Restore working English on MU Breda Season 21 after bad launcher language writes.

.DESCRIPTION
  Earlier launcher builds wrongly treated Language:0 as Korean and rewrote it to 1,
  and may have copied Eng\Skill.bmd over Data\Local\skill.bmd.

  This script:
  1. Restores skill BMD backups from Data\Local\_mubreda_backup\ (newest first)
  2. Sets LauncherOption.if Language:0 (English on this client)
  3. Sets registry LangSelection=Eng, LauncherLang=English

.PARAMETER GameRoot
  Folder that contains Main.exe.
#>
param(
  [Parameter(Mandatory = $false)]
  [string]$GameRoot = "G:\Server Breda\MuDevs Season 21 cracked\Cliente Season 21 Beta"
)

$ErrorActionPreference = "Stop"

function Resolve-ExistingFile {
  param([string]$Dir, [string[]]$Names)
  if (-not (Test-Path -LiteralPath $Dir)) { return $null }
  $map = @{}
  Get-ChildItem -LiteralPath $Dir -File -ErrorAction SilentlyContinue | ForEach-Object {
    $map[$_.Name.ToLowerInvariant()] = $_.FullName
  }
  foreach ($name in $Names) {
    $key = $name.ToLowerInvariant()
    if ($map.ContainsKey($key)) { return $map[$key] }
  }
  return $null
}

if (-not (Test-Path -LiteralPath $GameRoot)) {
  Write-Error "Game root not found: $GameRoot"
}

$main = Resolve-ExistingFile -Dir $GameRoot -Names @("Main.exe", "main.exe")
if (-not $main) {
  Write-Error "Main.exe not found in: $GameRoot"
}

$localDir = Join-Path $GameRoot "Data\Local"
$backupRoot = Join-Path $localDir "_mubreda_backup"

# Restore newest skill backups if present (undo accidental Eng→Local copies).
if (Test-Path -LiteralPath $backupRoot) {
  $latest = Get-ChildItem -LiteralPath $backupRoot -Directory |
    Sort-Object Name -Descending |
    Select-Object -First 1
  if ($latest) {
    Write-Host "Restoring skill backup from: $($latest.FullName)"
    Get-ChildItem -LiteralPath $latest.FullName -File | ForEach-Object {
      $dest = Join-Path $localDir $_.Name
      Copy-Item -LiteralPath $_.FullName -Destination $dest -Force
      Write-Host "RESTORED: $($_.Name)"
    }
  }
} else {
  Write-Host "No _mubreda_backup folder — skill files left as-is."
}

# LauncherOption.if -> Language:0 (English on this MuDevs S21 client)
$optPath = Join-Path $GameRoot "LauncherOption.if"
$lines = @()
if (Test-Path -LiteralPath $optPath) {
  $lines = Get-Content -LiteralPath $optPath
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
Write-Host "Wrote Language:0 (English) -> $optPath"

$regPath = "HKCU:\Software\Webzen\Mu\Config"
if (-not (Test-Path -LiteralPath $regPath)) {
  New-Item -Path $regPath -Force | Out-Null
}
Set-ItemProperty -Path $regPath -Name "LangSelection" -Value "Eng" -Type String
Set-ItemProperty -Path $regPath -Name "LauncherLang" -Value "English" -Type String
Write-Host "Registry LangSelection=Eng, LauncherLang=English"

Write-Host ""
Write-Host "Done. Start Main.exe once to verify English works again."
