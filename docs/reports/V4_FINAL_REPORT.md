# TrashBot v4 (Bolo) — software report

**Date:** 2026-09-30  
**Verdict:** **GO** for software; G11 hardware checklist in `docs/TESTING.md`.

## Test counts

| Suite | Result |
|-------|--------|
| `shared/lang` | 359 pass |
| Agent vitest | 25 pass |
| `pytest tools` | includes `test_embed_lang.py` |
| Firmware `xiao` | build OK (~1.06 MB flash with embedded JS) |

## `TURN_LEFT_SIGN`

**Value:** `+1`  
**Derivation:** `timed_move::turnDegrees(+deg)` sets `left = +speed`, `right = -speed` → positive degrees turn left (CCW from above). Unit test in `test_timed_move`.

## New surfaces

- Static: `/lang.mjs`, `/bolo-ui.mjs` (from `web_lang.h`)
- API: `/api/aliases` CRUD + reset
- Status: `turn_left_sign`, `features`
- MCP: `run_command`, `add_alias`, `list_aliases`, `remove_alias`

## User next (G11 hardware)

1. Wheels up: voice/type `ruko` during forward motion.  
2. Flash firmware, open robot page, exercise checklist in `docs/TESTING.md` § G11.
