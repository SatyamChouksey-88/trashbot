# TrashBot — rules for AI coding agents

## Autonomy

- Do not ask the human for decisions covered in `docs/MASTER_PROMPT.md` Section 1.
- If something is missing, decide using: safety → exact hardware in the master prompt → simplest → cheapest → easiest to test. Record in `docs/DECISIONS.md`.
- Human-only steps (buy, wire, flash, Edge Impulse Studio, Claude Desktop install) go in `docs/USER_STEPS.md`; use stubs so builds and tests still pass.
- After each phase: build → test → fix → commit → update the progress log at the top of `docs/PLAN.md`.

## MUST

- Keep `firmware/lib/core` free of `Arduino.h` and ESP headers; test with `python -m platformio test -d firmware -e native`.
- Put tunable numbers in `firmware/include/config.h`; NVS calibration overrides marked `[calib]`.
- Route every motor command through `safety_logic`.
- Never upload firmware or open serial monitor in CI/agent sessions (build only unless the user flashes locally).
- No push to remotes unless the user asks.
- Local commits only; one commit per master-prompt phase when possible.

## MUST NOT

- Bypass firmware safety from web, API, or MCP agent.
- Use `delay()` in control paths; do not access the camera from the web task.
- Do not reuse LEDC channel 7 / timer 3 (reserved for camera XCLK).
- No external CDNs in the robot web UI.
- MCP server: protocol on stdout only; log to stderr.
- Do not commit `secrets.h`, API keys, or datasets.

## Resume

If interrupted, re-read `docs/MASTER_PROMPT.md` and `docs/PLAN.md`, then continue the first unfinished phase.
