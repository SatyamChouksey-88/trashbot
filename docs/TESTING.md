# TrashBot testing

Hardware tests are yours; mark pass/fail in the tables below.

## G1 — Drive

| Check | Expected | Actual | Pass |
|-------|----------|--------|------|
| Forward / back / turn | Moves correctly | | |
| Obstacle stop | Stops forward &lt; 15 cm | | |
| Release stick | Stops within ~0.3 s | | |
| STOP button | Idle, motors off | | |
| ESTOP + reset | Motors off, then recover | | |

## G2 — Vision

| Check | Expected | Actual | Pass |
|-------|----------|--------|------|
| /api/photo | QVGA JPEG | | |
| Fake detector | Moving dot in UI | | |
| Inference time | ~≤ 150 ms (with EI model) | | |

## G3–G5 — Autonomy

| Check | Expected | Actual | Pass |
|-------|----------|--------|------|
| Search + approach | Aligns on placed trash | | |
| Scoop cycle | Item collected event | | |
| Full session | ≥ 4/5 balls cleared | | |

## G6 — Extras

| Check | Expected | Actual | Pass |
|-------|----------|--------|------|
| Event log | /api/log increments | | |
| Clap to start | Session starts from idle | | |
| log_report.py | Markdown table | | |

## Scenario suite

| Scenario | Setup | Expected | Actual | Pass | Notes |
|----------|-------|----------|--------|------|-------|
| Bright light | Sunlit floor | Finds trash | | | |
| Dim light | Evening lamp | Finds trash | | | |
| Near wall | 20 cm to wall | Avoids / stops | | | |
| Corner | Two walls | Escapes avoid | | | |
| Two items close | 2 balls 30 cm apart | Collects both | | | |
| Look-alike | Phone + paper | Skips phone | | | |
| Cluttered floor | Many objects | No false scoops | | | |
| Dark vs light floor | Both surfaces | Stable detection | | | |

## G0 — Bring-up (software)

| Check | How |
|-------|-----|
| POST / preflight logic | `python tools/run_core_tests.py` (`test_post_core`, `test_preflight`) |
| Bring-up UI | Playwright: Bring-up tab + `POST /api/bringup/complete` (CI `e2e` job) |
| Hardware G0 | Complete web **Bring-up** tab with wheels off the ground; confirm `bringup_done` in `/api/status` |

## G8 — Reliability (software)

| Check | How |
|-------|-----|
| Core recovery / stuck / health / invariant | `python tools/run_core_tests.py` (CI) |
| Motor lease + tripwire | Firmware build; on-device: stall `controlTask` → wheels stop within 250 ms |
| `GET /api/health` | Mock or robot; CRITICAL blocks `POST /api/clean` (409) |
| SAFE_PAUSE | Documented motion heuristic in `MASTER_PROMPT_V3.md` §4.5 |

## Software sim (digital twin)

Run without hardware:

```bash
python tools/sim/build_sim_brain.py
python tools/sim/run.py --suite all --runs 20
python tools/sim/run.py --scenario basic_clean --gif docs/media/basic_clean.gif
```

JSON scenarios live in `tools/sim/scenarios/` (`basic_clean`, `obstacle_ahead`, …). Report: `docs/reports/sim_latest.md`.

With `TRASHBOT_NO_NATIVE=1`, `run.py` skips the suite (CI builds `sim_brain` and runs the full suite).

## G7 — Agent

| Check | Expected | Actual | Pass |
|-------|----------|--------|------|
| MCP get_status | JSON | | |
| clean_room prompt | Safety steps | | |
| Mock MOCK_FAIL_EVERY | item_failed events | | |

## G9 — Learning (software)

| Check | How |
|-------|-----|
| Bandit + confidence core | `python tools/run_core_tests.py` (`test_recipe_bandit`, `test_confidence_zone`, `test_target`) |
| Model gate scripts | `python -m pytest tools/test_model_gate.py -q` |
| Learning API | Mock `GET /api/learning`; UI Learning tab (e2e) |
| Hardware | Enable `LEARNING_ENABLED` only after baseline missions on device |

## G10 — Confidence + agent lessons

| Check | How |
|-------|-----|
| `uncertain_skip` event | Core brain + sim `unknown_object_nearby` |
| Agent lessons | `cd agent && npm test` (`lessons.test.ts`) |

## G11 — Bolo (software)

| Check | How |
|-------|-----|
| Parser + safety S1–S7 | `cd shared/lang && npm test` (359) |
| Embedded JS fresh | `python tools/embed_lang.py --check` |
| MCP `run_command` | `cd agent && npm test` (`bolo.test.ts`) |
| E2E Bolo box | CI `e2e` job (`bolo.spec.ts`) |
| Hardware G11 | `docs/MASTER_PROMPT_V4.md` §8 checklist (wheels up first) |
