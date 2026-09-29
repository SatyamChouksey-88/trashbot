# Tools

Python and helper scripts for dataset prep, simulation, release gates, and firmware embed checks.

| Script | Purpose |
|--------|---------|
| `common.py` | Shared image crop/bbox helpers for dataset and vision tooling |
| `collect_photos.py` | Capture or organize training photos for Edge Impulse (offline-safe) |
| `taco_subset.py` | Download/prepare TACO annotation subsets for experiments |
| `log_report.py` | Summarize firmware event logs from exported JSON |
| `make_placeholder_jpeg.py` | Generate mock robot JPEG bytes for `agent/mock-robot/placeholder.ts` |
| `embed_lang.py` | Build `firmware/lib/net/web_lang.h` from Bolo JS (`--check` in CI) |
| `release_check.py` | Local GO/NO-GO gate (firmware, pytest, agent, shared/lang; respects `TRASHBOT_NO_NATIVE`) |
| `run_core_tests.py` | Run zig/native core tests (CI; skipped on restricted dev machines) |
| `model_gate.py` | Model quality thresholds for CI dataset gate |
| `eval_model.py` | Offline model metrics helper |
| `native_env.py` | Detect whether native test binaries are allowed on this host |
| `sim/run.py` | Digital-twin episode runner; writes `docs/reports/sim_latest.md` |
| `sim/build_sim_brain.py` | Build simulator binary (CI) |

Tests live in `tools/tests/` (pytest). Run: `python -m pytest tools/tests -q` from the repo root.
