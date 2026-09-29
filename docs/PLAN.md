# TrashBot build plan

## Progress log

| Date | Phase | Notes |
|------|-------|-------|
| 2026-09-29 | 0 | Environment OK (git, Python 3.14, Node 24, PlatformIO 6.2.0). Skeleton started. |
| 2026-09-29 | 1 | Reference clones, REFERENCES.md, third_party licences, references/ removed. |
| 2026-09-29 | 2–4 | Firmware builds (`xiao`); core + hw + net + brain scaffold; partial API/UI. |
| 2026-09-29 | 3 | Python tools + pytest (5 pass). Agent build + vitest (3 pass). |
| 2026-09-29 | — | Native Unity tests blocked: no host g++ (LLVM install cancelled). |
| 2026-09-29 | 2–6 | Full HTTP API routes; status JSON; event log strings; control-task merge; mock robot; CI workflow; core docs. |
| 2026-09-29 | 3–7 | TESTING/DATASET docs; web UI calibrate; I2S clap; taco COCO export; brain tests; MCP move/turn/scoop; mcpb manifest fix. |

## Phase checklist

- [x] Phase 0 — Environment and skeleton
- [x] Phase 1 — References
- [x] Phase 2 — Firmware core + Gate 1 (software; hardware pending user)
- [x] Phase 3 — Vision + Gate 2 tooling
- [x] Phase 4 — Brain + Gates 3–5 (software)
- [x] Phase 5 — Gate 6 extras (clap I2S, log_report)
- [x] Phase 6 — Gate 7 agent
- [~] Phase 7 — CI present; native tests on Windows still blocked

## Gates

| Gate | Software | Hardware test |
|------|----------|---------------|
| G1 Drive | done (software) | pending user test |
| G2 Vision | done (software) | pending user test |
| G3 Chase | done (software) | pending user test |
| G4 Scoop | done (software) | pending user test |
| G5 Autonomy | done (software) | pending user test |
| G6 Extras | done (software) | pending user test |
| G7 Agent | done (software) | pending user test |

## Known issues

- Host C++ compiler missing for `pio test -e native` (documented in USER_STEPS).
- Native Unity tests need a host C++ toolchain on Windows (`docs/USER_STEPS.md`).
- Clap threshold (`SOUND_TRIGGER_LEVEL`) needs tuning on real hardware.
- Edge Impulse model not included until you export **TrashBot** library.
