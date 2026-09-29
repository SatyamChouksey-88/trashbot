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
