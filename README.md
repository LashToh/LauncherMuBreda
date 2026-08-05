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
- Minimize/close sends launcher to **system tray**
- Multi-client dock: focus open `main.exe` windows, `+` new client, collapse/restore all

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

Artifacts go to `release/`.

## Config defaults

`Data/Launcher/launcher.config.json` is created automatically:

- `apiUrl`: `https://api.mubreda.net`
- `websiteUrl`: `https://mubreda.net`
- donate / social URLs
- `bootstrapExe`: `StartGame.exe` (fallback `1 - StartGame.exe`)

See `docs/launcher-manifest.md` for the update API contract.
