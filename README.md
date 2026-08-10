# MU Breda Launcher

Premium desktop launcher for **MU Breda Season 21**.

Visual identity matches [CMSMuBreda](https://github.com/LashToh/CMSMuBreda).

## Features (v1)

- Hero Play UI (Season 21 crimson/gold)
- **Play** launches `main.exe` directly from the client folder
- Settings: sound, music, resolution, window mode
- In-game language is **locked to English** (`Language:0` + `LangSelection=Eng`)
- No ES/EN/PT language switch in the UI (Spn/Por break this client pack)
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

## English / language lock

This Breda Season 21 client pack **only works in English in-game**. Switching Spn/Por (or `Language:1/2`) triggers `Skill(Kor)` errors.

The launcher:

- has **no** ES/EN/PT language switch (removed — it kept breaking the game client)
- always writes `Language:0` + `LangSelection=Eng` on Play / boot / settings save
- ships `fix-english.bat` in the client drop-in folder

**If English broke**, set `Language:0` again, or use `Play-English.bat` next to `Main.exe` (forces English and starts the game — skip the old Electron launcher):

```powershell
(Get-Content ".\LauncherOption.if") -replace '^\s*Language\s*:.*','Language:0' | Set-Content ".\LauncherOption.if" -Encoding ASCII
Set-ItemProperty "HKCU:\Software\Webzen\Mu\Config" LangSelection Eng
Set-ItemProperty "HKCU:\Software\Webzen\Mu\Config" LauncherLang English
Get-Content ".\LauncherOption.if"
```

**Until you replace the launcher with 1.2.0+**, rename `MuBreda-Launcher.exe` so you cannot open the old build by mistake, and play with `Play-English.bat` or `Main.exe`.
