# MU Breda Launcher

Premium desktop launcher for **MU Breda Season 21**.

Visual identity matches [CMSMuBreda](https://github.com/LashToh/CMSMuBreda).

## Features (v1)

- Hero Play UI (Season 21 crimson/gold)
- **Play** launches `main.exe` directly from the client folder
- Settings: sound, music, resolution, window mode
- Language buttons **ES / EN / PT** (launcher UI chrome only)
- **Play** repairs outdated `Data\Local\skill.bmd` from `Eng\` (fixes Skill(Kor)) and sets the client to **English**
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

## English / Skill(Kor) repair

If `Main.exe` shows Korean `Skill(Kor) ... 잘못된 값` popups, the root cause is usually an **outdated** `Data\Local\skill.bmd` (e.g. 2022) while Season 21 data lives under `Data\Local\Eng\`.

**Automatic:** pressing **Play** copies newer Eng skill BMDs over `Data\Local\` (with backup under `Data\Local\_mubreda_backup\`) and sets `Language:1` + registry `LangSelection=Eng`.

**Manual (without rebuilding the launcher):**

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\repair-english-client.ps1 `
  -GameRoot "G:\Server Breda\MuDevs Season 21 cracked\Cliente Season 21 Beta"
```

Then start `Main.exe` once to confirm.
