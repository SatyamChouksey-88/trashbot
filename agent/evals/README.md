# TrashBot agent evals

## Manual (MCP client)

1. Install the `.mcpb` package (see `docs/reference/AGENT.md`).
2. For each image in `photos/trash/` and `photos/keep/`, ask: "Is this trash or keep?"
3. Record results:

| Photo | Expected | Model | Pass |
|-------|----------|-------|------|
| trash/001.jpg | trash | | |
| keep/001.jpg | keep | | |

**Most important metric:** false "trash" on keep items.

## API eval (optional)

```bash
export ANTHROPIC_API_KEY=...   # optional API eval key; billed by your provider
npm run eval
```

Without that key set, the script exits 0 with instructions.
