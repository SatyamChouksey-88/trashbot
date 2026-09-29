# TrashBot build plan

## Progress log

| Date | Phase | Notes |
|------|-------|-------|
| 2026-09-29 | 0 | Environment OK (git, Python 3.14, Node 24, PlatformIO 6.2.0). Skeleton started. |
| 2026-09-29 | 1 | Reference clones, REFERENCES.md, third_party licences, references/ removed. |
| 2026-09-29 | 2–4 | Firmware builds (`xiao`); core + hw + net + brain scaffold; partial API/UI. |
| 2026-09-29 | 3 | Python tools + pytest (5 pass). Agent build + vitest (3 pass). |
| 2026-09-29 | — | Native Unity tests blocked: no host g++ (LLVM install cancelled). |

## Phase checklist

- [x] Phase 0 — Environment and skeleton
- [x] Phase 1 — References
- [~] Phase 2 — Firmware core + Gate 1 (build OK; API routes incomplete)
- [~] Phase 3 — Vision + Gate 2 tooling (pipeline stub; tools OK)
- [~] Phase 4 — Brain + Gates 3–5 (state machine in core; integration partial)
- [ ] Phase 5 — Gate 6 extras
- [~] Phase 6 — Gate 7 agent (MCP core; mock/evals/mcpb pending)
- [ ] Phase 7 — CI and final pass

## Gates

| Gate | Software | Hardware test |
|------|----------|---------------|
| G1 Drive | pending | pending user test |
| G2 Vision | pending | pending user test |
| G3 Chase | pending | pending user test |
| G4 Scoop | pending | pending user test |
| G5 Autonomy | pending | pending user test |
| G6 Extras | pending | pending user test |
| G7 Agent | pending | pending user test |

## Known issues

- Host C++ compiler missing for `pio test -e native` (documented in USER_STEPS).
- Several HTTP API routes from master prompt not wired yet (mode, move, turn, scoop, estop, calib).
- `taco_subset.py` prepares output but does not fully write COCO splits yet.
