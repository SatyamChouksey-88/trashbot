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

## Phase checklist

- [x] Phase 0 — Environment and skeleton
- [x] Phase 1 — References
- [x] Phase 2 — Firmware core + Gate 1 (software; hardware pending user)
- [~] Phase 3 — Vision + Gate 2 tooling (pipeline OK; DATASET.md/testing partial)
- [~] Phase 4 — Brain + Gates 3–5 (integrated; scenario tests thin)
- [~] Phase 5 — Gate 6 extras (sound stub, log_report OK)
- [~] Phase 6 — Gate 7 agent (mock + tools; mcpb pack manual verify)
- [~] Phase 7 — CI workflow added; final README/USER_STEPS pass partial

## Gates

| Gate | Software | Hardware test |
|------|----------|---------------|
| G1 Drive | done (software) | pending user test |
| G2 Vision | pending | pending user test |
| G3 Chase | pending | pending user test |
| G4 Scoop | pending | pending user test |
| G5 Autonomy | pending | pending user test |
| G6 Extras | pending | pending user test |
| G7 Agent | done (software) | pending user test |

## Known issues

- Host C++ compiler missing for `pio test -e native` (documented in USER_STEPS).
- `taco_subset.py` does not yet write full COCO train/test splits.
- Native Unity tests need a host C++ toolchain on Windows.
- I2S clap-to-start is stubbed; sound task runs but does not trigger yet.
- `npm run pack` / `.mcpb` should be verified locally after `npm run build`.
