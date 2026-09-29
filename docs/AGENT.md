# TrashBot MCP agent

Node 20+ MCP server in `agent/`. It talks to the robot over HTTP only; firmware safety is unchanged.

## Tools

| Tool | Robot endpoint |
|------|----------------|
| get_status | GET /api/status |
| take_photo | GET /api/photo |
| start_cleaning | POST /api/clean |
| stop | POST /api/stop (retries) |
| set_mode | POST /api/mode |
| drive | POST /api/mode + POST /api/drive |
| get_events | GET /api/log |

Prompt: `clean_room` (registered in the server).

## Environment

- `TRASHBOT_URL` (default `http://trashbot.local`)
- `TRASHBOT_TOKEN` optional

## Gate 7 WiFi note

Claude on your laptop needs internet. Put the robot on home WiFi (station mode via `firmware/include/secrets.h`) so the PC can reach both Claude and `trashbot.local`.

## Install (.mcpb)

```bash
cd agent
npm ci && npm run build && npm run pack
```

After `npm run pack`, install `agent/agent.mcpb` in Claude Desktop (see Anthropic “Getting Started with Local MCP Servers”). Do not commit API keys.

Manual fallback if packaging fails:

```json
{
  "mcpServers": {
    "trashbot": {
      "command": "node",
      "args": ["C:/path/to/physical/agent/dist/index.js"],
      "env": { "TRASHBOT_URL": "http://trashbot.local" }
    }
  }
}
```

## Mock robot

```bash
npm run mock
TRASHBOT_URL=http://127.0.0.1:8787 npm start
```

## Evals

See `agent/evals/README.md`.
