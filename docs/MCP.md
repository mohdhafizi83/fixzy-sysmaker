# MCP — Model Context Protocol Integration

Fixzy SysMaker can act as an **MCP server**: a standard interface that lets
AI assistants (Claude Desktop, Cursor, Windsurf, and any other MCP host)
drive the same generation engine the GUI uses — inspect projects, design
schemas, validate, and generate, all from natural-language conversation.

This is not a second implementation. Every MCP tool calls the exact same
IPC handler registry that powers the Electron GUI, the web UI, and the
headless CLI. One engine, four shells.

## Quick start

Run the server:

```bash
fixzy mcp                      # read-only (default)
fixzy mcp --allow-write        # + schema mutation tools
fixzy mcp --allow-generate     # + the generate tool
```

Register it with your AI host. Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "fixzy": {
      "command": "fixzy",
      "args": ["mcp", "--allow-write", "--allow-generate"]
    }
  }
}
```

Then just talk to the assistant:

> "Create a project called Library with tables books (title, isbn, stock)
> and loans (book_id, borrowed_at). Link loans.book_id to books, validate
> the schema, then generate into ~/projects/library-app."

The assistant calls `fixzy_create_project` → `fixzy_add_table` ×2 →
`fixzy_add_field` ×N → `fixzy_set_relationship` → `fixzy_validate_schema`
→ `fixzy_generate`. Every step goes through the same validation the GUI
enforces — the AI never free-writes application code.

## Tool reference

### Read tools (always available)

| Tool | Purpose |
|---|---|
| `fixzy_capabilities` | Stacks, engines, theme presets, widget types, gating status. Call first. |
| `fixzy_list_projects` | All projects in the store (id, title, active). |
| `fixzy_get_schema` | Full schema of a project: tables, fields, relationships, menu, widgets. |
| `fixzy_validate_schema` | Run the IR gate (`exportIR` + `validateIR`); returns structured errors. |

### Write tools (`--allow-write` / `FSM_MCP_ALLOW_WRITE=1`)

| Tool | Purpose |
|---|---|
| `fixzy_create_project` | New project (seeds the core `users` table, marks active). |
| `fixzy_add_table` | Add a snake_case table; gets system fields + menu entry like the GUI. |
| `fixzy_add_field` | Add a field with type, length, required/unique/default, etc. |
| `fixzy_set_relationship` | One-to-many parent ← child via an existing FK field (upsert). |
| `fixzy_update_project_settings` | Project-level settings via the GUI's own column allowlist. |

### Generate tool (`--allow-generate` / `FSM_MCP_ALLOW_GENERATE=1`)

| Tool | Purpose |
|---|---|
| `fixzy_generate` | Generate the Laravel + Filament app for a stored project or bundled fixture into an allowlisted output directory. |

### Resources

| URI | Content |
|---|---|
| `fixzy://capabilities` | Capabilities JSON (same as the tool). |
| `fixzy://docs/ir-mapping` | The IR → Laravel/Filament mapping contract. |
| `fixzy://docs/faq` | This project's FAQ. |

## Security model

The MCP surface is **deny-by-default**:

1. **Gating.** Write and generate tools are invisible until explicitly
   enabled with flags or env vars. A read-only server cannot mutate
   anything.
2. **Output allowlist.** `fixzy_generate` runs every destination through
   `src/core/pathGuard.js` — the same guard as the CLI: raw `..`
   traversal rejected before resolution, symlink escape blocked, paths
   outside `FSM_OUTPUT_ROOTS` (default `~/projects` and `$HOME`) refused.
3. **Never exposed.** `app:deploy`, `app:update`, `run-composer`, and
   the preview controls are not registered as MCP tools at all. Mutating
   a live deployment stays a human-initiated action.
4. **Input validation.** Table names must be snake_case; field names
   letters/underscores only; fixture names are pattern-checked (no
   traversal); unknown settings keys are dropped by the handler allowlist.
5. **Transport hygiene.** stdout carries only JSON-RPC frames — all
   legacy `console.log` output is redirected to stderr so the protocol
   stream can never be corrupted by generator chatter.

Run the security-relevant tests: `node test/mcp_test.js` (gating,
traversal rejection, unknown tools, stdout purity).

## Environment variables

| Variable | Effect |
|---|---|
| `FSM_DATA_DIR` | Store directory (default `~/.fixzy`). |
| `FSM_OUTPUT_ROOTS` | Allowed generate destinations (comma/`;` separated, `~` expanded). |
| `FSM_MCP_ALLOW_WRITE=1` | Enable write tools (same as `--allow-write`). |
| `FSM_MCP_ALLOW_GENERATE=1` | Enable the generate tool (same as `--allow-generate`). |
| `FSM_MCP_TRACE=1` | Debug: log received/sent frames to stderr. |

## Notes & limitations

- The MCP server is single-process, stdio-based — one host connection per
  process. Run one per AI host.
- Boolean tool arguments are coerced to `1/0` and object settings to JSON
  text before storage, matching what the GUI writes.
- `fixzy_set_relationship` deliberately resolves tables **project-scoped**
  (the legacy global handler can bind same-named tables across projects);
  the stored row shape is identical.
- Generation writes the `app/` layer plus docs; the Laravel skeleton
  (artisan, composer.json) comes from the preview boilerplate, same as
  GUI generation.
