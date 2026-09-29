# TrashBot build plan

## Progress log

**v3 active** — executing `docs/MASTER_PROMPT_V3.md` (phases A–I).

| Date | Phase | Notes |
|------|-------|-------|
| 2026-09-29 | v3-A | EPDR: `TRASHBOT_NO_NATIVE=1`; CI runs zig core + sim. Agent dry_run + reconnect backoff. |
| 2026-09-29 | v3-B | JSON scenarios (16), fault engine, episode runner, `sim_latest.md` + fault matrix; CI `--suite all`. |
| 2026-09-29 | v3-C | G8: motor lease, WDT heartbeats, stuck detect, recovery manager, SAFE_PAUSE, `/api/health`, invariant tripwire. |
| 2026-09-29 | v3-D | G0 POST, bring-up wizard tab + API, pre-flight on clean, `release_check.py` full gate. |
| 2026-09-29 | v3-E | Missions + history API, event reason codes, profile slots API/UI. |
| 2026-09-29 | v3-F | Confidence zones, uncertain_skip, MCP lessons + plan_cleaning zones. |
| 2026-09-29 | v3-G | Recipe bandit, `/api/learning`, mistake stubs, eval_model + model_gate. |
| 2026-09-29 | v3-H | E2E health + learning tabs. |
| 2026-09-29 | v3-I | `V3_FINAL_REPORT.md`, docs pass, release_check GO (software). |
| 2026-09-29 | 0–7 | Software build complete. Native Unity on Windows host blocked (no g++). Hardware tests pending user. |

## Phase checklist

- [x] Phase 0 — Environment and skeleton
- [x] Phase 1 — References
- [x] Phase 2 — Firmware core + Gate 1
- [x] Phase 3 — Vision + Gate 2 tooling
- [x] Phase 4 — Brain + Gates 3–5
- [x] Phase 5 — Gate 6 extras
- [x] Phase 6 — Gate 7 agent
- [x] Phase 7 — CI, docs final pass (native tests: CI/Linux only on this machine)

### v3 phases (MASTER_PROMPT_V3.md §14)

- [x] **A** — EPDR skip-native, agent modes, MCP tools, CI sim job
- [x] **B** — Simulator JSON scenarios + fault injection framework
- [x] **C** — Reliability (G8): motor lease, WDT, recovery, health
- [x] **D** — Bring-up wizard, pre-flight, release_check GO
- [x] **E** — Missions, api_version 2, reason codes
- [x] **F** — Confidence zones, agent lessons
- [x] **G** — Learning bandit + model gate
- [x] **H** — E2E expansion (bring-up, health, learning)
- [x] **I** — Final release_check, CHANGELOG, Section 16 report

## Definition of done (software)

- [x] `python -m platformio run -d firmware -e xiao`
- [x] Native tests documented / run in CI (not on this Windows host)
- [x] `agent/`: build + test; mock server; `npm run pack`
- [x] `python -m pytest tools -q`
- [x] `references/` removed; `REFERENCES.md` + `third_party/`
- [x] Section 12 docs present
- [x] All gates: software done; hardware **pending user test**

## Gates

| Gate | Software | Hardware test |
|------|----------|---------------|
| G1 Drive | done | pending user test |
| G2 Vision | done | pending user test |
| G3 Chase | done | pending user test |
| G4 Scoop | done | pending user test |
| G5 Autonomy | done | pending user test |
| G6 Extras | done | pending user test |
| G7 Agent | done | pending user test |

## Known issues

- Host C++ compiler not available on this PC for `pio test -e native`.
- Clap threshold needs hardware tuning.
- Edge Impulse model not shipped; use `FakeDetector` until library is added.
