# TrashBot — rules for AI coding agents

## Autonomy

- Do not ask the human for decisions covered in `docs/dev/prompts/MASTER_PROMPT.md` Section 1.
- If something is missing, decide using: safety → exact hardware in the master prompt → simplest → cheapest → easiest to test. Record in `docs/project/DECISIONS.md`.
- Human-only steps (buy, wire, flash, Edge Impulse Studio, MCP desktop app install) go in `docs/getting-started/USER_STEPS.md`; use stubs so builds and tests still pass.
- After each phase: build → test → fix → commit → update the progress log at the top of `docs/project/PLAN.md`.

## MUST

- Keep `firmware/lib/core` free of `Arduino.h` and ESP headers; test with `python -m platformio test -d firmware -e native` (or CI when native is blocked locally).
- Put tunable numbers in `firmware/include/config.h`; NVS calibration overrides marked `[calib]`.
- Route every motor command through `safety_logic`.
- Never upload firmware or open serial monitor in CI/agent sessions (build only unless the user flashes locally).
- Push only after build + tests pass locally; never force-push; never commit secrets.
- One commit per master-prompt phase when possible.

## MUST NOT

- Bypass firmware safety from web, API, or MCP agent.
- Use `delay()` in control paths; do not access the camera from the web task.
- Do not reuse LEDC channel 7 / timer 3 (reserved for camera XCLK).
- No external CDNs in the robot web UI.
- MCP server: protocol on stdout only; log to stderr.
- Do not commit `secrets.h`, API keys, or datasets.

## Feature template (v3)

A feature is done only when it has: (1) config flag/value in `config.h` (experimental default off), (2) pure logic in `lib/core` + unit tests (+ property test if motion-related), (3) sim scenario JSON happy + failure path, (4) events with reason codes, (5) additive API + `contract.ts` + tests, (6) `docs/reference/TESTING.md` / `docs/getting-started/USER_STEPS.md` updates.

## Resume

If interrupted, re-read `docs/dev/prompts/MASTER_PROMPT.md`, `docs/dev/prompts/MASTER_PROMPT_V3.md`, `docs/dev/prompts/MASTER_PROMPT_V4.md`, and `docs/project/PLAN.md`, then continue the first unfinished phase.

Operating the robot from chat: see `docs/reference/OPERATOR.md` (operator role ≠ build role; while building, never ask).
