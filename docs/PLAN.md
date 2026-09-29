# TrashBot build plan

## Progress log

| Date | Phase | Notes |
|------|-------|-------|
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
