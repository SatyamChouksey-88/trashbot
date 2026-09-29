# TrashBot agent evals

## Manual (Claude Desktop)

1. Install the `.mcpb` package (see `docs/AGENT.md`).
2. For each image in `photos/trash/` and `photos/keep/`, ask: "Is this trash or keep?"
3. Record results:

| Photo | Expected | Model | Pass |
|-------|----------|-------|------|
| trash/001.jpg | trash | | |
| keep/001.jpg | keep | | |

**Most important metric:** false "trash" on keep items.

## API eval

```bash
export ANTHROPIC_API_KEY=...
npm run eval
```

Without `ANTHROPIC_API_KEY`, the script exits 0 with instructions.
