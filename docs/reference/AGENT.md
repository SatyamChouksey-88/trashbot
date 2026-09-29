# TrashBot MCP agent

Node 20+ MCP server in `agent/`. It talks to the robot over HTTP only; firmware safety is unchanged.

## Gate 7 in Cursor (primary dev path)

1. Build the bundled server: `cd agent && npm ci && npm run build`.
2. Start the mock robot in a terminal: `npm run mock` (listens on http://localhost:8787).
3. Enable MCP in **Cursor Settings → MCP**. This repo ships `.cursor/mcp.json`:
   - Server name: `trashbot`
   - Command: `node` with args `${workspaceFolder}/agent/dist/index.js`
   - Env: `TRASHBOT_URL=http://localhost:8787`, `TRASHBOT_MODE=dry_run` (motion tools log “DRY RUN” until you set `full`)
4. Reload MCP if needed; confirm `trashbot` shows tools.
5. In chat, use the **`clean_room`** prompt (or ask the agent to run those steps). It will call tools against the mock until you point `TRASHBOT_URL` at a real robot.

For a physical robot on your LAN later, change `TRASHBOT_URL` in `.cursor/mcp.json` to `http://trashbot.local` or `http://192.168.4.1`.

## Tools

| Tool | Robot endpoint |
|------|----------------|
| get_status | GET /api/status |
| take_photo | GET /api/photo |
| start_cleaning | POST /api/clean |
| stop | POST /api/stop (retries) |
| set_mode | POST /api/mode |
| drive / move / turn / scoop | manual API routes |
| get_events | GET /api/log |
| get_health | GET /api/health |
| get_mission | GET /api/mission/current |
| plan_cleaning | photo + zones + confirmed lessons (no motion) |
| get_lessons | `agent/memory/lessons.json` (see `lessons.example.json`) |
| record_lesson / record_user_correction | laptop memory (not blocked in `dry_run`) |

## Talking to TrashBot in Hinglish / English

- Cursor slash commands: `/trashbot`, `/ruko`, `/saaf-karo` (see `.cursor/commands/`).
- Prefer MCP tool **`run_command`** with the user's exact words before chaining legacy tools.
- Modes: `read_only` (info + **stop always works**), `dry_run` (default), `full` (motion).
- Set `TRASHBOT_LANG=auto|en|hi` in `.cursor/mcp.json`.
- Chat is **not** an emergency stop — use the phone **■ RUKO · STOP** button or power switch.
- Operator behaviour when *you* chat with the robot: `docs/reference/OPERATOR.md`.

## Lessons memory

Confirmed lessons (`user_confirmed: true`) are applied in `plan_cleaning` and the `clean_room` prompt. Copy `agent/memory/lessons.example.json` to `lessons.json` locally (gitignored).

## Environment

- `TRASHBOT_URL` (default `http://trashbot.local`)
- `TRASHBOT_MODE` — `read_only` | `dry_run` (default) | `full`
- `TRASHBOT_TOKEN` optional

Reconnect: the client retries with backoff (0.5 s → 1 s → 2 s → 5 s) and reports **robot offline** instead of crashing.

## Pack for personal machines (optional)

```bash
cd agent
npm run pack          # esbuild bundle → trashbot.mcpb
npm run verify:mcpb   # smoke: mock + initialize + tools/list
```

The `.mcpb` contains a single bundled `dist/index.js` (all runtime deps inlined via esbuild).

### MCP desktop app (optional)

On a machine that allows local MCP servers, install the `trashbot.mcpb` bundle or run `node agent/dist/index.js` with the same env vars as `.cursor/mcp.json`.

## Mock robot

```bash
npm run mock
```

## Evals

See `agent/evals/README.md`.
