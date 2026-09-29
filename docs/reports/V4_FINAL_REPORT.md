# TrashBot v4 (Bolo) — final software report (§11)

**Date:** 2026-09-30  
**CI (main):** success on run `36638688952` (`3d9bcdf`) — all jobs green including `e2e`, `shared-lang`, `firmware-test`, `agent-verify`.  
**Verdict:** **GO** for software; **G11 hardware** remains user checklist in `docs/TESTING.md` / `docs/USER_STEPS.md` §9.

## Test counts (this session, office laptop)

| Suite | Result |
|-------|--------|
| `shared/lang` `npm test` | 359 pass |
| `pytest tools` | 16 pass (incl. `test_pin_map`, `test_embed_lang`) |
| Agent vitest | 28 pass (incl. `boloParity` 30 golden cases) |
| Firmware `pio run -e xiao` | PASS |
| Unity `test_pin_map` / native | NOT RUN here (`TRASHBOT_NO_NATIVE=1`); CI `firmware-test` |
| Playwright `e2e/` local | NOT RUN (no `e2e/node_modules`); CI `e2e` job |
| `release_check.py` | NO-GO on Windows host (`npm`/`node` path in subprocess); CI covers gates |

## `TURN_LEFT_SIGN`

**Value:** `+1`  
**Derivation:** `timed_move::turnDegrees(+deg)` applies `left = +speed`, `right = -speed` → positive degrees turn left (CCW from above). Asserted in `firmware/test/test_timed_move`.

## New / v4 surfaces

- Static: `GET /lang.mjs`, `GET /bolo-ui.mjs` (embedded in `firmware/lib/net/web_lang.h`)
- API: `GET/POST/DELETE /api/aliases`, `POST /api/aliases/reset`
- Status: `turn_left_sign`, `features: ["bolo","aliases"]`
- MCP: `run_command`, `add_alias`, `list_aliases`, `remove_alias`; `stop`/`estop` allowed in `read_only`
- Cursor: `/trashbot`, `/ruko`, `/saaf-karo`; `TRASHBOT_LANG=auto` in `.cursor/mcp.json`

## Phases J–N

| Phase | Status |
|-------|--------|
| J Package (`shared/lang`, docs, cursor commands) | done |
| K Firmware embed, Bolo mount, aliases, `TURN_LEFT_SIGN` | done |
| L Agent executor + tools + tests + `verify:mcpb` (CI) | done |
| M OPERATOR, COMMANDS, README, API docs | done |
| N CI `shared-lang`, e2e Bolo + UI, `release_check` steps | done |

## Commits pushed (main)

Audit + blockers: `151ea07` … `3d9bcdf`; blocker fix `7d038ef`. Post-audit v4 verification commits on `main` after this report.

## For you next (hardware, in order)

1. **G11 checklist** (`docs/TESTING.md`): wheels up — `ruko` / `रुको`, negation, move/turn calibration, voice via Gboard, learned phrases after reboot, Cursor `/trashbot` in `dry_run` then `full`.
2. **G0–G7** gates on real hardware (`docs/USER_STEPS.md`).
3. Run `release_check.py` on a machine with full Node PATH before field flash if you want local GO (optional; CI already green).

## NOT VERIFIED (needs hardware or full dev PC)

- G11 items 1–11 on physical robot  
- Native zig core + sim locally  
- Edge Impulse model on device (`FakeDetector` until `TrashBot_inferencing` added)  
- Bumper with `BUMPER_ENABLED` (GPIO43 wired)  
- Clap threshold tuning  
