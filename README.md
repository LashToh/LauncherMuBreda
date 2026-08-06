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

Place the built launcher next to `main.exe`:

```text
Client/
├── main.exe
├── MuBreda-Launcher-*-portable.exe
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

## Build Windows portable

```bash
npm run dist
```

Artifacts go to `release/`:

- **Faster daily use:** copy the whole `release/win-unpacked/` folder into the client (or run `MuBreda-Launcher.exe` from there). No extract on each open.
- `MuBreda-Launcher-<version>-portable.exe` — single file, but **slower** (unpacks to temp every launch)
- NSIS installer (optional)

Put the launcher next to `Main.exe`. Portable builds read `PORTABLE_EXECUTABLE_DIR` so Play finds the client folder.

Icon: `build/icon.ico` (Breda **B**). If Windows packaging fails on symlinks, enable **Developer Mode** and clear `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign`.

## Config defaults

`Data/Launcher/launcher.config.json` is created automatically:

- `apiUrl`: `https://api.mubreda.net`
- `websiteUrl`: `https://mubreda.net`
- social URLs
- `bootstrapExe`: `main.exe`

See `docs/launcher-manifest.md` for the update API contract.
