# TrashBot v3 — final software report

**Date:** 2026-09-29  
**Verdict:** **GO** for software release (hardware validation still user-owned per `docs/getting-started/USER_STEPS.md`).

## Phases delivered (A–I)

| Phase | Deliverable |
|-------|-------------|
| A | Office-safe native skip, MCP modes, CI sim |
| B | 16 JSON sim scenarios + fault matrix |
| C | G8 reliability: lease, WDT, recovery, health |
| D | G0 POST, bring-up wizard, preflight |
| E | Missions, api_version 2, profiles, reason codes |
| F | Confidence zones, uncertain_skip, agent lessons |
| G | Recipe bandit (flag off), learning/mistake APIs, model gate scripts |
| H | E2E: health + learning UI tabs |
| I | This report + doc/test pass |

## Fault matrix (sim)

See `docs/sim_latest.md` (generated in CI). Core paths: obstacle, stuck, bumper, vision loss, scoop failure, recovery caps, safe_pause, uncertain skip (when scenario feeds sub-threshold scores).

## Feature flags (defaults)

| Flag | Default | Notes |
|------|---------|--------|
| `LEARNING_ENABLED` | off | Bandit updates on scoop outcomes |
| `MISTAKE_CAPTURE` | off | PSRAM ring + `/api/mistakes/*` |
| `DEBUG_API` | off | Not for `xiao` release |

## Open user steps

- Flash `xiao`, complete bring-up wizard on hardware.
- Edge Impulse model export → `TrashBot_inferencing` (optional).
- Set `TRASHBOT_MODE=full` only after `plan_cleaning` + user OK.

## CI / restricted dev machine

Set `TRASHBOT_NO_NATIVE=1` locally; rely on GitHub Actions for zig core tests, sim, and e2e.
