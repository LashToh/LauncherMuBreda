@echo off
setlocal
set "ROOT=%~dp0"
set "OPT=%ROOT%LauncherOption.if"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$opt='%~dp0LauncherOption.if';" ^
  "$lines=@(); if (Test-Path -LiteralPath $opt) { $lines=@(Get-Content -LiteralPath $opt) };" ^
  "$out=@(); $saw=$false; foreach($l in $lines){ if($l -match '^\s*Language\s*:'){ $out+='Language:0'; $saw=$true } else { $out+=$l } };" ^
  "if(-not $saw){ if($out.Count -eq 0){ $out=@('DevModeIndex:8','WindowMode:1','ID:','Language:0') } else { $out+='Language:0' } };" ^
  "Set-Content -LiteralPath $opt -Value $out -Encoding ASCII;" ^
  "$reg='HKCU:\Software\Webzen\Mu\Config'; if(-not (Test-Path $reg)){ New-Item $reg -Force | Out-Null };" ^
  "Set-ItemProperty $reg LangSelection Eng; Set-ItemProperty $reg LauncherLang English;" ^
  "Write-Host 'Fixed Language:0 + LangSelection=Eng'; Get-Content -LiteralPath $opt; Get-ItemProperty $reg | Select-Object LangSelection,LauncherLang"

echo.
echo Open Main.exe now. Do NOT use an old MuBreda-Launcher until you rebuild.
pause
