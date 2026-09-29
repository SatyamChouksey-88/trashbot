# trashbot-agent

MCP server that controls TrashBot over its HTTP API.

## Setup

```bash
npm ci
npm run build
npm test
```

## Run

```bash
export TRASHBOT_URL=http://trashbot.local
npm start
```

## Mock robot (dev)

```bash
npm run mock
TRASHBOT_URL=http://127.0.0.1:8787 npm start
```

## MCP bundle (optional desktop app)

```bash
npm run pack
```

Install the generated `agent.mcpb` (see `docs/reference/AGENT.md`).
