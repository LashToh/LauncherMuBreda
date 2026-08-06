# MU Breda Launcher

Premium desktop launcher for **MU Breda Season 21**.

Visual identity matches [CMSMuBreda](https://github.com/LashToh/CMSMuBreda).

## Features (v1)

- Hero Play UI (Season 21 crimson/gold)
- **Play** via existing `StartGame.exe` bootstrap (keeps TrustClient flow)
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
├── StartGame.exe
├── MuBreda Launcher.exe
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

Optional game root for local testing (folder that contains `main.exe` / `StartGame.exe`):

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

- `MuBreda-Launcher-<version>-portable.exe` — put this **inside the client folder** (next to `main.exe` / `StartGame.exe`)
- Installer NSIS (optional)

The portable build reads `PORTABLE_EXECUTABLE_DIR` so Play finds `StartGame.exe` next to the `.exe` you double-clicked (not the temp extract folder).

Icon: `build/icon.ico` (Breda **B**). If Windows packaging fails on symlinks, enable **Developer Mode** and clear `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign`.

## Config defaults

`Data/Launcher/launcher.config.json` is created automatically:

- `apiUrl`: `https://api.mubreda.net`
- `websiteUrl`: `https://mubreda.net`
- donate / social URLs
- `bootstrapExe`: `StartGame.exe` (fallback `1 - StartGame.exe`)

See `docs/launcher-manifest.md` for the update API contract.
