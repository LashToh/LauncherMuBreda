# MU Breda Launcher

Premium desktop launcher for **MU Breda Season 21**.

Visual identity matches [CMSMuBreda](https://github.com/LashToh/CMSMuBreda).

## Features (v1)

- Hero Play UI (Season 21 crimson/gold)
- **Play** launches `main.exe` directly from the client folder
- Settings: sound, music, resolution, window mode
- Language buttons **ES / EN / PT** (launcher UI + game `LauncherOption.if`)
- News + server status from `https://api.mubreda.net`
- Social links (website / Discord / Instagram / Facebook)
- Client auto-update (Play still allowed if API is down)
- Minimize sends launcher to **system tray**; close quits the app

## Layout on the client

Copy the **contents** of `release/MuBreda-Launcher/` into the client folder (same place as `Main.exe`), not as a subfolder:

```text
Client/
├── Main.exe
├── MuBreda-Launcher.exe       ← launcher (loose next to Main)
├── resources/                 ← Electron runtime files
├── *.dll / *.pak / ...
├── option.ini                 ← written by launcher
├── LauncherOption.if          ← written by launcher
└── Data/
    └── Launcher/
        ├── launcher.config.json
        └── version.json
```

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

This builds a **ready-to-run folder** (not an installer, not a self-extracting portable):

- `release/MuBreda-Launcher/` — copy **everything inside** this folder into the client (next to `Main.exe`), then run `MuBreda-Launcher.exe`
- `release/MuBreda-Launcher-<version>-client-files.zip` — same files, zipped (extract directly into the client folder)

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
