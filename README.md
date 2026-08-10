# MU Breda Launcher

Premium desktop launcher for **MU Breda Season 21**.

Visual identity matches [CMSMuBreda](https://github.com/LashToh/CMSMuBreda).

## Features (v1)

- Hero Play UI (Season 21 crimson/gold)
- **Play** launches `main.exe` directly from the client folder
- Settings: sound, music, resolution, window mode
- **Never changes game language** (`Language:` / `LangSelection` left alone)
- No ES/EN/PT language switch (this client pack only works in English in-game)
- News + server status from `https://api.mubreda.net`
- Social links (website / Discord / Instagram / Facebook)
- Client auto-update (Play still allowed if API is down)
- Minimize sends launcher to **system tray**; close quits the app

## Layout on the client

Only the stub stays loose next to `Main.exe`. All Electron files go in one folder:

```text
Client/
├── Main.exe
├── MuBreda-Launcher.exe       ← small stub (only loose launcher file)
├── MuBreda-Launcher/          ← everything else
│   ├── MuBreda-Launcher-App.exe
│   ├── resources/
│   └── ...
├── option.ini
├── LauncherOption.if
└── Data/
    └── Launcher/
        ├── launcher.config.json
        └── version.json
```

Copy from `release/client-dropin/`: the stub `.exe` + the `MuBreda-Launcher\` folder.

## Develop

```bash
npm install
npm run dev
```

Optional game root for local testing (folder that contains `main.exe`):

```powershell
# PowerShell — MU Breda Season 21 client
$env:LAUNCHER_GAME_ROOT = "G:\Server Breda\MuDevs Season 21 cracked\Cliente Season 21 Beta"
npm run build
npm run start
```

Without `LAUNCHER_GAME_ROOT`, the launcher uses `./dev-game-root`.

## Build Windows (no installer)

```bash
npm run dist
```

This builds a **no-install drop-in** (not a self-extracting portable):

- `release/client-dropin/MuBreda-Launcher.exe` — put next to `Main.exe`
- `release/client-dropin/MuBreda-Launcher/` — put next to `Main.exe`
- `release/MuBreda-Launcher-<version>-client-dropin.zip` — both, zipped

Optional extras:

- `npm run dist:installer` — NSIS setup
- `npm run dist:single` — single self-extracting exe (slower)

Icon: `build/icon.ico` (Breda **B**). If Windows packaging fails on symlinks, enable **Developer Mode** and clear `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign`.

## Config defaults

`Data/Launcher/launcher.config.json` is created automatically:

- `apiUrl`: `https://api.mubreda.net`
- `websiteUrl`: `https://mubreda.net`
- social URLs
- `bootstrapExe`: `main.exe`

See `docs/launcher-manifest.md` for the update API contract.

## Game language (English only on this pack)

This Breda Season 21 client pack **only works in English in-game**. The launcher **never** writes `Language:` or registry `LangSelection`.

Set English once (or use `Play-English.bat` / `fix-english.bat` from the drop-in):

```powershell
(Get-Content ".\LauncherOption.if") -replace '^\s*Language\s*:.*','Language:0' | Set-Content ".\LauncherOption.if" -Encoding ASCII
Set-ItemProperty "HKCU:\Software\Webzen\Mu\Config" LangSelection Eng
Set-ItemProperty "HKCU:\Software\Webzen\Mu\Config" LauncherLang English
Get-Content ".\LauncherOption.if"
```

Then use the launcher normally — Play / settings will not touch those keys.

Rebuild required: `git pull` + `npm run dist` and replace `MuBreda-Launcher.exe` + `MuBreda-Launcher\` (old builds still rewrite language).
