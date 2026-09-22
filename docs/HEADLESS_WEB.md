# Headless + Web Mode (Phase 5)

Fixzy SysMaker runs in three modes from ONE engine (IR + generators + handler registry):

| Mode | Entry | UI | Store |
|------|-------|----|-------|
| Desktop (Electron) | `npm start` | Native window | `%APPDATA%/Fixzy SysMaker.db` (unchanged) |
| Web (serve) | `fixzy serve` | Same renderer in browser | `~/.fixzy/Fixzy SysMaker.db` (`FSM_DATA_DIR`) |
| Headless CLI | `fixzy generate` | none | same as web |

## Architecture

- `src/handlers/register.js` — all 53 IPC handlers, extracted from main.js.
  Electron and the web server register the SAME handlers through a context
  object (`ctx.ipcMain`, `ctx.db`, `ctx.getPath`, `ctx.getWindow`,
  `ctx.dialog`, `ctx.shell`). No logic duplication.
- `src/core/store.js` — opens/bootstraps the SQLite store without Electron.
- `src/core/pathGuard.js` — output-path allowlist (see Security).
- `src/core/webServer.js` — plain `http` server: static renderer +
  `POST /ipc/<channel>` + SSE `GET /events` for push channels (overlay,
  custom dialogs). No new npm dependencies.
- `src/core/web-shim.js` — injected into index.html in web mode; recreates
  `window.electronAPI` (same 58 methods as preload.js) over HTTP/SSE.

## CLI

```
fixzy serve [--port 7788] [--host 127.0.0.1]
fixzy generate --project <name-or-id> --out <dir> [--zip]
fixzy generate --fixture <name> --out <dir> [--zip]
fixzy list
fixzy fixtures
```

## Security (Phase 5.4 / 5.6)

1. **Output allowlist.** Every generate destination must resolve inside
   `FSM_OUTPUT_ROOTS` (default `~/projects:$HOME`). Checks: raw `..`
   rejection BEFORE resolution, lexical containment, symlink-escape via
   realpath of nearest existing ancestor. Enforced in web/CLI mode
   (`enforceOutputRoots: true`); Electron desktop keeps its historical
   unrestricted doc_root (user's own machine).
2. **Localhost bind by default.** `serve` binds 127.0.0.1. Binding any other
   interface requires `FSM_ALLOW_REMOTE=1` and prints a loud warning.
3. **No auth in v1 remote.** LAN-only or put behind a reverse proxy with
   authentication/TLS. Do NOT expose port 7788 to the internet.
4. **Static containment.** The file server never serves outside `src/`;
   traversal attempts 404/403.

## Electron loading the local server (5.7, documented, not wired)

`createWindow()` in `src/main.js` can point at the serve instance instead of
`loadFile`:

```js
win.loadURL('http://127.0.0.1:7788');
```

The injected web-shim already provides `window.electronAPI`, so the renderer
is mode-agnostic. Kept as a documented option: the desktop keeps
`loadFile` + preload for now (native dialogs, file open).

## Zip export (5.5)

`generate --zip` produces `<target>.zip` next to the output dir (system
`zip`). In web mode the same zip can be served as a download; the CLI form
is the canonical implementation for this phase.
