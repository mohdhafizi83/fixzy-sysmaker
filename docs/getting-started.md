# Getting Started

Fixzy SysMaker is a visual database designer that generates a complete
Laravel + Filament admin system from your schema. One engine powers four
shells: the **desktop app** (Electron), a **local web UI**, a **headless
CLI**, and an **MCP server** for AI agents.

Pick whichever path fits you — all four produce the same output.

---

## Option 1 — Desktop app (recommended)

1. Download the installer for your OS from
   [GitHub Releases](https://github.com/mohdhafizi83/fixzy-sysmaker/releases):

   | Platform | File |
   |---|---|
   | Windows 10/11 (x64) | `Fixzy SysMaker Setup x.x.x.exe` |
   | macOS (Intel + Apple Silicon) | `Fixzy SysMaker-x.x.x.dmg` |
   | Ubuntu/Debian (x64) | `fixzy-sysmaker_x.x.x_amd64.deb` |
   | Any Linux (x64) | `Fixzy SysMaker-x.x.x.AppImage` |

2. Install and launch. Installers are unsigned: on Windows use SmartScreen
   → "More info" → "Run anyway"; on macOS right-click → Open on first launch.
   Verify downloads against `SHA256SUMS.txt` in the release.
3. On first launch the **Setup Wizard** provisions PHP + Composer with one
   click (the Laravel preview environment is downloaded on first run into
   `~/.fixzy/preview_env`).
4. Click **New Project**, design your tables and relationships, then
   **Generate** — the Laravel + Filament app lands in your output folder.

## Option 2 — From source

Requirements: **Node.js 20+** (PHP 8.2+ only for live preview/deploy — the
generators themselves need no PHP).

```bash
git clone https://github.com/mohdhafizi83/fixzy-sysmaker.git
cd fixzy-sysmaker
npm install
npm run setup:binaries   # provisions PHP + composer.phar for your OS
npm start                # launches the desktop app
```

## Option 3 — CLI / CI (headless)

```bash
node bin/fixzy.js serve                 # web UI at http://127.0.0.1:7788
node bin/fixzy.js list                  # projects in the store
node bin/fixzy.js generate --project "TaskFlow" --out ~/projects --zip
node bin/fixzy.js generate --fixture base_simple --out ~/projects --zip
node bin/fixzy.js fixtures              # golden fixture test suite
node bin/fixzy.js mcp                   # MCP server on stdio (AI agents)
```

## Option 4 — Docker (web shell, no display needed)

The image runs the **headless web shell** (`fixzy serve`) — the same
designer UI in a browser, no Electron and no X server:

```bash
docker compose up -d --build
open http://127.0.0.1:7788
```

The port is published on `127.0.0.1` only: the web shell has **no
authentication** in v1. To expose it beyond localhost, put a reverse proxy
with auth + TLS in front (see [HEADLESS_WEB.md](HEADLESS_WEB.md)).
Projects and generated output persist in the `fsm-data` volume
(`FSM_DATA_DIR=/data`).

## Verify your install

Whichever option you chose, a quick end-to-end check:

```bash
node bin/fixzy.js generate --fixture base_simple --out /tmp/fsm-check --zip
```

A `base_simple` Laravel project (plus `base_simple.zip`) should appear in
`/tmp/fsm-check` with no errors.

## Next steps

- [Configuration](configuration.md) — environment variables, data
  locations, security switches
- [Manual](manual/) — full UI walkthrough with screenshots
- [FAQ](FAQ.md) · [MCP server](MCP.md) · [Headless + Web mode](HEADLESS_WEB.md)
