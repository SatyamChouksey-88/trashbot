# shared/lang — "Bolo": Hinglish + English commands for TrashBot

Delivered **pre-built and pre-tested** with the v4 prompt. One source of truth, used in two places:

| File | Runs in | What it does |
|---|---|---|
| `trashbot-lang.mjs` | phone browser (robot serves it as `/lang.mjs`) **and** the Cursor agent | Parser: text → safe steps → robot API calls. Lexicon, limits, replies (English + Hinglish). |
| `executor.mjs` | Cursor agent (MCP) | Runs a message: stop-first, `read_only` / `dry_run` / `full`, pending questions, learned phrases. Takes an injected `http` function. |
| `web/bolo-ui.mjs` | phone browser (robot serves it as `/bolo-ui.mjs`) | The "Bolo" box: text input, chips, big STOP, settings, learned phrases, history. |
| `web/dev-server.mjs` | laptop | Try the Bolo box with a fake robot: `node shared/lang/web/dev-server.mjs` → http://localhost:8790. Nothing moves. |
| `tools/gen-commands-doc.mjs` | laptop / CI | Writes `docs/COMMANDS.md` (the cheat sheet); `--check` fails if stale. |
| `*.d.mts` | TypeScript | Types for the agent. |

Zero dependencies. Node ≥ 18 for tests. **No native executables are built** (office-laptop safe).

## Safety rules (each one has tests)

| Rule | Meaning |
|---|---|
| S1 | A stop word anywhere → STOP first (even in a question, even misspelled: `stpo`, `rukooo`, `रुको`). |
| S2 | Negation + any action → STOP, never motion (`aage mat jao`, `don't move`, `aage na jao`). |
| S3 | Typos only produce "Did you mean …?" suggestions — never motion. |
| S4 | Motion with unknown words, a question, a place name or two numbers → ask first. |
| S5 | Ambiguous → choices (`ghumo` → left / right). Info + action → choices. |
| S6 | Numbers are clamped: forward 50 cm, back 20 cm (no rear sensor), turn 180°, 20 items, 600 s. Pending answers and learned phrases are re-sanitised. |
| S7 | Learned phrases can't contain safety words and never override them. |

## Tests

```bash
cd shared/lang
npm test            # golden (325 phrases) + property/fuzz + lexicon lint + executor  (~8 s)
npm run test:fuzz   # 50,000 random inputs × 3 seeds per safety property
npm run test:web    # browser test of the Bolo box (needs playwright-core + Chromium; skips if missing)
npm run docs:check  # docs/COMMANDS.md up to date?
```

`npm test` only uses `node --test` — nothing to install.

## Adding words

1. Add the spelling to the right list in `LEXICON` (`en` or `hi`). One token per entry.
2. Add a golden case to `test/golden.json` for the new phrase (what it must do).
3. `npm test` — the lint test fails if the word creates a dangerous overlap (e.g. a stop word that is also an action word).
4. `npm run docs` to refresh `docs/COMMANDS.md`, then `python tools/embed_lang.py` to refresh the firmware header.

Never loosen S1–S7 to make a phrase work; add words or teach a learned phrase instead.

## API adapter

`toApiCalls(step, { turnLeftSign })` returns the exact robot calls, e.g. `MOVE forward 20` → `POST /api/move {"distance_cm":20,"speed":40}`. `turnLeftSign` is the sign of `degrees` that turns the robot **left** in the firmware (reported as `turn_left_sign` in `/api/status`).
