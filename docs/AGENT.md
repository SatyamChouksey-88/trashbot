# TrashBot MCP agent

Node 20+ MCP server in `agent/`. It talks to the robot over HTTP only; firmware safety is unchanged.

## Gate 7 in Cursor (primary — office laptop)

1. Build the bundled server: `cd agent && npm ci && npm run build`.
2. Start the mock robot in a terminal: `npm run mock` (listens on http://localhost:8787).
3. Enable MCP in **Cursor Settings → MCP**. This repo ships `.cursor/mcp.json`:
   - Server name: `trashbot`
   - Command: `node` with args `${workspaceFolder}/agent/dist/index.js`
   - Env: `TRASHBOT_URL=http://localhost:8787`
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

## Environment

- `TRASHBOT_URL` (default `http://trashbot.local`)
- `TRASHBOT_TOKEN` optional

## Pack for personal machines (optional)

```bash
cd agent
npm run pack          # esbuild bundle → trashbot.mcpb
npm run verify:mcpb   # smoke: mock + initialize + tools/list
```

The `.mcpb` contains a single bundled `dist/index.js` (all runtime deps inlined via esbuild).

### Claude Desktop (optional — personal PC only)

Not available on locked-down work laptops. On your own machine you can install `trashbot.mcpb` per Anthropic’s local MCP guide, or use the same `node agent/dist/index.js` entry with env vars.

## Mock robot

```bash
npm run mock
```

## Evals

See `agent/evals/README.md`.
