# Configuration

Fixzy SysMaker needs no config files — behaviour is tuned with environment
variables and CLI flags. Desktop (Electron) mode keeps its historical
defaults; the switches below apply to the **web shell**, **CLI**, and
**MCP server** (and to Docker, which runs the web shell).

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `FSM_DATA_DIR` | `~/.fixzy` (web/CLI) · `%APPDATA%/Fixzy SysMaker.db` (desktop) | Directory holding the SQLite project store (`Fixzy SysMaker.db`) |
| `FSM_OUTPUT_ROOTS` | `~/projects:$HOME` | Colon/comma-separated allowlist of directories `generate` may write into. Checked before and after path resolution, including symlink escapes |
| `FSM_ALLOW_REMOTE` | unset | Must be `1` to bind `serve` to a non-localhost host. There is **no auth in v1** — LAN or reverse-proxy only |
| `FSM_PHP_BIN` | auto-provisioned | Explicit PHP binary path; skips the Setup Wizard's provisioning (preview/deploy only) |
| `FSM_DEVTOOLS` | unset | `1` opens Electron DevTools (development only) |
| `FSM_MCP_ALLOW_WRITE` | unset | `1` enables write tools on the MCP server (or pass `--allow-write`) |
| `FSM_MCP_ALLOW_GENERATE` | unset | `1` enables generate tools on the MCP server (or pass `--allow-generate`) |

The MCP server is **read-only by default** — enable write/generate tools
only for trusted agent hosts.

## CLI flags

```
fixzy serve     [--port 7788] [--host 127.0.0.1]
fixzy generate  --project <name|id> | --fixture <name>  --out <dir> [--zip]
fixzy list
fixzy fixtures
fixzy mcp       [--allow-write] [--allow-generate]
```

## Data locations

| What | Where |
|---|---|
| Desktop store | `%APPDATA%/Fixzy SysMaker.db` (Windows), `~/Library/Application Support/Fixzy SysMaker/` (macOS), `~/.config/Fixzy SysMaker/` (Linux) |
| Web/CLI store | `$FSM_DATA_DIR/Fixzy SysMaker.db` (default `~/.fixzy/`) |
| Preview environment | `~/.fixzy/preview_env` (downloaded on first run, SHA-256 verified) |
| Generated output | Anywhere inside `FSM_OUTPUT_ROOTS` |

## Docker

`docker-compose.yml` sets:

- `FSM_DATA_DIR=/data`, `FSM_OUTPUT_ROOTS=/data/output` — everything
  persists in the named `fsm-data` volume.
- `FSM_ALLOW_REMOTE=1` — required for the container to bind `0.0.0.0`
  inside its own network namespace.
- Port published as `127.0.0.1:7788:7788` so the unauthenticated UI is not
  reachable from the LAN by default. Change the mapping only behind an
  authenticating reverse proxy.

## Security model (web mode)

1. **Output allowlist** — every generate destination must resolve inside
   `FSM_OUTPUT_ROOTS`; raw `..` is rejected before resolution and symlink
   escapes are caught via realpath of the nearest existing ancestor.
2. **Localhost bind by default** — non-localhost requires `FSM_ALLOW_REMOTE=1`
   and prints a loud warning.
3. **Static containment** — the file server never serves outside `src/`.
4. **Cross-origin rejection** — browser requests from other origins are
   refused (no auth in v1; treat the port as localhost/LAN only).

Details: [HEADLESS_WEB.md](HEADLESS_WEB.md) · [SECURITY.md](../SECURITY.md)
