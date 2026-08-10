#Requires -Version 5.1
<#
.SYNOPSIS
  Repair MU Breda Season 21 client so English works (fixes Skill(Kor)).

.DESCRIPTION
  Copies newer skill BMDs from Data\Local\Eng (fallback Spn/Por) over outdated
  Data\Local root files, then sets:
    - LauncherOption.if Language:1
    - Registry LangSelection = Eng
    - Registry LauncherLang = English

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
  Get-ChildItem -LiteralPath $Dir -File | ForEach-Object {
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
if (-not (Test-Path -LiteralPath $localDir)) {
  Write-Error "Missing Data\Local in: $GameRoot"
}

$pairs = @(
  @{ Root = @("skill.bmd", "Skill.bmd"); Lang = @("Skill.bmd", "skill.bmd") },
  @{ Root = @("SkillTooltipText.bmd", "skilltooltiptext.bmd"); Lang = @("SkillTooltipText.bmd", "skilltooltiptext.bmd") },
  @{ Root = @("masterskilltreedata.bmd", "MasterSkillTreeData.bmd"); Lang = @("MasterSkillTreeData.bmd", "masterskilltreedata.bmd") },
  @{ Root = @("masterskilltooltip.bmd", "MasterSkillTooltip.bmd"); Lang = @("MasterSkillTooltip.bmd", "masterskilltooltip.bmd") },
  @{ Root = @("monsterskill.bmd", "MonsterSkill.bmd"); Lang = @("MonsterSkill.bmd", "monsterskill.bmd") }
)

$langFolders = @("Eng", "ENG", "Spn", "SPN", "Por", "POR")
$stamp = Get-Date -Format "yyyy-MM-ddTHH-mm-ss"
$backupDir = Join-Path $localDir "_mubreda_backup\$stamp"
$copied = @()

foreach ($pair in $pairs) {
  $source = $null
  $sourceFolder = $null
  foreach ($folder in $langFolders) {
    $langPath = Join-Path $localDir $folder
    $hit = Resolve-ExistingFile -Dir $langPath -Names $pair.Lang
    if ($hit) {
      $source = $hit
      $sourceFolder = $folder
      break
    }
  }

  if (-not $source) {
    Write-Host "SKIP (no lang copy): $($pair.Root[0])"
    continue
  }

  $dest = Resolve-ExistingFile -Dir $localDir -Names $pair.Root
  if (-not $dest) {
    $dest = Join-Path $localDir $pair.Root[0]
  }

  $needCopy = $true
  if (Test-Path -LiteralPath $dest) {
    $d = Get-Item -LiteralPath $dest
    $s = Get-Item -LiteralPath $source
    if ($d.Length -eq $s.Length -and $d.LastWriteTime -ge $s.LastWriteTime.AddSeconds(-1)) {
      $needCopy = $false
    }
  }

  if (-not $needCopy) {
    Write-Host "OK up-to-date: $(Split-Path $dest -Leaf)"
    continue
  }

  New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
  if (Test-Path -LiteralPath $dest) {
    Copy-Item -LiteralPath $dest -Destination (Join-Path $backupDir (Split-Path $dest -Leaf)) -Force
  }
  Copy-Item -LiteralPath $source -Destination $dest -Force
  $copied += "$(Split-Path $dest -Leaf) <= $sourceFolder"
  Write-Host "COPIED: $(Split-Path $dest -Leaf) from $sourceFolder"
}

# LauncherOption.if -> Language:1 (English)
$optPath = Join-Path $GameRoot "LauncherOption.if"
$lines = @()
if (Test-Path -LiteralPath $optPath) {
  $lines = Get-Content -LiteralPath $optPath
}
$out = @()
$sawLang = $false
foreach ($line in $lines) {
  if ($line -match '^\s*Language\s*:') {
    $out += "Language:1"
    $sawLang = $true
  } else {
    $out += $line
  }
}
if (-not $sawLang) {
  if ($out.Count -eq 0) {
    $out = @("DevModeIndex:8", "WindowMode:1", "ID:", "Language:1")
  } else {
    $out += "Language:1"
  }
}
Set-Content -LiteralPath $optPath -Value $out -Encoding ASCII
Write-Host "Wrote Language:1 -> $optPath"

# Registry language keys
$regPath = "HKCU:\Software\Webzen\Mu\Config"
if (-not (Test-Path -LiteralPath $regPath)) {
  New-Item -Path $regPath -Force | Out-Null
}
Set-ItemProperty -Path $regPath -Name "LangSelection" -Value "Eng" -Type String
Set-ItemProperty -Path $regPath -Name "LauncherLang" -Value "English" -Type String
Write-Host "Registry LangSelection=Eng, LauncherLang=English"

Write-Host ""
Write-Host "Done. Copied $($copied.Count) skill file(s)."
Write-Host "Start Main.exe once to verify English / no Skill(Kor)."
Write-Host "Backup (if any): $backupDir"
