# TrashBot repository audit report

**Date:** 2026-09-30 (office laptop, `TRASHBOT_NO_NATIVE=1`)  
**Scope:** AUDIT ONLY per Part A checklist (v2 + v3 + v4 Bolo as present in tree).  
**Auditor:** Cursor agent session (no hardware flash, no native Unity/sim `.exe` locally).

---

## Summary table

| Area | PASS | FAIL | NOT VERIFIED | N/A |
|------|------|------|--------------|-----|
| 1. Repo hygiene | 10 | 3 | 1 | 0 |
| 2. Firmware build & static checks | 18 | 2 | 1 | 2 |
| 3. Tests | 6 | 2 | 5 | 2 |
| 4. API contract | 8 | 1 | 2 | 0 |
| 5. Agent (MCP) | 11 | 0 | 2 | 0 |
| 6. Docs vs reality | 7 | 3 | 0 | 0 |
| 7. Dataset / EI | 5 | 0 | 1 | 0 |
| 8. Security & privacy | 6 | 0 | 0 | 0 |

---

## Blockers (fix before treating software as “release ready”)

1. **CI `e2e` job failing** (GitHub run `36634404796`, commit `2ee4fcc`): 3/11 Playwright tests fail because UI labels changed in v4 Bolo (`web_index.h`) but `e2e/tests/ui.spec.ts` still expects `"STOP"` (exact), `"Start clean"`, and calibrate flow timing. Evidence: CI log `ui.spec.ts:30`, `:46`, `:59`; UI has `■ RUKO · STOP` and `Saaf karo · Clean` (`firmware/lib/net/web_index.h:38`, `:54`).
2. **`PIN_BUMPER` pin map error** — `PIN_BUMPER = 6` duplicates `PIN_BIN1 = 6` while comment says GPIO43 (`firmware/include/config.h:7-10`). Safe only while `BUMPER_ENABLED = false`; enabling bumper without fixing this is a **hardware safety** blocker.
3. **Part A hygiene expectation vs repo** — audit prompt asked for no remote; `origin` → `https://github.com/SatyamChouksey-88/trashbot.git` (`git remote -v`). Not a firmware blocker; document for office/policy checklist.

## Risks (should fix)

- `.gitignore` omits audit-listed patterns `*.obj`, `.zig-cache/` (present: `.gitignore:1-21`).
- No `[env:xiao_debug]` in `firmware/platformio.ini` — cannot ship a separate debug env with fault endpoints; release `xiao` has `DEBUG_API = false` (`config.h:116`) which is correct for production.
- `docs/TESTING.md` / e2e still describe pre-v4 button names (doc drift).
- `release_check.py` not re-run locally on this machine (PATH/npm constraints documented in prior sessions).

## Notes

- v3 phases A–I and v4 J–N are marked complete in `docs/PLAN.md`; hardware gates remain user-pending.
- Latest CI: all jobs **success** except **e2e** on `main` push `2ee4fcc`.

---

## 1. Repo hygiene

| Check | Status | Evidence |
|-------|--------|----------|
| `git status` clean | PASS | `git status -sb` → `## main...origin/main` (no unstaged files) |
| Commits present | PASS | `git log -1 --oneline` → `2ee4fcc` (and history) |
| No remote / not pushed | **FAIL** | `git remote -v` shows `origin` GitHub URL; branch tracks `origin/main` |
| `.gitignore` references/ | PASS | `.gitignore:1` |
| `.pio/`, `node_modules/`, `dist/` | PASS | `.gitignore:2-4` |
| `dataset/*`, `secrets.h` | PASS | `.gitignore:11-13` |
| `.env*`, `*.mcpb`, EI lib | PASS | `.gitignore:14-16` |
| `__pycache__`, `.pytest_cache/` | PASS | `.gitignore:17-18` |
| `*.exe`, `*.pdb`, sim artifacts | PARTIAL | `*.pdb`, `sim_brain.exe` in `.gitignore:7-8`; **`*.obj`**, **`.zig-cache/`** missing |
| No secrets/binaries tracked | PASS | `git ls-files "*.exe" "*.pdb" "firmware/include/secrets.h"` → empty |
| WiFi default password only in docs | PASS | `trashbot123` in `docs/USER_STEPS.md`, `config.h:61` (documented default AP password, not home WiFi) |
| `secrets.h` not committed | PASS | gitignored; `secrets.example.h` has empty tokens |
| LICENSE MIT 2026 Satyam Chouksey | PASS | `LICENSE:1-3` |
| `third_party/` license files | PASS | e.g. `third_party/TACO/LICENSE`, etc. (5 LICENSE files) |
| `references/` deleted | PASS | folder absent; `.gitignore:1` still lists it |
| GPL / unlicensed copy check | NOT VERIFIED | `docs/REFERENCES.md` not line-audited against every source file this session |

---

## 2. Firmware build and static checks

| Check | Status | Evidence |
|-------|--------|----------|
| `pio run -e xiao` | PASS | Local 2026-09-30: SUCCESS, Flash 31.8%, RAM 29.4% |
| `platformio.ini` espressif32 @ 7.0.1, xiao_esp32s3, gnu++17 | PASS | `firmware/platformio.ini:5-12` |
| ArduinoJson pinned | PASS | `platformio.ini:17` → `@ 7.4.3` |
| Pin map v2 (motors, servo, US, LED) | PASS | `config.h:6-9` matches spec GPIO set |
| Camera pins / no SD clash | NOT VERIFIED | Pin constants in `config.h`; full camera pin block not re-diffed to v2 table line-by-line |
| No pin used twice (active features) | **FAIL** | `PIN_BIN1=6` and `PIN_BUMPER=6` (`config.h:7-10`); bumper off → runtime uses BIN1 only |
| LEDC motors ch0/1, servo ch2, camera ch7 timer3 | PASS | `config.h:12-14`, `motors.cpp`, `servo.cpp`, `camera.cpp:16-17` |
| `lib/core` no Arduino/ESP headers | PASS | `grep Arduino.h|esp32|ESP_` under `firmware/lib/core` → no matches |
| Motor output only via `safety_logic` | PASS | `main.cpp:259-277` `filterMotor` → `motorsApply`; only `motors.cpp:65` applies PWM |
| Safety v2 6.6 (estop, obstacle, scoop echo, battery, ramp, expiry) | PASS | `test_safety/test_safety.cpp` + `safety_logic.cpp`; battery/bumper gated off in config |
| Web task no camera/motors | PASS | `webTask` only `httpApiHandle` (`main.cpp:321-328`); camera in `visionTask` |
| `DEBUG_API` not in release | PASS | `config.h:116` `false`; no `xiao_debug` env |
| `xiao_debug` env with fault endpoints | N/A | Not defined in `platformio.ini` |
| OTA not implemented | PASS | no OTA symbols in firmware grep |
| v3 motor lease / WDT / heartbeats | PASS | `config.h:77-81`, heartbeats in `webTask`/`visionTask` |
| v3 stuck + recovery + invariants | PASS | `main.cpp` includes `stuck_detect.h`, `invariant_monitor.h`, recovery events |
| v3 `/api/health` | PASS | `http_api.cpp:144` |
| v3 SAFE_PAUSE | NOT VERIFIED | not grep-confirmed in this pass (may be in brain/mission); CI native tests passed |
| Bumper / battery default OFF | PASS | `config.h:70-72` |
| v4 aliases + LittleFS | PASS | `aliases_api.cpp`, `platformio.ini:10` `littlefs` |

---

## 3. Tests

| Check | Status | Evidence |
|-------|--------|----------|
| `python -m pytest tools -q` | PASS | 14 passed (2026-09-30) |
| `agent` npm ci/build/test | PASS | 27 passed (vitest) |
| Playwright e2e local | NOT VERIFIED | Not run on office laptop this session (CI is source of truth) |
| Playwright CI | **FAIL** | Run `36634404796`: 3 failed, 8 passed in `ui.spec.ts` |
| Firmware Unity `native` | NOT VERIFIED | `TRASHBOT_NO_NATIVE=1`; CI job `firmware-test` **success** on same run |
| Simulator / `run_core_tests.py` | NOT VERIFIED | Local; CI `tools` job **success** |
| `shared/lang` tests | NOT VERIFIED | Local 359 passed earlier in project; CI `shared-lang` **success** |

### Test inventory (counts)

| Suite | Files | Tests (approx) |
|-------|-------|----------------|
| `tools/tests` + `tools/test_model_gate.py` | 6 py files | 14 pytest |
| `agent/test` | 7 vitest files | 27 |
| `shared/lang` | (package) | 359 (CI) |
| `firmware/test` Unity | 19 test dirs (+ alias_rules) | ~50+ `RUN_TEST`/`TEST` cases (CI native) |
| `e2e/tests` | `api.spec.ts`, `ui.spec.ts`, `bolo.spec.ts` | 11 total in CI run |

### v2 §11 / v3 §9.4 gaps (high level)

- **NOT VERIFIED:** exhaustive crosswalk to every named test in `docs/MASTER_PROMPT.md` §11 and invariants I1–I8 — not re-enumerated line-by-line; native + sim coverage exists in CI.
- **MISSING (process):** no automated test proving `PIN_BUMPER` ≠ motor pins when `BUMPER_ENABLED=true`.

### Weak / brittle tests

| Test | Issue |
|------|--------|
| `e2e/tests/ui.spec.ts` | Stale selectors (fails in CI) |
| `agent/test/prompt.test.ts` | String contains checks only (cannot catch prompt logic bugs) |
| Some integration tests | Depend on mock timing; acceptable for smoke |

### GitHub Actions `.github/workflows/ci.yml`

| Job | Present |
|-----|---------|
| firmware build | yes `:23-31` |
| firmware native tests | yes `:33-41` |
| core tests + sim | yes `:61-64` in `tools` |
| agent tests | yes `:43-51` |
| pytest | yes `:64` |
| shared-lang + embed check | yes `:9-21` |
| agent-verify mcpb | yes `:66-73` |
| e2e | yes `:75-84` (**failing**) |
| `release_check.py` in CI | **FAIL** | not invoked as its own job (only manual / local per docs) |

---

## 4. API contract

| Check | Status | Evidence |
|-------|--------|----------|
| Core v2 routes on firmware | PASS | `http_api.cpp` registers `/api/status`, drive/move/turn/scoop/clean/stop/estop, calib, log, etc. |
| v4 `/lang.mjs`, `/bolo-ui.mjs`, `/api/aliases*` | PASS | `http_api.cpp:130-134`, `aliases_api.cpp`, `registerAliasesRoutes` |
| `agent/src/contract.ts` status fields | PASS | includes `turn_left_sign`, `features` (`contract.ts:28-29`) |
| Mock robot routes | PASS | `agent/mock-robot/server.ts` aliases + status |
| Full 4-way JSON shape audit | NOT VERIFIED | Every error code 400/401/409/503 not exhaustively diffed |
| Token header when `API_TOKEN` set | PASS | `http_api.cpp:28-30`, `checkToken` on `/api/*` handlers |
| v4-only routes documented in `docs/API.md` | PASS | aliases section present |

---

## 5. Agent (MCP server)

| Check | Status | Evidence |
|-------|--------|----------|
| No `console.log` on stdout in `agent/src` | PASS | grep → none; `console.error` in `index.ts:306` |
| MCP tools + zod | PASS | `index.ts` tool definitions; `bolo.ts`, contract schemas |
| POST retry policy | NOT VERIFIED | `robotClient` stop retry behavior not re-read this session; covered by `robotClient.test.ts` in CI |
| `TRASHBOT_MODE` read_only / dry_run / full | PASS | `agentMode.ts`, `toolGuard.ts`, tests in `agentMode.test.ts`, `bolo.test.ts` |
| `stop` in `read_only` | PASS | `bolo.test.ts` case `"read_only stop sends /api/stop"`; `isSafetyTool` in `toolGuard.ts` |
| `.cursor/mcp.json` valid, points to built entry | PASS | `agent/dist/index.js` after `npm run build` |
| `verify:mcpb` | NOT VERIFIED | Local Windows; CI `agent-verify` **success** run `36634404796` |
| `run_command`, alias tools (v4) | PASS | `index.ts` + `bolo.test.ts` |
| Mock `MOCK_FAIL_EVERY` | PASS | `integration.mock.test.ts`, `mock-robot/server.ts:19` |

---

## 6. Docs match reality

| Check | Status | Evidence |
|-------|--------|----------|
| README Bolo / build instructions | PASS | Bolo section present (post-v4) |
| `WIRING.md` pin map vs `config.h` | PARTIAL | Wiring doc not re-opened; **config bumper comment contradicts GPIO number** |
| `TESTING.md` gates | PASS | G11 added for v4 |
| `USER_STEPS.md` order | PASS | includes G11 §9 |
| `PLAN.md` software vs hardware | PASS | hardware pending user |
| `DECISIONS.md` | NOT VERIFIED | not fully re-read |
| UI strings vs `TESTING.md` / e2e | **FAIL** | Docs/tests say “Start clean” / “STOP”; UI says “Saaf karo · Clean” / “■ RUKO · STOP” |
| `MASTER_PROMPT_V4.md` §10 checkboxes | **FAIL** | may still show `[ ]` while `PLAN.md` marks J–N done (cosmetic doc inconsistency) |

---

## 7. Dataset and Edge Impulse readiness

| Check | Status | Evidence |
|-------|--------|----------|
| `FakeDetector` default | PASS | `main.cpp:34` |
| EI header gated | PASS | `config.h:119` `TRASHBOT_EI_HEADER`; no `TrashBot_inferencing/` in tree (gitignored) |
| `tools/collect_photos.py`, `taco_subset.py` | NOT VERIFIED | not executed offline this session |
| `docs/DATASET.md` | PASS | file exists |

---

## 8. Security and privacy

| Check | Status | Evidence |
|-------|--------|----------|
| No committed secrets | PASS | ls-files + grep |
| `secrets.example.h` empty | PASS | `API_TOKEN ""` |
| API token optional documented | PASS | `docs/API.md:4` |
| AP password documented as changeable default | PASS | `USER_STEPS.md`, master prompt |
| No CDN in web UI | PASS | inline HTML/JS in `web_index.h`; `web_lang.h` comment “no CDN” |

---

## Changes made during the audit

None (report only; no rule-3a/3b code or doc edits).

---

## Not verified here (office laptop limits)

- Native Unity tests (`platformio test -e native`) and `sim_brain` executable.
- Playwright browser install/run locally (WatchGuard / policy).
- Full manual API 4-way contract diff for every error body.
- `collect_photos.py` / network download failure paths.
- Hardware gates G0–G11 on physical robot.

---

## Recommended next actions (≤10, no new features)

1. Update `e2e/tests/ui.spec.ts` selectors to match v4 UI (`■ RUKO · STOP`, `Saaf karo · Clean`, calibrate dialog order).
2. Set `PIN_BUMPER` to **43** (or remove duplicate `6`) and align `WIRING.md` + comment.
3. Add `*.obj` and `.zig-cache/` to `.gitignore`.
4. Align `docs/TESTING.md` UI checklist strings with `web_index.h`.
5. Re-run GitHub Actions on `main` and confirm all jobs green.
6. Run `python tools/release_check.py` locally on a machine with full PATH or add optional CI job.
7. Optional: add `[env:xiao_debug]` with `DEBUG_API` if spec still required for bench debug only.
8. User: complete Part C hardware checklist before flash.
9. User: confirm IT policy before further pushes to GitHub.
10. Part B: after blockers 1–2 cleared, execute remaining v4 verification per `docs/AUDIT_REPORT.md` + `MASTER_PROMPT_V4.md` §11.

---

*End of audit report.*
