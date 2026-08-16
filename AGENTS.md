# AGENTS.md

## Cursor Cloud specific instructions

MU Breda Launcher is a single product: an Electron + Vite + React desktop launcher
for the "MU Breda Season 21" game client. It targets **Windows** (it launches
`Main.exe`, writes `option.ini` / `LauncherOption.if`, and touches the Windows
registry). It still runs in **development** mode on this Linux VM, with a couple of
non-obvious caveats below.

Standard commands live in `README.md` and `package.json` `scripts` (`dev`, `build`,
`start`, `check`, `test:smoke`, `dist`). Notes below only cover what is non-obvious.

### Services

Only one thing runs during development, in two processes:

- **Vite renderer** (React UI) on port `5173`.
- **Electron main** process, which loads the renderer and provides IPC (settings,
  launch, updater, tray).

`npm run dev` starts both together (Vite + `ELECTRON_DEV=1 electron .`).

### Running the GUI on this Linux VM (important)

The GUI needs an X display; use `DISPLAY=:1` (already available on the VM).

Two Linux-only gotchas can leave the Electron window **blank**. Neither is a code bug
— both work as-is on the app's real Windows target — so do NOT "fix" them in source:

1. **Vite binds to IPv6 (`::1`) by default here, but `electron/main.js` hardcodes
   `http://127.0.0.1:5173` (IPv4).** The mismatch gives `ERR_CONNECTION_REFUSED` and a
   blank window. Start the renderer bound to IPv4 instead: `npx vite --host 127.0.0.1`.
2. **`mainWindow.setIcon('build/icon.ico')` throws on Linux** (Electron can't load
   `.ico` window icons on Linux). The throw aborts `createWindow` *before* `loadURL`,
   so the window never loads. To run the GUI on Linux, make `getAppIconPath()`
   (see `electron/appIcon.js`) resolve to `build/icon.png` instead of `build/icon.ico`
   — e.g. temporarily move `build/icon.ico` aside during a local GUI session (revert
   before committing; the `.ico` is required for the Windows build).

Reliable local GUI sequence (avoids both issues and the startup race):

```bash
# terminal 1 — renderer bound to IPv4
npx vite --host 127.0.0.1
# terminal 2 — after 127.0.0.1:5173 returns 200, with build/icon.ico moved aside
DISPLAY=:1 ELECTRON_DEV=1 npx electron .
```

The many `bus.cc ... Failed to connect to the bus` and `Exiting GPU process` lines in
Electron output are harmless in this headless VM.

### Testing / lint / build

- **Smoke test:** `npm run test:smoke` boots Electron headlessly and asserts the
  settings/config/updater logic end-to-end (writes `option.ini` + `LauncherOption.if`
  under `dev-game-root/`). This runs without a display and is the quickest correctness
  signal.
- **Syntax check:** `npm run check` (`node --check electron/main.js`). There is **no
  ESLint / test framework** configured in this repo.
- **Build:** `npm run build` (generates icons via `sharp`, then `vite build` into
  `dist/`). Works on Linux.
- **Windows packaging** (`npm run dist` / `dist:installer` / `dist:single`) targets
  Windows via electron-builder and is not part of Linux dev.

### Game root

Without `LAUNCHER_GAME_ROOT`, dev mode uses `./dev-game-root` (gitignored, auto-created)
as the folder that would contain `Main.exe`. There is no real `Main.exe` on Linux, so
the **Play** button returns `MAIN_MISSING` — expected. Settings/language changes still
persist to `dev-game-root/option.ini`, `dev-game-root/LauncherOption.if`, and
`dev-game-root/Data/Launcher/launcher.config.json`.
