# TrashBot — Upgrade Prompt v3 for Cursor (Agent mode)

**Extends v2. Same zero-questions rules. Office-laptop safe.**

This document upgrades the existing TrashBot repository. `docs/MASTER_PROMPT.md` (v2) stays the base: everything in it still applies unless this document changes it. First save this file verbatim as `docs/MASTER_PROMPT_V3.md`, add "v3 active" at the top of the progress log in `docs/PLAN.md`, then execute Section 14 phase by phase.

---

## 0. Rules (in addition to v2 Section 0)

1. **Never ask me anything.** Never wait for approval. Never end a message with a question. When something isn't specified, decide with the v2 priority order (safety → fits the hardware → simplest → cheapest → easiest to test) and record it in `docs/DECISIONS.md`.
2. **Office laptop:** no admin rights, no installers, no WSL, no Claude Desktop. Use only pip (user install or a venv), project-local npm, PlatformIO and Cursor. If something needs admin rights, skip it, write the alternative in `docs/USER_STEPS.md`, and continue.
3. **Already done?** If an item exists from an earlier round, verify it against this spec, fill the gaps, and don't redo it.
4. **Every new feature follows the Feature Template (Section 2).** No exceptions.
5. **Safety is never learned, tuned by profiles, or relaxed by the agent.** Hard limits live in `config.h` and are enforced in firmware.

---

## 1. Goals of v3

- **First-run success:** bugs show up in simulation and tests before hardware; wiring and orientation mistakes are caught by a bring-up wizard instead of a debugging session.
- **Safe failure:** anything that goes wrong ends in a safe, explained state — motors stopped, reason logged.
- **Learning from mistakes:** the robot, the agent and the vision model each improve from **confirmed** mistakes, within guardrails.
- **Easy extension:** new features plug in behind flags, with tests, simulation scenarios and docs.

---

## 2. Feature Template (for every feature, now and in future)

A feature is done only when it has all of these:
1. A config flag or value in `config.h` (experimental features default **off**).
2. Pure logic in `lib/core` with unit tests, plus at least one property test if it can affect motion.
3. A simulation scenario (`tools/sim/scenarios/*.json`) covering the happy path and at least one failure path.
4. Events with **reason codes** (Section 6.2), so every decision is explainable in the log.
5. API changes are additive: new fields only; any rename/removal bumps `api_version` in `/api/status`. Update `docs/API.md`, `agent/src/contract.ts` and the contract tests together.
6. Docs: rows in `docs/TESTING.md`, and steps in `docs/USER_STEPS.md` if a human is involved.

Copy this template into `AGENTS.md`.

---

## 3. Office-laptop setup and fix-ups (Phase A)

1. **Cursor is the agent client.** Add `.cursor/mcp.json`:
   ```json
   {
     "mcpServers": {
       "trashbot": {
         "type": "stdio",
         "command": "node",
         "args": ["${workspaceFolder}/agent/dist/index.js"],
         "env": { "TRASHBOT_URL": "http://localhost:8787", "TRASHBOT_MODE": "dry_run" }
       }
     }
   }
   ```
   `docs/AGENT.md`: Cursor is the main path (enable the server in Cursor's MCP settings, start the mock, run the `clean_room` prompt). Claude Desktop becomes an optional section for a personal machine.
2. **Fix the `.mcpb` for later use:** bundle all runtime dependencies into `dist/index.js` with esbuild, name the output `trashbot.mcpb`, and add `npm run verify:mcpb` (unpack into a temp folder, start it against the mock, check MCP `initialize` + `tools/list` over stdio).
3. **Core tests without admin rights:** `python -m pip install ziglang`. Add `tools/run_core_tests.py`: compile every `firmware/test/*` suite with `python -m ziglang c++ -std=c++17` against `firmware/lib/core` and a vendored Unity (MIT, `firmware/test/unity/` with its licence), run each executable, print a summary, exit non-zero on failure. Keep the PlatformIO `native` job in CI.
4. **Finish v2 Section 11:** the missing brain scenarios (STOP and ESTOP from every state, MANUAL command expiry, full 360° search → forward step, camera unavailable → DONE, time and item limits) and the missing agent tests (robot offline, timeout, bad JSON, token header, `take_photo` data starts with FF D8, stop retries, contract check of every mock route, `MOCK_FAIL_EVERY` shows `item_failed`).
5. **Mock robot serves the real web UI** at `/` by reading the HTML from `firmware/lib/net/web_index.h` (one source of truth).
6. **Agent reconnects:** the MCP server retries robot connections with backoff (0.5 s, 1 s, 2 s, max 5 s) and reports "robot offline" clearly instead of crashing.

---

## 4. Reliability layer (Gate G8)

### 4.1 Motor lease failsafe — most important
`hw/motors` owns an `esp_timer` callback every 50 ms. `controlTask` renews a "motor lease" every cycle. If the lease is older than `MOTOR_LEASE_MS` (200 ms), the callback sets both PWM duties to 0 and emits `motor_lease_expired`. This stops the motors **even if `controlTask` hangs**. Keep brownout detection enabled.

### 4.2 Watchdog and heartbeats
- `esp_task_wdt` on `controlTask` (2 s) and `visionTask` (5 s).
- Every task writes a heartbeat timestamp into `shared_state`. `controlTask` checks them: vision stale for > `VISION_HEARTBEAT_MS` → vision is unavailable (auto → SAFE_PAUSE → DONE with reason `vision_unavailable`); web or sound stale → event only.
- Events: `task_timeout {task}`. The last reset reason (`esp_reset_reason`) is reported in health.

### 4.3 Stuck / no-progress detection (no extra hardware)
- `visionTask` computes `motion_score`: the mean absolute difference between consecutive 96×96 grayscale frames (0–255), published with each detection batch.
- **Stuck** when, for ≥ `STUCK_TIME_MS`: a forward command ≥ `STUCK_MIN_CMD_PCT` is active AND `motion_score` < `STUCK_MOTION_MAX` AND (ultrasonic invalid OR distance decreased by less than `STUCK_MIN_PROGRESS_CM`). The same motion test applies while turning.
- Emits `stuck_detected` and hands over to the Recovery Manager.

### 4.4 Recovery Manager (refactor)
New pure module `core/recovery.{h,cpp}`. It replaces the ad-hoc AVOID, BACKUP and REACQUIRE handling: the State enum gets `RECOVERY` and `SAFE_PAUSE`, and the old names become recovery **steps** (they still appear in events and in status as `recovery: {reason, step, attempt}`). Update existing tests accordingly.

| Failure reason | Escalation ladder (one step per attempt) |
|---|---|
| `target_lost` | re-scan ±20° → re-scan ±45° → give up this target (`item_skipped`) |
| `obstacle` | back up 10 cm → turn 90° (alternate sides) → turn 180° → safe stop |
| `stuck` | stop → back up 15 cm → turn 60° → back up 15 cm + turn 120° → safe stop |
| `scoop_failed` | back up 10 cm + re-approach → switch scoop recipe (8.1) + re-approach → mark `item_failed` |
| `vision_unavailable` | wait 2 s and re-initialise the camera once → safe stop |
| `bumper` | stop → back up 10 cm → turn 90° → continue with the `obstacle` ladder |
| `sensor_invalid` (ultrasonic) | slow mode (speed cap 25 %) for 10 s → safe stop if still invalid |

Limits: `RECOVERY_MAX_ATTEMPTS` per reason per item, `RECOVERY_TIMEOUT_MS` per episode, `RECOVERY_MAX_PER_SESSION`. Exceeding any limit → safe stop → mission ends with a `termination_reason`. Events: `recovery_started {reason, step}`, `recovery_success`, `recovery_failed`.

### 4.5 SAFE_PAUSE (extensible safety hook)
- **Triggers:**
  - sudden distance drop (more than `SUDDEN_DROP_CM` within 200 ms) to under 30 cm;
  - motion in view while the robot is standing still (`motion_score` > `MOTION_WHILE_STILL`) — something is moving in front of it, possibly a person or pet;
  - chip temperature > `OVERTEMP_C`;
  - battery critical (if the monitor is enabled);
  - repeated recovery failures;
  - health CRITICAL.
- **Action:** stop, scoop to CARRY, wait `SAFE_PAUSE_MS`, re-check. Still triggered after `SAFE_PAUSE_MAX` times → DONE with a reason.
- Document it honestly as a **motion heuristic, not person or pet detection**.

### 4.6 Health
- `GET /api/health` → `{overall: "OK" | "DEGRADED" | "CRITICAL", checks: [{name, status, value, detail}]}`.
- Checks: psram, minimum free heap, camera, detector (model or fake), vision fps, ultrasonic valid rate, servo, motor lease, wifi, temperature, battery (if enabled), task heartbeats, watchdog/reset reason, uptime, last error.
- CRITICAL blocks auto mode: `/api/clean` returns 409 with the failed checks. Add a Health tab to the web UI.

### 4.7 Runtime invariant monitor (tripwire)
After the safety filter in `controlTask`, check:
- motor output ≤ cap;
- ESTOP ⇒ motors 0;
- obstacle closer than the stop distance ⇒ no forward motion;
- expired manual command ⇒ motors 0;
- SAFE_PAUSE / DONE / IDLE ⇒ motors 0.

A violation causes immediate motors 0 + ESTOP + event `invariant_violation {id}`. It should never fire; it exists to catch bugs.

### 4.8 Hardware extras (config flags, default off)
- **Front bumper microswitch on D6** (GPIO43, `INPUT_PULLUP`). Wire the switch to GND through a 1 kΩ series resistor, because this pin prints the boot log. A press = failure reason `bumper`.
- **Battery monitor:** 100 kΩ / 33 kΩ divider on D2. Recommend a 2S Li-ion protection (BMS) board in `WIRING.md` and `USER_STEPS.md`.

---

## 5. First-run success (new Gate G0, before G1)

### 5.1 Boot self-test (POST)
Runs on every boot, takes ≤ 3 s, never moves the motors. Checks: PSRAM, NVS, camera init + one frame + sensor ID, detector init, ultrasonic sanity (≥ 3 valid echoes or an explicit "no echo"), servo attached, WiFi up, reset reason. Results go into `/api/health` and the serial banner.

### 5.2 Bring-up wizard
A web UI tab "Bring-up", MANUAL mode only, with the robot on a box so the wheels are in the air. Step by step, with Yes/No buttons:
1. Pulse the left wheels forward (300 ms at 30 %). "Did the LEFT wheels spin FORWARD?" No → flip the left invert flag; "the right side moved" → set the swap-sides flag. Repeat for the right side.
2. Servo: move to DOWN / CARRY / TIP slowly with sliders, then save.
3. Ultrasonic: place a box at 30 cm and compare the reading (pass if within ±3 cm).
4. Camera: show a snapshot. "Is the image upright?" No → set the flip/mirror flags.
5. Scoop zone: place a paper ball in the ideal spot → save the zone.
6. Summary → saved as the active profile, plus a `bringup_done` flag.

Motor invert and swap flags move from `constexpr` to calibrated NVS values (defaults still come from `config.h`). Until bring-up is done, the Auto tab shows a warning and `/api/clean` returns 409.

### 5.3 Pre-flight check before every auto session
Health is not CRITICAL, bring-up is done, calibration is present, battery is OK (if enabled). Otherwise `/api/clean` returns 409 listing the failed checks.

### 5.4 Release discipline
- `tools/release_check.py` runs everything: firmware build, core tests, property tests, pytest, simulation suite, agent tests, `verify:mcpb`, and e2e against the mock. It prints **GO** or **NO-GO**.
- `USER_STEPS.md`: flash only on GO.
- Bump `FW_VERSION` per release and keep `CHANGELOG.md`.

---

## 6. Missions, explainability, profiles

### 6.1 Missions
- Every auto session is a mission with `mission_id = "TB-<boot_count>-<n>"`. `boot_count` lives in NVS. The board has **no real-time clock**: record uptime, and add wall-clock time only if NTP syncs in station mode.
- Mission record: `{mission_id, goal ("clean" | "agent:<text>"), label, started_uptime_ms, duration_s, items_detected, items_collected, items_failed, items_skipped, recoveries, termination_reason, recipe_stats}`.
- `termination_reason` is one of: `completed`, `time_limit`, `item_limit`, `stopped`, `estop`, `safe_stop`, `vision_unavailable`, `low_battery`, `health_critical`.
- Keep the last `MISSION_HISTORY` missions in LittleFS (`missions.jsonl`, rotated).
- API: `GET /api/mission/current`, `GET /api/mission/history`.
- A mission started by the agent runs entirely on the robot within its limits. If the agent or laptop disconnects, the robot finishes safely on its own.

### 6.2 Reason codes (decision log)
Extend `Event` with a `reason` code. Every decision that changes state logs why:
- target chosen `{score, x, y, zone}`;
- target skipped `{uncertain | protected | unreachable}`;
- recovery step `{reason, step}`;
- safe pause `{trigger}`;
- learning update `{recipe, old, new}`.

The web UI Log tab shows a readable reason text for each event.

### 6.3 Profiles
- Three NVS slots: `tile`, `carpet`, `custom`. Each holds calibration plus tunables: motor max, speeds, detection thresholds, obstacle distance, recipe stats.
- Profiles can never go past the hard bounds in `config.h` (e.g. `OBSTACLE_STOP_CM ≥ OBSTACLE_STOP_CM_MIN`, `MOTOR_MAX_DUTY ≤ MOTOR_MAX_DUTY_MAX`).
- API: `GET /api/profile`, `POST /api/profile`, `POST /api/profile/load`.
- UI: a dropdown with Save / Load / Reset defaults.

### 6.4 API version
Add `api_version` (start at 2) to `/api/status`.

---

## 7. Decision model and agent safety

### 7.1 Confidence zones (on the robot)
Scores are split into three zones:
- below `CONF_IGNORE_BELOW` (0.50): ignore;
- up to `CONF_CONFIDENT_AT` (0.75): uncertain;
- 0.75 and above: confident.

Behaviour without the agent:
- confident → collect;
- uncertain → approach until the target reaches `RECHECK_Y` in the image, then re-check (up to `MAX_RECHECKS` times);
- still uncertain → skip with reason `uncertain_skip`, and capture the frame as a mistake candidate (8.2).

In agent mode, uncertain targets are left for the agent to judge from a photo.

### 7.2 TRASH / KEEP / UNKNOWN (agent side)
- **UNKNOWN is never scooped**; the agent asks the user.
- Protected list (always KEEP): phone, wallet, keys, earphones, cables, chargers, documents, money, medicine, jewellery, remote, toys, pet items, clothing, electronics.
- Put both in the `clean_room` prompt and in `docs/AGENT.md`.

### 7.3 Agent modes and dry run (MCP server)
- `TRASHBOT_MODE` = `read_only` | `dry_run` | `full` (default `dry_run`):
  - `read_only`: only `get_status`, `take_photo`, `get_events`, `get_health`, `get_mission`, `get_lessons`.
  - `dry_run`: motion tools return "DRY RUN — would do …" without calling the robot.
  - `full`: every tool works.
- New tools: `plan_cleaning`, `estop`, `get_health`, `get_mission`.
- `plan_cleaning` returns a photo, the robot's detections with confidence zones, and the lessons that apply. The agent presents a plan ("collect 3, leave 1 unknown — the robot will NOT move") before anyone switches to `full`.
- Cursor's own tool-approval prompts stay on.

---

## 8. Self-improvement: learning from mistakes (Gate G9)

**Principle:** learn only from **confirmed** outcomes, only within **pre-approved bounds**. Every change is **logged and reversible**, and safety is **never** learned.

### 8.1 Robot level — scoop recipe learning (automatic, on the robot)
- A **scoop recipe** = `{creep_cm ∈ {10, 12, 14, 16}, creep_speed ∈ {25 %, 35 %}, align_tolerance ∈ {0.04, 0.07}}`. That's 16 recipes, all pre-approved as safe.
- After each VERIFY, the camera check confirms success or failure. Update per-profile stats `{tries, successes}` in NVS.
- **Selection:** epsilon-greedy. First try every recipe once (round-robin), then use the best success rate, exploring a random recipe with probability `BANDIT_EXPLORE` (10 %). Use a seeded RNG in `core` so tests are deterministic.
- Events: `learning_update {recipe, successes, tries}`. A web UI "Learning" panel shows the table and a **Reset learning** button.
- **Sim test:** over 300 simulated scoops where recipes have different success probabilities, the learner's success rate reaches ≥ 90 % of the best recipe's and beats a fixed default recipe.

### 8.2 Robot level — mistake capture
- Keep the last `MISTAKE_RING` "mistake frames" in PSRAM: JPEG + metadata `{mission_id, reason: scoop_failed | uncertain_skip | user_flag | target_lost, detections, recipe}`.
- API:
  - `GET /api/mistakes` — metadata list;
  - `GET /api/mistakes/<id>.jpg` — the frame;
  - `DELETE /api/mistakes` — clear after download;
  - `POST /api/mistakes/flag {"note": "..."}` — the user or agent flags the current frame (e.g. "that was not trash"). Add a web UI button "That was not trash".
- `tools/mistakes_pull.py` downloads them into `dataset/mistakes/<date>/` with metadata JSON.

### 8.3 Model level — retrain with a regression gate (human-approved)
- **Data pipeline:** `USER_STEPS.md` documents uploading mistake frames with the Edge Impulse CLI (project-local npm, API key supplied by me), using Edge Impulse's Data explorer and assisted labelling for outliers, and retraining.
- **On-robot evaluation endpoint:** only in a `xiao_debug` env (`DEBUG_API=1`), never in the release `xiao` build. `POST /api/debug/detect` with a JPEG (multipart, ≤ 40 KB) runs the exact robot pipeline (decode → crop → resize → detect) and returns detections as JSON.
- **`tools/eval_model.py`:** sends a fixed, labelled test set (`dataset/test_fixed/`, never used for training) to the robot and computes:
  - precision, recall, F1;
  - **false-trash rate on KEEP items** — the most important number;
  - latency.

  It writes `docs/models/<model_version>.md` and appends a row to `docs/MODEL_HISTORY.md`.
- **`tools/model_gate.py`:** accept a new model only if F1 ≥ the previous F1, false-trash rate ≤ previous, latency ≤ previous + 20 %, and the simulation scenario pass rate doesn't drop. Otherwise keep the old model. Keep previous exported libraries under `dataset/models/` (gitignored) for rollback.
- **Model version:** compile it in (Edge Impulse's deploy-version macro if present, else `MODEL_VERSION`) and show it in `/api/status`.

### 8.4 Agent level — lessons memory (laptop)
- **Storage:** `agent/memory/lessons.json` (gitignored except an example file). Each lesson: `{id, created, last_seen, count, mistake, correction, evidence: {mission_id?, photo_path?, user_confirmed}}`.
- **MCP tools:**
  - `get_lessons`;
  - `record_lesson {mistake, correction, evidence}`;
  - `record_user_correction {object_description, correct_label: TRASH | KEEP | UNKNOWN, note}`.
- Lessons without evidence or user confirmation are stored as **unconfirmed** and never applied automatically.
- **MCP resource** `trashbot://lessons`.
- **Update `clean_room`:**
  - start by reading lessons and apply only the confirmed ones;
  - end every mission by reviewing events and mistakes;
  - record 0–3 lessons, each with evidence.
- **Test:** in a scripted mock mission, a confirmed lesson marks "white cable-like object" as KEEP, and `plan_cleaning` excludes that object.

---

## 9. Simulation, fault injection, invariants (Gate G10)

### 9.1 Simulator (`tools/sim/`)
- **`sim_brain`:** a command-line program built with zig from `lib/core` (vendored nlohmann/json, MIT, for the runner only). It reads one `BrainInput` as JSON per line on stdin and writes one `BrainOutput` per line — so the simulator runs the robot's **real** brain code.
- **Python simulator** (numpy + matplotlib only) models:
  - a 4 m × 3 m room;
  - a differential-drive robot using the calibrated speeds;
  - walls for the ultrasonic, and the bumper;
  - paper balls and KEEP objects;
  - a camera with field of view, noise, dropped frames, about 7 fps and per-object confidence;
  - scoop success probability per recipe;
  - `motion_score` (0 when stuck);
  - a battery.

### 9.2 Scenarios (`tools/sim/scenarios/*.json`)
`basic_clean`, `obstacle_ahead`, `corner_trap`, `stuck_against_wall`, `scoop_failure_repeated`, `target_lost`, `unknown_object_nearby`, `keep_item_next_to_trash`, `low_battery`, `camera_timeout`, `overtemp`, `bumper_hit`, `motion_while_still`, `sensor_lag`, `long_mission_100_items`, `learning_bandit`.

### 9.3 Fault injection
- **In the simulator:** each scenario can list `faults: [{at_s, type, duration_s}]`. Types:
  - camera and detector: `camera_failure`, `camera_timeout`, `detector_timeout`;
  - bad detections: `stale_detection`, `duplicate_detection`, `sensor_lag` (detections delayed 0.5–1.5 s);
  - hardware: `ultrasonic_invalid`, `servo_stuck`, `motor_no_response` (→ stuck), `low_battery`, `overtemp`;
  - mission events: `target_disappears`, `scoop_failure`.
- Each scenario has **expected** assertions, e.g. `{"no_uncontrolled_motion": true, "events": ["vision_unavailable"], "final_state": "DONE", "termination_reason": "vision_unavailable"}`.
- **Bad commands:** agent tests send malformed or out-of-range tool arguments and raw bad JSON to the robot API (and the mock). Both must reject them (400) with no motion.
- **On hardware** (`xiao_debug` only): `POST /api/debug/fault {type, duration_ms}` for `camera_timeout`, `detector_timeout`, `ultrasonic_invalid`, `low_battery`, `scoop_failure`, `target_disappears`. The mock implements the same endpoint.

### 9.4 Property / invariant tests
Randomised with fixed seeds, ≥ 10,000 cases each, in the core tests:
- **I1** motor output ≤ cap.
- **I2** ESTOP ⇒ 0.
- **I3** forward command + obstacle closer than the threshold ⇒ no forward motion.
- **I4** UNKNOWN / uncertain target ⇒ no scoop.
- **I5** expired manual command ⇒ 0.
- **I6** vision unavailable in auto ⇒ SAFE_PAUSE or DONE within 1 s.
- **I7** random command sequences (fuzzed through the command queue + brain + safety) never produce motion that bypasses safety.
- **I8** learning never selects a recipe outside the approved set, and profiles never exceed hard bounds.

### 9.5 Reports
- `python tools/sim/run.py --suite all --runs 20` writes `docs/reports/sim_latest.md`: the pass rate per scenario and a **fault matrix** (fault × expected response × pass).
- It also saves a GIF of `basic_clean` to `docs/media/` and shows it in the README.

---

## 10. Playwright E2E (UI + API, hardware-ready)

- `e2e/` with `@playwright/test` (Chromium only). `baseURL` comes from `TRASHBOT_URL`: the mock by default, the real robot later.
- **Tests:**
  - hold-to-drive cadence, and stopping on release;
  - STOP, and ESTOP + reset;
  - Auto start/stop with counters updating;
  - Calibrate and Bring-up wizard flows;
  - Health tab statuses;
  - Learning panel and its reset;
  - Camera overlay;
  - Log reason text;
  - profile save/load;
  - phone viewport;
  - API contract tests;
  - fault-injection tests via `/api/debug/fault`, checking the expected safety response.
- Tag wheels-in-the-air-safe tests `@hil` so the same suite later runs against the robot: `npx playwright test --grep @hil`.
- Add a CI job.

---

## 11. References round 2

Clone each into `references/` (`--depth 1`), read, write notes into `docs/REFERENCES.md` (commit, licence, what we learned, where it applies), then delete `references/` again. **Verify each actual LICENSE file.** Copy code only from MIT / Apache-2.0 repos, with attribution. Everything else is ideas only, in your own words.

| Repository | Licence (as seen) | Use |
|---|---|---|
| https://github.com/Tiny-Prism-Labs/ESP32-S3_MultiImpulse | Apache-2.0 | Keyword spotting + FOMO together on this exact board (ESP-IDF 4.4, Edge Impulse multi-impulse) → write `docs/FUTURE_VOICE.md` ("TrashBot, clean" wake word). Not implemented in v3. |
| https://github.com/mpous/xiao-esp32s3-camera-edgeimpulse | none found → ideas only | Exact-board Edge Impulse workflow and PSRAM notes → improve `DATASET.md` |
| https://github.com/WAH-ISHAN/smart-trashcan-server | unclear → ideas only | Same pipeline shape (QVGA → 96×96 FOMO, AP web UI with box overlay, vision/motion split) → validation notes |
| https://github.com/neyamulhasan/Automatic-Garbage-Collector-with-Live-Image-Detection-using-ESP32 | **GPL-3.0 → ideas only, never copy code** (it would force GPL on our MIT project) | Comms-loss failsafe, collection mechanism ideas |
| https://github.com/HamzaYslmn/esp-bridge-mcp-robot | check the file → ideas only unless MIT/Apache | Pre-approved vs permission-required tools, desktop emulator, self-healing reconnect → compare with our agent |
| https://github.com/robotmcp/ros-mcp-server | Apache-2.0 | Tool design for robot state discovery and monitoring; note that its permissions are still planned (ours exist) |
| https://github.com/jonajoy142/embodied-agent-chaos | none found → ideas only | Fault classes for LLM-driven robots (sensor lag, grip slip, unreachable targets, corrupted planner output) → mapped into 9.3 |
| https://github.com/madou003/ESP32_TrashAI | MIT | Classification on a classic ESP32 at about 2 s per image → note in `DECISIONS.md` why FOMO detection fits a moving robot better |
| https://github.com/bhoke/FOMO | MIT | FOMO in Keras (MobileNetV2/V3, MobileViT) → `docs/FUTURE_MODEL.md` for training outside Edge Impulse |
| https://github.com/San279/object-detect-FOMO-stream-Esp32 and https://github.com/San279/train-object-detect-FOMO-esp32 | check the files | FOMO streaming and training tips → `DATASET.md` |

Skip https://github.com/abdullah-engg/Smart-Waste-Segregation (its ML runs on a Raspberry Pi with a fixed sorting bin — not our architecture); mention it in one line.

---

## 12. New config values (add to `config.h` with units and bounds)

| Group | Name | Value |
|---|---|---|
| Motor lease + watchdog | `MOTOR_LEASE_MS` | 200 |
| | `CONTROL_WDT_S` | 2 |
| | `VISION_WDT_S` | 5 |
| | `VISION_HEARTBEAT_MS` | 1500 |
| Stuck detection | `STUCK_MIN_CMD_PCT` | 20 |
| | `STUCK_TIME_MS` | 2500 |
| | `STUCK_MOTION_MAX` | 4.0 |
| | `STUCK_MIN_PROGRESS_CM` | 3 |
| Recovery | `RECOVERY_MAX_ATTEMPTS` | 3 |
| | `RECOVERY_TIMEOUT_MS` | 15000 |
| | `RECOVERY_MAX_PER_SESSION` | 10 |
| Safe pause | `SUDDEN_DROP_CM` | 25 |
| | `MOTION_WHILE_STILL` | 12.0 |
| | `OVERTEMP_C` | 80 |
| | `SAFE_PAUSE_MS` | 5000 |
| | `SAFE_PAUSE_MAX` | 3 |
| Confidence | `CONF_IGNORE_BELOW` | 0.50 |
| | `CONF_CONFIDENT_AT` | 0.75 |
| | `RECHECK_Y` | 0.55 |
| | `MAX_RECHECKS` | 2 |
| Learning + history | `BANDIT_EXPLORE` | 0.10 |
| | `MISTAKE_RING` | 20 |
| | `MISSION_HISTORY` | 20 |
| Hard bounds (nothing may exceed them) | `OBSTACLE_STOP_CM_MIN` | 12 |
| | `MOTOR_MAX_DUTY_MAX` | 80 |
| | `SPEED_MAX_PCT` | 80 |
| Feature flags (default off) | `BUMPER_ENABLED`, `BATTERY_MONITOR_ENABLED`, `LEARNING_ENABLED`, `DEBUG_API` | off |

---

## 13. Gates (v3)

| Gate | Goal | Software pass (you) | Hardware pass (me) |
|---|---|---|---|
| **G0 Bring-up** | POST + wizard | POST unit tests; wizard e2e tests | Wizard completes; all checks green |
| G1–G7 | As in v2 | As in v2 | As in v2 |
| **G8 Reliability** | Motor lease, watchdog, stuck detection, recovery, safe pause, health, tripwire | All reliability scenarios + fault matrix pass; invariant tests pass | Wheels blocked → stuck → recovery; camera unplugged → safe stop; bumper test |
| **G9 Learning** | Recipe learning, mistake capture, eval + gate, agent lessons | Bandit sim test; lessons mock test; eval/gate scripts unit-tested | Scoop success improves across 3 missions; model v2 passes the gate |
| **G10 Sim & release** | Sim suite, fault injection, e2e, release check | `release_check.py` → GO | `@hil` e2e pass on the robot |

---

## 14. Phases (commit after each)

- **A.** Office-laptop setup and fix-ups (Section 3), plus references round 2 (Section 11).
- **B.** Simulator, scenarios and the fault-injection framework (9.1–9.3).
- **C.** Reliability layer (Section 4) and invariant tests (9.4).
- **D.** First-run success: POST, bring-up wizard, pre-flight check, `release_check.py` (Section 5).
- **E.** Missions, reason codes, profiles, `api_version` (Section 6).
- **F.** Decision model: confidence zones, TRASH/KEEP/UNKNOWN, agent modes, dry run, new tools (Section 7).
- **G.** Learning loop (Section 8).
- **H.** Playwright E2E and CI jobs (Section 10).
- **I.** Final pass:
  - run `tools/release_check.py`;
  - update the README (v3 features, sim GIF, reports);
  - update `PLAN.md` (G0–G10), `USER_STEPS.md` (G0 → G10) and `CHANGELOG.md`;
  - final report.

---

## 15. MUST NOT (in addition to v2 Section 14)

- Let profiles, learning or the agent move any safety limit past its hard bound.
- Ship `DEBUG_API` or fault-injection endpoints in the release `xiao` build.
- Implement OTA updates. They're out of scope: USB flashing only. Record this in `DECISIONS.md`.
- Claim person or pet detection. SAFE_PAUSE is a motion heuristic.
- Apply unconfirmed lessons automatically.
- Put training data into `dataset/test_fixed/`.
- Copy code from GPL or unlicensed repos.
- Make the robot's safety depend on the laptop, the agent or WiFi.

---

## 16. Definition of done (v3)

- [ ] Every v2 definition-of-done item is still true.
- [ ] `tools/release_check.py` → GO, listing everything it ran.
- [ ] Core tests via zig pass (counts); property tests pass (case counts).
- [ ] `docs/reports/sim_latest.md` exists; every fault-matrix row passes.
- [ ] E2E passes against the mock (counts).
- [ ] `verify:mcpb` passes; `.cursor/mcp.json` starts the server.
- [ ] Docs updated: `API.md` (api_version 2), `TESTING.md` (G0, G8–G10), `USER_STEPS.md`, `AGENT.md` (modes, dry run, lessons), `MODEL_HISTORY.md` template, `FUTURE_VOICE.md`, `FUTURE_MODEL.md`, `CHANGELOG.md`, `REFERENCES.md` (round 2).
- [ ] `git status` clean, one commit per phase.

## 17. Final report
Use the v2 Section 16 format, and add:
- the fault matrix summary;
- the learning results (bandit sim numbers);
- the list of feature flags and their defaults;
- anything left for me, in order.

The office laptop's security software (WatchGuard EPDR) blocks every new .exe we build, including the zig-compiled test programs. New rules on this machine:
1. Do not build or run any native executable here (no zig or g++ test binaries, no sim_brain.exe). Delete the existing test .exe, .pdb and .obj files and add their build folder to .gitignore.
2. Add an environment switch TRASHBOT_NO_NATIVE=1 (document that I set it on this laptop). With it set, tools/run_core_tests.py, the simulator and release_check.py skip native steps with a clear "runs in CI or on a personal machine" message instead of failing.
3. Make sure the GitHub Actions workflow runs the core C++ tests and the simulator suite, so nothing is lost.
4. Keep doing everything else here: PlatformIO firmware build, pytest, agent npm build and tests.
5. Playwright: try the browser install once. If the security software blocks it, skip e2e locally and keep it in CI only. Never retry blocked programs.
6. Record all of this in docs/DECISIONS.md and docs/USER_STEPS.md, then continue with v3.
