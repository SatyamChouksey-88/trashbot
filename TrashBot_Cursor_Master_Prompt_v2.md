# TrashBot — Master Build Prompt v2 for Cursor (Agent mode)

**Fully specified. Zero questions. Build everything.**

You are the lead engineer for TrashBot. This document is complete: every choice you would normally ask me about has already been made below. Build the whole project, end to end, on your own, in the folder that is open in Cursor.

First read the whole document once. Then save it **verbatim** as `docs/MASTER_PROMPT.md` and execute Section 13 phase by phase.

---

## Contents
0. Autonomy contract
1. Pre-answered questions (FAQ)
2. What we're building
3. Hardware, pin map, power
4. Toolchain and versions
5. Repository layout
6. Firmware specification
7. Robot HTTP API (contract)
8. Agent (MCP server) specification
9. Python tools specification
10. Reference repositories — download, reuse, delete
11. Complete test list
12. Documents to write
13. Phases, commands and commits
14. MUST / MUST NOT
15. Definition of done
16. Final report
17. Bill of materials

---

## 0. Autonomy contract

1. **Never ask me anything.** Never end a message with a question. Never present a plan and wait for approval. Never ask "should I continue?". Just do the work.
2. Everything you might want to ask is answered in **Section 1**. If something still isn't covered, decide it yourself using this priority order:
   1. safety of people and hardware,
   2. works on the exact hardware in Section 3,
   3. simplest,
   4. cheapest,
   5. easiest to test.

   Write the decision in `docs/DECISIONS.md` (what, why, how to change it) and continue.
3. **Things only a human can do** (buying, wiring, flashing, taking photos, clicking in Edge Impulse Studio, installing into Claude Desktop) → write exact numbered steps in `docs/USER_STEPS.md`, use clearly named stubs/mocks so builds and tests still pass, and continue.
4. **A command fails** → read the error, fix, retry, up to 3 different fixes. Still failing → isolate it, record it in `docs/DECISIONS.md` and under "Known issues" in `docs/PLAN.md`, and continue with the next item. One failure never stops the whole run.
5. **After every phase:** build → test → fix → commit → update the progress log at the top of `docs/PLAN.md` → start the next phase immediately.
6. Your **only** final message is the report in Section 16.
7. **If interrupted:** when I type `continue`, re-read `docs/MASTER_PROMPT.md` and the progress log in `docs/PLAN.md`, then resume from the first unfinished item.

> The robot's AI agent (Gate 7) is designed to ask the user at runtime when it isn't sure whether something is trash. That is product behaviour. The rules above are about **you**, while building.

---

## 1. Pre-answered questions (FAQ)

| If you're about to ask… | The answer is… |
|---|---|
| Should I proceed / continue? | Always yes. |
| Which OS / shell? | Detect it. Assume Windows 11 + PowerShell unless detected otherwise. Only cross-platform commands. Scripts in Python or Node — never bash-only. |
| Where do I create the project? | In the folder currently open in Cursor (workspace root). Leave my prompt file where it is. |
| Is the board connected? Should I upload/flash or open a serial monitor? | No board is connected. **Never** run upload or monitor. Build only. |
| `pio` isn't on PATH? | Always run PlatformIO as `python -m platformio …`. Install it with `python -m pip install --upgrade platformio`. |
| Git / Python / Node missing? | Install without prompts where possible, e.g. `winget install -e --id Git.Git`, `winget install -e --id Python.Python.3.12`, `winget install -e --id OpenJS.NodeJS.LTS`, with `--accept-package-agreements --accept-source-agreements`. If that's impossible, write it in `USER_STEPS.md` and continue with what you can. |
| Which ESP32 platform / Arduino core? | `platform = espressif32 @ 7.0.1` (Arduino-ESP32 core 2.0.17). Use the **2.x LEDC API** (`ledcSetup`, `ledcAttachPin`, `ledcWrite(channel, duty)`). If 7.0.1 isn't available, use the newest official `espressif32` version that still ships Arduino core 2.0.x. Switch to the pioarduino platform (core 3.x) **only** if no 2.0.x version can build; if you switch, record it and use the 3.x LEDC API. |
| Which board ID? PSRAM settings? | `board = seeed_xiao_esp32s3`. Its board file already sets `memory_type = qio_opi`, `BOARD_HAS_PSRAM`, `ARDUINO_USB_MODE=1` and `ARDUINO_USB_CDC_ON_BOOT=1`. Don't add conflicting flags. Verify PSRAM at boot with `psramFound()`. |
| Which pins? | Section 3.2 — fixed. |
| Which libraries? | ArduinoJson 7.x (pin the exact version you install). Everything else is built into Arduino-ESP32: `WiFi`, `WebServer`, `ESPmDNS`, `Preferences`, `esp_camera`, LEDC, `I2S`. **No servo library** — drive the servo with LEDC directly. |
| Async web server? | No. The built-in `WebServer`, running in its own task (Section 6.3). |
| C++ standard? | gnu++17 (unflag gnu++11). |
| WiFi credentials? | None. Default = the robot's own access point `TrashBot-XXXX` (last 4 hex digits of the MAC), password `trashbot123`, IP `192.168.4.1`. Home WiFi only via `secrets.h`, which I fill in later. |
| API token? | Empty by default (no auth). Optional via `secrets.h`. |
| Edge Impulse project / trained model? | Doesn't exist yet. Use `FakeDetector`. I will name my Edge Impulse project exactly **`TrashBot`**, so the exported header will be `TrashBot_inferencing.h`. |
| Model classes? | One class: `trash`. |
| Camera mounted upside down? | Config flags `CAMERA_VFLIP` / `CAMERA_HMIRROR`, default false. I'll set them after I see the first photo. |
| Voice start with a keyword model? | Two Edge Impulse libraries in one firmware conflict. Build **"clap to start"** now (sound-level trigger from the onboard PDM mic, no ML). Document keyword spotting as future work (Edge Impulse multi-impulse deployment). |
| SD-card logging? | Not used: its SPI lines (D8–D10) drive the motors, servo and ultrasonic. Logs go to a RAM ring buffer, readable from `/api/log`. |
| Battery monitoring? | Optional, off by default (`BATTERY_MONITOR_ENABLED = false`). If enabled: a 100 kΩ / 33 kΩ divider on D2. |
| TypeScript or JavaScript for the agent? | TypeScript, Node ≥ 20, ESM. |
| Test frameworks? | Firmware: PlatformIO Unity in the `native` env. Agent: vitest. Python tools: pytest. |
| No host C++ compiler for native tests (Windows)? | Try installing one non-interactively (for example WinLibs or MSYS2 via winget). If that's impossible, keep the tests, document the install in `USER_STEPS.md`, and continue. |
| Git identity not set? | Set it for this repo only: name `Satyam Chouksey`, email `satyamchouksey9907@gmail.com`. |
| Push to GitHub / create a remote? | Never. Local commits only. |
| Licence for our code? | MIT — `LICENSE` at the root, "Copyright (c) 2026 Satyam Chouksey". Third-party code keeps its own licence in `third_party/`. |
| Can I delete files? | Only `references/` and files you created. Never anything outside the project folder. |
| Can I install packages? | Yes: pip packages, project-local npm packages, PlatformIO platforms and libraries, a host compiler if needed. No global system-setting changes. |
| Large downloads (toolchains ~1 GB)? | Fine. |
| TACO downloads slow or failing? | Max 200 images, 15 s timeout each, skip failures. The script must work even if every download fails. |
| Claude Desktop? | Don't touch it. Build the `.mcpb` and document how I install it. |
| Claude API key? | None. The API eval script must exit cleanly (code 0) without `ANTHROPIC_API_KEY`. |
| This document disagrees with official docs? | Follow the official docs and record the deviation in `DECISIONS.md`. |
| Unsure about a number? | Use the defaults in Section 6.2. They are placeholders that I calibrate later from the web UI. |

---

## 2. What we're building

TrashBot is a small, low-budget robot dustbin (about ₹3,500–4,300 in parts). With **its own camera and an on-device AI model** (Edge Impulse FOMO object detection) it finds trash on the floor, drives to it, scoops it with a front dustpan arm, and tips it into the bin it carries — **with no laptop and no internet needed** (Gates 1–6). Gate 7 adds an **AI agent**: Claude, through an MCP server on the laptop, lets the owner say "clean near the sofa", looks at photos when unsure, handles failures and reports.

**Two brains:** reflexes on the robot (camera + FOMO at about 7 frames/second, steering, scoop, safety) and thinking in the agent (goals, judgement, reports). The agent only calls the robot's API; firmware safety always wins.

**Owner:** QA automation engineer (Node.js, Java, Playwright), new to embedded C++. Write readable code, comments that explain *why*, strong automated tests, and beginner-proof docs.

**Out of scope:** catching thrown trash mid-air — research notes only (`docs/FUTURE_CATCH_MODE.md`).

### Gates (product plan)

| Gate | Goal | Hardware pass criteria (tested by me) |
|---|---|---|
| G1 It drives | Phone web UI over the robot's own WiFi; arrows, speed, stop; forward blocked < 15 cm; commands expire (dead-man) | Every item on the G1 checklist |
| G2 It sees trash | Photo pipeline, dataset tools, Edge Impulse FOMO on the board | Trash found in ≥ 8/10 test shots; leave-alone items ignored; about ≤ 150 ms per inference |
| G3 It chases trash | Search + approach + align | In scoop position for ≥ 8/10 items placed ≤ 1.5 m away |
| G4 It scoops into the bin | Scoop + tip + verify | ≥ 8/10 paper balls end up in the bin |
| G5 Full autonomy | The whole loop | Clears ≥ 4/5 scattered paper balls with no help |
| G6 Extras | Event log, scenario suite, clap-to-start | Scenario results recorded in `docs/TESTING.md` |
| G7 Agent | Robot API + MCP server + mock robot + `.mcpb` | From one chat message: checks the area, collects trash, leaves ≥ 4/5 look-alike non-trash items alone, recovers from one failed scoop, reports |

You implement **all software for G1–G7 now**. In `docs/PLAN.md` each gate has two statuses: *software* (yours) and *hardware test* (mine — always "pending user test").

---

## 3. Hardware, pin map, power

### 3.1 Parts

| Part | Details |
|---|---|
| Brain | Seeed Studio **XIAO ESP32S3 Sense** (ESP32-S3R8, 8 MB PSRAM, 8 MB flash, WiFi). Camera board may be **OV2640 or OV3660 — support both**. Onboard PDM mic. Runs warm → small stick-on heatsink. |
| Drive | 4WD acrylic chassis, 4× TT gear motors (rated about 3–6 V). **TB6612FNG**: left pair in parallel on channel A, right pair in parallel on channel B. |
| Scoop | **MG996R, 180° positional version.** Pivot on the bin's front-top edge; arm with a dustpan at the end. DOWN = pan flat on the floor in front; CARRY = raised; TIP = swung up and over so trash falls into the bin. |
| Distance | HC-SR04 ultrasonic facing forward, mounted so the scoop stays out of its beam as far as possible. |
| Power | 2× 18650 in series (7.4–8.4 V) + power switch. |
| Body | Small, light plastic dustbin on the chassis; camera on a short front mast, tilted down to see the floor about 20–100 cm ahead. |

### 3.2 Pin map (fixed)

| XIAO pin | GPIO | Connects to | Notes |
|---|---|---|---|
| D0 | 1 | TB6612 PWMA | LEDC channel 0 |
| D1 | 2 | TB6612 AIN1 | |
| D3 | 4 | TB6612 AIN2 | |
| D4 | 5 | TB6612 PWMB | LEDC channel 1 |
| D5 | 6 | TB6612 BIN1 | |
| D8 | 7 | TB6612 BIN2 | Shares the SD SCK line → SD card unused |
| D9 | 8 | Servo signal | LEDC channel 2. Shares the SD MISO line |
| D10 | 9 | Ultrasonic TRIG | Shares the SD MOSI line |
| D7 | 44 | Ultrasonic ECHO | Through a divider: ECHO → 1 kΩ → D7, D7 → 2 kΩ → GND (keeps it ≤ 3.3 V) |
| D2 | 3 | Spare / optional battery divider | Strapping pin: nothing may pull it hard at boot |
| D6 | 43 | Spare | UART0 TX (prints the boot log) |
| — | 21 | Onboard user LED (active LOW) | Status heartbeat |

TB6612: `STBY → 3V3`, `VCC → 3V3`, `VM → battery +` (after the switch), `GND → common ground`.

Camera pins (internal — `CAMERA_MODEL_XIAO_ESP32S3` in Arduino-ESP32's `camera_pins.h`): PWDN −1, RESET −1, XCLK 10, SIOD 40, SIOC 39, Y9 48, Y8 11, Y7 12, Y6 14, Y5 16, Y4 18, Y3 17, Y2 15, VSYNC 38, HREF 47, PCLK 13.

Mic (onboard PDM): clock GPIO 42, data GPIO 41 (as in Seeed's mic example for this board).

**LEDC allocation (do not reuse):** motors ch0 + ch1 (timer 0, 20 kHz, 10-bit); servo ch2 (timer 1, 50 Hz, 14-bit); camera XCLK **ch7 + LEDC_TIMER_3** — set `config.ledc_channel = LEDC_CHANNEL_7` and `config.ledc_timer = LEDC_TIMER_3` in the camera config, because the usual example values (channel 0 / timer 0) would clash with the motors.

Verify this map against Seeed's pinout sheet and Mjrovai's code. Change it only if something is definitely wrong, and record the change.

### 3.3 Power wiring (fixed)
- Battery + → switch → (a) TB6612 VM, (b) buck #1 set to **5.0 V** → XIAO 5V pin + HC-SR04 VCC, (c) buck #2 set to **6.0 V** (≥ 3 A) → servo V+.
- All grounds joined: battery −, both bucks, TB6612, XIAO, servo, HC-SR04.
- **Set both buck outputs with a multimeter before connecting anything to them.**
- Recommended: 470 µF capacitor across TB6612 VM/GND; 100 nF across each motor's terminals.
- Robot power switch OFF while the USB-C cable is plugged in for flashing.

---

## 4. Toolchain and versions
- Python ≥ 3.10; PlatformIO Core (latest via pip); `platform = espressif32 @ 7.0.1`; ArduinoJson 7.x (pinned exactly after the first install).
- Node 20 LTS or newer; TypeScript 5.x; `@modelcontextprotocol/sdk` latest 1.x; the zod version the SDK expects; vitest; tsx; `@anthropic-ai/mcpb` via npx.
- Python tools: `requests`, `pillow`, `tqdm`; dev: `pytest`.
- Record every resolved version in `docs/DECISIONS.md`.

---

## 5. Repository layout (exact)

```
<workspace root>/
  TrashBot_Cursor_Master_Prompt_v2.md   (mine — leave it where it is)
  AGENTS.md                            short rules for AI coding agents (Sections 0, 1 highlights, 14)
  LICENSE                              MIT, Copyright (c) 2026 Satyam Chouksey
  README.md
  .gitignore
  .gitattributes                       * text=auto
  .github/workflows/ci.yml             builds + tests (runs only once I push someday)
  docs/
    MASTER_PROMPT.md  PLAN.md  USER_STEPS.md  DECISIONS.md  REFERENCES.md
    API.md  WIRING.md  TESTING.md  DATASET.md  AGENT.md  FUTURE_CATCH_MODE.md
  firmware/
    platformio.ini
    include/config.h                   single source of truth for pins and numbers
    include/secrets.example.h
    src/main.cpp                       boot sequence + task creation only
    lib/core/                          PURE C++ — never includes Arduino.h or ESP headers
      types.h
      motor_math.h/.cpp
      safety_logic.h/.cpp
      target.h/.cpp
      image_ops.h/.cpp
      timed_move.h/.cpp
      scoop_seq.h/.cpp
      brain.h/.cpp
      event_ring.h/.cpp
    lib/hw/                            Arduino/ESP drivers
      motors.h/.cpp  ultrasonic.h/.cpp  servo.h/.cpp  camera.h/.cpp
      detector.h  detector_fake.h/.cpp  detector_ei.h/.cpp
      sound_trigger.h/.cpp  status_led.h/.cpp  battery.h/.cpp
    lib/net/
      wifi_setup.h/.cpp  http_api.h/.cpp  web_index.h (HTML as a raw string literal)
    lib/store/
      calib.h/.cpp (NVS)  shared_state.h/.cpp (mutex-protected state + command queue)
    test/
      test_motor_math/  test_safety/  test_target/  test_image_ops/
      test_timed_move/  test_scoop_seq/  test_brain/  test_event_ring/
  tools/
    common.py  collect_photos.py  taco_subset.py  log_report.py  make_placeholder_jpeg.py
    requirements.txt  requirements-dev.txt
    tests/test_common.py  tests/test_taco_coco.py  tests/test_log_report.py
  agent/
    package.json  tsconfig.json  vitest.config.ts  manifest.json  README.md
    src/index.ts  src/contract.ts  src/robotClient.ts  src/format.ts
    src/tools/*.ts  src/prompts/cleanRoom.ts
    mock-robot/server.ts  mock-robot/placeholder.ts
    test/*.test.ts
    evals/README.md  evals/photos/trash/.gitkeep  evals/photos/keep/.gitkeep  evals/run_api_eval.ts
  dataset/README.md                    everything else under dataset/ is gitignored
  third_party/<repo-name>/LICENSE
```

**Rule:** `lib/core` never includes `Arduino.h` or any ESP header. The `native` env compiles only `lib/core` plus the tests. `lib/hw`, `lib/net` and `lib/store` are thin wrappers around core logic.

`.gitignore` must cover: `references/`, `.pio/`, `node_modules/`, `dist/`, `dataset/*` (except `dataset/README.md`), `firmware/include/secrets.h`, `.env*`, `*.mcpb`, `firmware/lib/TrashBot_inferencing/`, `__pycache__/`, `.pytest_cache/`.

---

## 6. Firmware specification

### 6.1 `firmware/platformio.ini` (use exactly this, then pin ArduinoJson)

```ini
[platformio]
default_envs = xiao

[env:xiao]
platform = espressif32 @ 7.0.1
board = seeed_xiao_esp32s3
framework = arduino
monitor_speed = 115200
build_unflags = -std=gnu++11
build_flags =
  -std=gnu++17
  -DCORE_DEBUG_LEVEL=1
  -DFW_VERSION=\"0.1.0\"
lib_deps =
  bblanchon/ArduinoJson @ ^7
; After the first successful build, replace ^7 with the exact installed version.

[env:native]
platform = native
test_framework = unity
build_flags = -std=c++17 -DUNIT_TEST
lib_ignore = hw, net, store
```

### 6.2 `firmware/include/config.h` defaults (exact names and values)

```cpp
#pragma once
#include <stdint.h>
// Single source of truth. All values are defaults; calibration in NVS overrides the marked ones.
namespace cfg {
// Pins (Section 3.2)
constexpr int PIN_PWMA = 1, PIN_AIN1 = 2, PIN_AIN2 = 4;
constexpr int PIN_PWMB = 5, PIN_BIN1 = 6, PIN_BIN2 = 7;
constexpr int PIN_SERVO = 8, PIN_US_TRIG = 9, PIN_US_ECHO = 44;
constexpr int PIN_BATTERY_ADC = 3, PIN_STATUS_LED = 21;
// LEDC
constexpr int LEDC_CH_MOTOR_A = 0, LEDC_CH_MOTOR_B = 1, LEDC_CH_SERVO = 2; // camera uses ch7 + timer 3
constexpr uint32_t MOTOR_PWM_HZ = 20000; constexpr uint8_t MOTOR_PWM_BITS = 10;
constexpr uint32_t SERVO_PWM_HZ = 50;    constexpr uint8_t SERVO_PWM_BITS = 14;
// Motors
constexpr int  MOTOR_MAX_DUTY_PCT = 70;        // [calib] TT motors ~6 V on an 8.4 V pack
constexpr int  MOTOR_RAMP_PCT_PER_S = 250;
constexpr bool MOTOR_LEFT_INVERT = false, MOTOR_RIGHT_INVERT = false;
constexpr int  DRIVE_SPEED_PCT = 45, TURN_SPEED_PCT = 45, CREEP_SPEED_PCT = 30;
// Manual control (dead-man)
constexpr uint32_t MANUAL_CMD_DEFAULT_MS = 300, MANUAL_CMD_MAX_MS = 1000;
// Servo / scoop
constexpr int SERVO_MIN_US = 500, SERVO_MAX_US = 2500;
constexpr int SERVO_MIN_DEG = 5, SERVO_MAX_DEG = 175;
constexpr int SERVO_DOWN_DEG = 20, SERVO_CARRY_DEG = 100, SERVO_TIP_DEG = 165;   // [calib]
constexpr int SERVO_MAX_DEG_PER_S = 120;
constexpr uint32_t TIP_HOLD_MS = 600;
// Ultrasonic and safety
constexpr uint32_t US_PERIOD_MS = 66, US_TIMEOUT_US = 25000;
constexpr int US_NO_ECHO_CM = 400;
constexpr int OBSTACLE_STOP_CM = 15;
constexpr int SCOOP_SELF_ECHO_CM = 12;          // [calib] readings <= this + 3 are ignored while scoop is DOWN
constexpr uint32_t SESSION_MAX_S_DEFAULT = 300;
constexpr int SESSION_MAX_ITEMS_DEFAULT = 10;
// Vision
constexpr float DETECTION_MIN_SCORE = 0.60f;
constexpr uint32_t DETECTION_MAX_AGE_MS = 600;
constexpr int TARGET_LOST_FRAMES = 5;
constexpr float SCOOP_ZONE_X_MIN = 0.35f, SCOOP_ZONE_X_MAX = 0.65f, SCOOP_ZONE_Y_MIN = 0.80f; // [calib]
constexpr int ALIGN_STABLE_FRAMES = 3;
constexpr float STEER_KP_PCT = 90.0f;           // turn % per unit of x offset from 0.5
constexpr float STEER_DEADBAND = 0.06f;
constexpr float APPROACH_Y_FAST = 0.30f, APPROACH_Y_SLOW = 0.80f; // speed ramps DRIVE → CREEP between these
// Search and recovery
constexpr int SEARCH_STEP_DEG = 30; constexpr uint32_t SEARCH_PAUSE_MS = 300;
constexpr int SEARCH_FORWARD_CM = 45, AVOID_TURN_DEG = 90;
constexpr int REACQUIRE_SWEEP_DEG = 20; constexpr uint32_t REACQUIRE_MS = 1500;
constexpr int FAIL_TURN_AWAY_DEG = 45;
// Scoop routine
constexpr int SCOOP_CREEP_CM = 12, RETRY_BACKUP_CM = 10, MAX_RETRIES = 3;
constexpr uint32_t VERIFY_WAIT_MS = 500;
// Open-loop motion estimates [calib]
constexpr float TURN_DEG_PER_S_AT_TURN_SPEED = 120.0f;
constexpr float FWD_CM_PER_S_AT_DRIVE_SPEED = 25.0f;
// Camera and model
constexpr bool CAMERA_VFLIP = false, CAMERA_HMIRROR = false;
constexpr int CAMERA_JPEG_QUALITY = 12;         // QVGA 320x240 capture
constexpr int CROP_PX = 240, MODEL_INPUT_PX = 96; // centre crop 240x240 -> 96x96
// Network
constexpr const char* AP_SSID_PREFIX = "TrashBot-";
constexpr const char* AP_PASSWORD = "trashbot123";
constexpr const char* MDNS_NAME = "trashbot";
constexpr uint32_t STA_CONNECT_TIMEOUT_MS = 15000;
constexpr int HTTP_PORT = 80;
// Clap to start
constexpr bool SOUND_TRIGGER_ENABLED = true;
constexpr int SOUND_TRIGGER_LEVEL = 12000;      // peak |sample| in a 20 ms window
constexpr uint32_t SOUND_TRIGGER_COOLDOWN_MS = 3000;
// Battery (optional)
constexpr bool BATTERY_MONITOR_ENABLED = false;
constexpr float BATTERY_DIVIDER_RATIO = (100.0f + 33.0f) / 33.0f;
constexpr float BATTERY_STOP_V = 6.6f;
// Logging
constexpr int EVENT_RING_SIZE = 256;
} // namespace cfg

// Edge Impulse header (my EI project will be named exactly "TrashBot")
#define TRASHBOT_EI_HEADER <TrashBot_inferencing.h>
```

### 6.3 Tasks and timing

| Task | Core | Priority | Period | Job |
|---|---|---|---|---|
| `controlTask` | 1 | 3 | 20 ms (`vTaskDelayUntil`) | Trigger/read ultrasonic, drain the command queue, run `Brain::step`, pass motor output through Safety, apply motors + servo, update shared state, push events |
| `visionTask` | 1 | 1 | as fast as possible (~7 fps) | Capture → keep latest JPEG copy → decode → crop → resize → detect → publish `{detections, t_ms, vision_ms}` with `xQueueOverwrite` (queue length 1) |
| `webTask` | 0 | 1 | loop with 2 ms delay | `server.handleClient()` — reads shared state, enqueues commands. **Never touches the camera or motors directly.** |
| `soundTask` | 0 | 1 | 20 ms windows | Only when enabled and the mode is idle; emits a `start` command on a clap |
| `ledTask` | 0 | 1 | 50 ms | Heartbeat pattern per mode |
| Arduino `loop()` | — | — | — | Delete itself (`vTaskDelete(NULL)`) after `setup()` |

Shared state lives in `store/shared_state` behind one FreeRTOS mutex. The web task sends commands through a FreeRTOS queue (length 8) that only `controlTask` consumes. `/api/photo` copies the latest JPEG buffer under the mutex.

### 6.4 Module responsibilities (key functions)

**core (pure, tested):**
- `types.h` — `Detection {x, y, w, h, score}` (normalised 0–1 in the 240×240 crop); `Detections {items[8], count, t_ms}`; `MotorCmd {left, right}` (−100..100); `Mode {Idle, Manual, Auto}`; `State {IDLE, MANUAL, SEARCH, APPROACH, REACQUIRE, ALIGN, SCOOP, TIP, VERIFY, BACKUP, AVOID, DONE, ESTOP}`; `EventType` (list in 6.10); `Event {seq, t_ms, type, a, b}`.
- `motor_math` — `clampPct`, `applyCap(cmd, maxDutyPct)`, `rampToward(current, target, maxStep)`, `mixArcade(throttle, turn)`, `pctToDuty(pct, bits, maxDutyPct)`.
- `safety_logic` — `MotorCmd filter(MotorCmd requested, SafetyInputs in)` with inputs `{distance_cm, scoopDown, estop, lowBattery}`. Rules in 6.6.
- `target` — `pickTarget(dets, minScore, maxAgeMs, now, out)` (highest score; tie → larger y); `inScoopZone(det, zone)`; `steer(x, kp, deadband)`; `approachSpeed(y)`.
- `image_ops` — `centreCropRGB888(src, w, h, crop, dst)`, `resizeBilinearRGB888(src, sw, sh, dst, dw, dh)`.
- `timed_move` — open-loop helper: `turnDegrees(deg, speed, degPerS)` and `moveCm(cm, speed, cmPerS)` produce `{MotorCmd, duration_ms}`; `step(now)` tells whether it's done.
- `scoop_seq` — `ScoopSequencer`: DOWN → CREEP → TIP → HOLD → CARRY → DONE; servo target rate-limited by `SERVO_MAX_DEG_PER_S`; creep duration from the calibrated forward speed scaled to `CREEP_SPEED_PCT`.
- `brain` — `Brain::reset()`, `BrainOutput Brain::step(const BrainInput&)`. Input: `{now_ms, detections, detections_age_ms, distance_cm, servo_deg, commands (start{max_items, max_time_s}, stop, estop, estop_reset, set_mode, manual_drive{left, right, duration_ms}, move{cm, speed}, turn{deg, speed}, scoop{action}), calib}`. Output: `{motor, servo_deg, state, mode, events[4], event_count, session {active, collected, failed, skipped, max_items, elapsed_s, max_time_s}}`. Implements 6.5.
- `event_ring` — fixed-size ring buffer with increasing sequence numbers and a `since(seq)` query.

**hw (drivers):** `motors` (TB6612 truth table: forward IN1=H IN2=L; reverse IN1=L IN2=H; brake IN1=H IN2=H; coast IN1=L IN2=L; zero speed = brake), `ultrasonic` (10 µs trigger, echo timing via ISR on CHANGE with `micros()`, timeout → `US_NO_ECHO_CM`, median of last 3), `servo` (LEDC ch2, degrees → microseconds → duty), `camera` (Section 6.7), `detector` interface `{begin(), detect(rgb96, out), name(), modelLoaded()}`, `detector_fake` (scripted: a target that drifts from top to bottom of the frame, for bench demos; selectable from the web UI), `detector_ei` (compiled only when `__has_include(TRASHBOT_EI_HEADER)`; otherwise a stub reporting `modelLoaded() = false`; the EI version uses `run_classifier` with a callback that packs RGB888 into EI's float pixel format, as in Mjrovai's / Edge Impulse's camera example), `sound_trigger` (I2S PDM, 16 kHz, 16-bit, peak detector), `status_led`, `battery` (optional).

**net:** `wifi_setup` (station mode if `secrets.h` has credentials, else — or after 15 s — access point; mDNS `trashbot` + `_http._tcp`), `http_api` (routes in Section 7, ArduinoJson parsing, token check, command queue), `web_index.h` (Section 6.9).

**store:** `calib` (Preferences namespace `trashbot`; keys `zone_xmin`, `zone_xmax`, `zone_ymin`, `servo_down`, `servo_carry`, `servo_tip`, `turn_dps`, `fwd_cps`, `self_echo_cm`, `max_duty`; defaults from `cfg`; reads and writes behind a mutex), `shared_state`.

### 6.5 State machine (implement exactly; every number from `cfg`/calib)

| State | On entry | Transitions |
|---|---|---|
| IDLE | Motors 0, servo CARRY | `start` → SEARCH (session begins: t0, counters, limits) · `set_mode manual` → MANUAL |
| MANUAL | — | Manual drive/move/turn/scoop pass through Safety · each drive command expires after `duration_ms` (default 300, max 1000) · `set_mode idle` → IDLE · `start` → SEARCH |
| SEARCH | step = 0 | Valid target (score ≥ min, age ≤ max) → APPROACH · otherwise turn `SEARCH_STEP_DEG`, pause `SEARCH_PAUSE_MS`, step++ · after 360° with nothing → move forward `SEARCH_FORWARD_CM` (if clear) then step = 0 · forward blocked → AVOID |
| APPROACH | lost = 0 | Steer by x, speed by y · target in scoop zone → ALIGN · target missing → lost++ ; lost > `TARGET_LOST_FRAMES` → REACQUIRE · obstacle < `OBSTACLE_STOP_CM` → AVOID (event `obstacle`; after 2 obstacle aborts on the same target → skipped++) |
| REACQUIRE | — | Sweep ±`REACQUIRE_SWEEP_DEG` for `REACQUIRE_MS` · target found → APPROACH · otherwise → SEARCH (event `target_lost`) |
| ALIGN | Motors 0 | Small turns until \|x − 0.5\| ≤ deadband · in zone and centred for `ALIGN_STABLE_FRAMES` → SCOOP · drifted out of zone → APPROACH |
| SCOOP | Servo → DOWN (wait for the move) | Creep forward `SCOOP_CREEP_CM` at `CREEP_SPEED_PCT` (timed) → TIP |
| TIP | Servo → TIP (rate-limited) | Hold `TIP_HOLD_MS`, servo → CARRY → VERIFY |
| VERIFY | Motors 0; wait `VERIFY_WAIT_MS` for fresh detections | No target in scoop zone or lower 40 % of frame → collected++, event `item_collected` → SEARCH (or DONE if limits reached) · target still there → retries++; retries < `MAX_RETRIES` → BACKUP; else failed++, event `item_failed`, turn away `FAIL_TURN_AWAY_DEG` → SEARCH |
| BACKUP | — | Reverse `RETRY_BACKUP_CM` (timed) → APPROACH |
| AVOID | — | Turn `AVOID_TURN_DEG` (alternate left/right each time) → SEARCH |
| DONE | Motors 0, servo CARRY, event `session_done{collected, failed}` | → IDLE |
| ESTOP | Motors 0 immediately, servo holds position | `estop_reset` → IDLE |

Global rules, checked before the per-state rules: `stop` → IDLE (event) · `estop` → ESTOP · session elapsed ≥ `max_time_s` or collected ≥ `max_items` → DONE · camera unavailable while in auto → DONE (event `vision_unavailable`) · low battery (if enabled) → DONE (event `low_battery`).

### 6.6 Safety rules (in `safety_logic`, applied to **every** motor command in every state)
1. `estop` → both motors 0.
2. Forward component blocked (`left + right > 0` → both clamped to ≤ 0) when `distance_cm < OBSTACLE_STOP_CM`. Turning in place and reversing stay allowed.
3. While the scoop is DOWN, readings ≤ `SCOOP_SELF_ECHO_CM + 3` are treated as "clear" (they're the scoop itself).
4. Low battery (if enabled) → 0.
5. Output capped by `MOTOR_MAX_DUTY_PCT` and ramped by `MOTOR_RAMP_PCT_PER_S`.
6. Manual commands expire (dead-man). No web, API or agent path skips this filter.

### 6.7 Vision pipeline (exact)
1. `esp_camera`: `PIXFORMAT_JPEG`, `FRAMESIZE_QVGA` (320×240), quality `CAMERA_JPEG_QUALITY`, `fb_count = 2`, `fb_location = CAMERA_FB_IN_PSRAM`, `grab_mode = CAMERA_GRAB_LATEST`, XCLK 20 MHz on **LEDC ch7 / timer 3**. Detect the sensor PID (OV2640 / OV3660) and report its name. Apply the VFLIP/HMIRROR flags.
2. Copy the JPEG (≤ 40 KB, PSRAM) as "latest photo" under the mutex.
3. Decode to RGB888 (`fmt2rgb888`) into a PSRAM buffer.
4. Centre-crop 240×240 (x offset 40) → resize to 96×96 (bilinear) — `core/image_ops`.
5. Detect → detections normalised to the 240×240 crop.
6. Publish `{detections, t_ms, vision_ms}`.
7. Camera init failure is **not fatal**: driving, web UI and API keep working; status shows `camera: "error"` and `last_error`.

Data collection uses `/api/photo` (the full QVGA JPEG); `tools/collect_photos.py` centre-crops 240×240 on the laptop — the same geometry the robot uses for inference.

### 6.8 Networking
- If `secrets.h` defines a non-empty `WIFI_SSID`: station mode; timeout `STA_CONNECT_TIMEOUT_MS`; on failure fall back to the access point.
- Access point: SSID `TrashBot-XXXX`, password `trashbot123`, IP `192.168.4.1`.
- mDNS `trashbot.local` in both modes.
- If `API_TOKEN` is non-empty, every `/api/*` request needs the header `X-TrashBot-Token`; otherwise 401.
- `secrets.example.h` contains `WIFI_SSID ""`, `WIFI_PASS ""`, `API_TOKEN ""` with comments. The build works without `secrets.h` (use `__has_include`).

### 6.9 Web UI (`web_index.h`, one page, vanilla HTML/CSS/JS, **no CDNs**)
Mobile-first, big touch targets, works in light and dark. Tabs/sections:
- **Drive:** press-and-hold arrows (send `/api/drive` with `duration_ms: 300` every 200 ms while held), speed slider (10–80, default 45), big STOP (`/api/stop`), ESTOP + reset, live distance / state / mode.
- **Camera:** snapshot refreshed every 500 ms (only while this tab is visible) with detection dots and scores overlaid on the centre crop; detector name and `vision_ms`; "Fake detector demo" toggle.
- **Auto:** Start (max items, max time, scenario label), Stop, counters (collected / failed / skipped), current state.
- **Calibrate:** "Save scoop zone from current target"; servo sliders for DOWN / CARRY / TIP with Test and Save; "Measure turn" (turns 3 s at turn speed, then I type the degrees it actually turned → saves `turn_dps`); "Measure forward" (drives 2 s, I type the cm → saves `fwd_cps`); motor max duty; self-echo distance (reads the current ultrasonic value with the scoop DOWN → Save).
- **Log:** last 50 events, auto-refresh.

### 6.10 Events
`boot`, `wifi_ready`, `camera_error`, `model_missing`, `mode_changed`, `session_start` (includes the scenario label), `target_found`, `target_lost`, `obstacle`, `scoop_start`, `item_collected`, `item_failed`, `item_skipped`, `session_done`, `estop`, `estop_reset`, `manual_expired`, `sound_trigger`, `low_battery`, `vision_unavailable`, `calib_saved`.

### 6.11 Boot sequence
Serial banner (fw version, PSRAM size, camera sensor, detector name + `model_loaded`, WiFi mode and IP) → LED on → load calibration → motors initialised stopped → servo to CARRY → ultrasonic → camera (non-fatal) → detector (EI if present, else fake) → WiFi + mDNS → web server → tasks → event `boot`.

---

## 7. Robot HTTP API (contract — write it once in `docs/API.md` and `agent/src/contract.ts`)

JSON everywhere. Errors: `{"error": "message"}` with 400 (bad body), 401 (bad token), 409 (not allowed in the current mode, e.g. drive while auto), 503 (camera unavailable).

| Method + path | Body | Result |
|---|---|---|
| `GET /` | — | Web UI |
| `GET /api/status` | — | Status object (below) |
| `GET /api/photo` | — | `image/jpeg` (latest QVGA frame) or 503 |
| `POST /api/mode` | `{"mode": "idle" \| "manual"}` | `{"ok": true, "mode": …}` (auto is entered only via `/api/clean`) |
| `POST /api/drive` | `{"left": -100..100, "right": -100..100, "duration_ms": 100..1000}` | `{"ok": true}`; allowed in manual only |
| `POST /api/move` | `{"distance_cm": -100..100, "speed": 10..80}` | `{"ok": true, "duration_ms": n}`; manual/idle only |
| `POST /api/turn` | `{"degrees": -180..180, "speed": 10..80}` | `{"ok": true, "duration_ms": n}`; manual/idle only |
| `POST /api/scoop` | `{"action": "down" \| "carry" \| "tip" \| "cycle"}` | `{"ok": true}`; manual/idle only |
| `POST /api/clean` | `{"max_items": 1..20, "max_time_s": 10..600, "label": "optional"}` | `{"ok": true}` → auto session |
| `POST /api/stop` | — | Always allowed → idle |
| `POST /api/estop` / `POST /api/estop/reset` | — | `{"ok": true}` |
| `GET /api/log?since=<seq>` | — | `{"events": [{"seq", "t_ms", "type", "a", "b"}], "last_seq": n}` |
| `GET /api/calib` | — | All calibration values |
| `POST /api/calib/<key>` | `{"value": number}` or `{"from": "current_target" \| "current_distance"}` | `{"ok": true, "key": …, "value": …}` |

Status object example:

```json
{
  "fw": "0.1.0",
  "mode": "auto",
  "state": "APPROACH",
  "session": {"active": true, "collected": 2, "failed": 0, "skipped": 0,
              "max_items": 5, "elapsed_s": 41, "max_time_s": 300, "label": "dim light"},
  "distance_cm": 63,
  "detections": [{"x": 0.52, "y": 0.61, "w": 0.08, "h": 0.08, "score": 0.83}],
  "detections_age_ms": 120,
  "vision_ms": 143,
  "detector": "fake",
  "model_loaded": false,
  "camera": "OV3660",
  "scoop": {"state": "carry", "deg": 100},
  "wifi": {"mode": "ap", "ip": "192.168.4.1", "rssi": 0},
  "psram_bytes": 8388608,
  "chip_temp_c": 52.5,
  "battery_v": null,
  "estop": false,
  "last_error": null,
  "uptime_ms": 123456
}
```

---

## 8. Agent (MCP server) specification

### 8.1 Package
- `agent/package.json`: `"type": "module"`, `"name": "trashbot-agent"`, `"version": "0.1.0"`.
- Scripts:
  - `build`: `tsc -p .`
  - `test`: `vitest run`
  - `mock`: `tsx mock-robot/server.ts`
  - `start`: `node dist/index.js`
  - `pack`: `npm run build && npx @anthropic-ai/mcpb pack`
  - `eval`: `tsx evals/run_api_eval.ts`
- tsconfig: `target ES2022`, `module NodeNext`, `moduleResolution NodeNext`, `strict`, `outDir dist`.
- HTTP via Node's global `fetch` with `AbortController` timeouts (5 s; photo 8 s). GET requests retry once on network error. POST commands are never retried automatically — except `stop` (2 retries).
- **stdout belongs to the MCP protocol: log only to stderr (`console.error`).**
- Env: `TRASHBOT_URL` (default `http://trashbot.local`), `TRASHBOT_TOKEN` (optional).
- Friendly error text, e.g. "Robot not reachable at http://trashbot.local — is it switched on and on the same WiFi as this laptop?"

### 8.2 Tools (zod schemas; descriptions written for an AI agent)

| Tool | Input | Does | Returns |
|---|---|---|---|
| `get_status` | — | `GET /api/status` | Short summary line + the JSON |
| `take_photo` | — | `GET /api/photo` | MCP image content (`image/jpeg`, base64) + a caption with the current detections |
| `start_cleaning` | `max_items` 1–20 (default 5), `max_time_s` 10–600 (default 180), `label` optional | `POST /api/clean` | Confirmation |
| `stop` | — | `POST /api/stop` (2 retries) | Confirmation |
| `set_mode` | `mode`: idle \| manual | `POST /api/mode` | Confirmation |
| `drive` | `direction` forward \| back \| left \| right, `speed` 10–80 (default 40), `duration_ms` 100–1000 (default 500) | Switches to manual if needed, then `POST /api/drive` | Confirmation. Description: small manual nudges only; prefer `start_cleaning`; the robot refuses forward motion near obstacles |
| `move` | `distance_cm` −100..100, `speed` default 40 | `POST /api/move` | Duration |
| `turn` | `degrees` −180..180, `speed` default 40 | `POST /api/turn` | Duration |
| `scoop` | `action` down \| carry \| tip \| cycle | `POST /api/scoop` | Confirmation |
| `get_events` | `limit` 1–100 (default 20), `since` optional | `GET /api/log` | Readable list + `last_seq` |

### 8.3 MCP prompt `clean_room` (register it with exactly this text)

```
You control TrashBot, a small robot dustbin, through tools. People's belongings and safety come first.
1. Call get_status. If the robot reports an error, estop, or is already busy, tell the user and stop there.
2. Call take_photo. List the objects you can see on the floor and classify each one:
   trash (paper, wrappers, packets, tissues, paper cups, bottle caps, small plastic) or
   keep (anything that could belong to someone: phone, keys, earphones, cables, wallet, jewellery, remote, toys, documents, money).
3. If you are unsure about any object, ask the user before cleaning.
4. If there is trash, call start_cleaning with max_items = number of trash items (at most 10) and a sensible time limit.
5. While it runs, check get_status every few seconds and read get_events for item_collected / item_failed / obstacle.
6. If an item fails 3 times, do not keep retrying it; tell the user where it is.
7. If anything looks wrong (a keep item near the robot, repeated obstacles, the robot stuck), call stop immediately.
8. Finish with a short report: collected, failed, skipped, and anything left for the user to handle.
```

### 8.4 Mock robot (`mock-robot/server.ts`, Node `http` only)
- Implements every route in Section 7, same JSON shapes, validated with the zod schemas from `contract.ts`.
- `/api/clean` simulates a session: SEARCH → APPROACH → ALIGN → SCOOP → TIP → VERIFY about once per second per item, emitting events, until `max_items` or `max_time_s` is reached.
- `MOCK_FAIL_EVERY=n` makes every n-th item fail 3 times (to exercise failure handling); `MOCK_TOKEN` enables token checks; `MOCK_PORT` (default 8787).
- `/api/photo` serves a small valid JPEG from `placeholder.ts` (a base64 constant generated once by `tools/make_placeholder_jpeg.py` with Pillow).

### 8.5 Packaging (`.mcpb`) and Claude Desktop
- `manifest.json` for the `mcpb` CLI: name `trashbot`, display name "TrashBot", Node server entry `dist/index.js`, user config `robot_url` (default `http://trashbot.local`) and `token` (optional, sensitive) mapped to `TRASHBOT_URL` / `TRASHBOT_TOKEN`. Validate it with the CLI.
- `npm run pack` produces `trashbot.mcpb`. If packaging fails, document the manual `claude_desktop_config.json` entry (command `node`, absolute path to `dist/index.js`, env vars) instead.
- Installation steps go in `USER_STEPS.md` and `docs/AGENT.md`, following Anthropic's help article "Getting Started with Local MCP Servers on Claude Desktop". Never edit my Claude Desktop settings.
- `docs/AGENT.md` must explain that Gate 7 needs the robot on the home WiFi (station mode via `secrets.h`), because the laptop needs internet for Claude.

### 8.6 Evals
- `evals/photos/trash/` and `evals/photos/keep/` (empty, with `.gitkeep`), plus `evals/README.md`: how to run the manual eval in Claude Desktop (show each photo, ask trash-or-keep, record the answers) and a results table template (accuracy, false "trash" on keep items — the most important number).
- `evals/run_api_eval.ts`: runs the same eval through the Claude API **only** if `ANTHROPIC_API_KEY` is set (note in the README that API usage is billed separately from a Claude subscription); otherwise it prints instructions and exits with code 0.

---

## 9. Python tools specification (cross-platform, `pathlib`, `argparse`, clear `--help`)
- `common.py`: `centre_crop_box(w, h, size)`, `transform_bbox_after_crop_resize(bbox, crop_box, out_size)`, `read_jsonl(path)`.
- `collect_photos.py --url http://192.168.4.1 --count 50 --interval 1.5 --out dataset/raw/<timestamp> --crop 240`: fetches `/api/photo`, centre-crops to 240×240, saves JPEG quality 95, shows progress, survives timeouts, prints tips (vary distance, light and angle; include leave-alone items).
- `taco_subset.py --out dataset/taco_subset --max-images 200 --test-split 0.2 --size 240 --keywords paper,wrapper,film,cap,can,cup,crisp,tissue,straw,carton,packet`: downloads TACO `data/annotations.json` from the TACO repo, picks categories whose names contain a keyword (case-insensitive), downloads images (prefer the 640 px URL), centre-crops and resizes to 240, transforms the boxes (dropping ones under 4 px or outside the crop), and writes `training/` and `testing/` folders, each with `_annotations.coco.json` using a single category `trash`. Writes `LICENSE_NOTE.md` with TACO's data licence terms, copied from its README. 15 s timeout per image; skips failures.
- `log_report.py <events.json | events.jsonl>`: per session (by label) — collected, failed, skipped, average seconds per item, obstacle count — printed as a Markdown table.
- `make_placeholder_jpeg.py`: generates a small valid JPEG and prints the TypeScript `placeholder.ts` content.
- `requirements.txt`: requests, pillow, tqdm. `requirements-dev.txt`: pytest.

---

## 10. Reference repositories — download, reuse, delete

Run `git clone --depth 1 <url> references/<name>` for each, and record `git -C references/<name> rev-parse HEAD` in `docs/REFERENCES.md`. If a clone fails, note it and continue.

| # | Repository | Licence (verify the actual LICENSE file) | Take | Ignore |
|---|---|---|---|---|
| 1 | https://github.com/Mjrovai/XIAO-ESP32S3-Sense | Apache-2.0 | Camera pins and init; the Edge Impulse object-detection inference loop (`run_classifier` on camera frames, reading FOMO results, RGB888 → EI signal callback); data-collection web server; mic/KWS code (only for the PDM mic setup used by clap-to-start) | IMU tutorials, PDFs |
| 2 | https://github.com/vishalmysore/choturobo | MIT | TypeScript MCP server structure and tool-definition patterns | Johnny-Five/serial layer (replace with HTTP to our robot), Java/Spring, LED/fan/relay/temperature/buzzer tools |
| 3 | https://github.com/ultrafro/garbagecollector | MIT | Autonomy cycle, grasp verification + retry logic, tracking between detections — port the **logic** into `core/brain` | LeKiwi / SO-101 / Raspberry Pi / WebSocket / GPU / VLM code |
| 4 | https://github.com/claireebear/HackGT-Trash-Robot- | MIT | State-machine layout, TB6612 control approach, lift-and-tilt dumping idea, config handling | Person following, AprilTags, bin navigation, Pi code |
| 5 | https://github.com/dngvmnh/Trash_Collecting_Robot | Apache-2.0 | Running detection and obstacle checks concurrently; the camera-distance idea (adapted to vertical image position — FOMO has no real box sizes) | Jetson, TinyYOLOv3, RPLidar, CAD |
| 6 | https://github.com/NVIDIA-Jetson/jetson-trashformers | mixed → **read only** | The pick-up trigger idea (notes only) | All code |
| 7 | https://github.com/pedropro/TACO | MIT for code; record the data licence from its README | Annotation format + download approach → `tools/taco_subset.py` | Mask R-CNN detector, notebooks |
| 8 | https://github.com/ConeNDev/AI-Powered-Thrash-Can | none found → **read only** | HSV + ballistic-fit ideas → `docs/FUTURE_CATCH_MODE.md` in your own words | All code |
| 9 | https://github.com/Sanjith1009/trash-catcher | none found → **read only** | Notes for `docs/FUTURE_CATCH_MODE.md` | All code |
| 10 | https://github.com/Vedant28082005/esp32-mcp-server | none found → **read only** | How ESP32 HTTP endpoints map to MCP tools | All code |

**Licence rules**
- MIT / Apache-2.0: you may copy and adapt. In each copied or adapted file keep the original copyright/licence header and add `Adapted from <repo> (<licence>). Changes: <summary>`. Save the licence text to `third_party/<repo-name>/LICENSE`.
- No licence / unclear: never copy code or long passages; write your own implementation and notes in your own words.
- If a repo's real LICENSE differs from this table, trust the file and apply the stricter rule.

**Then:** write in `docs/REFERENCES.md`, for each repo, the commit, licence, what you reused and where it lives now, and what you ignored and why. **Delete the whole `references/` folder.**

`docs/FUTURE_CATCH_MODE.md` (own words, marked "not implemented"): an external camera mounted high, directly above the thrower's spot, so each throw appears as a nearly straight line in the image; fit the track after 4–6 frames; predict where it crosses the bin's line; the bin drives along a taped line like a goalkeeper; start with a physics fit, then add a learned correction from logged throws; realistic limits (gentle lobs, roughly 30–40 cm of bin travel).

---

## 11. Complete test list

**Firmware, native Unity (`python -m platformio test -d firmware -e native`)**
- `test_motor_math`: clamp; cap at 70 %; ramp step limits both directions; arcade mixing; `pctToDuty` at 10-bit including 0 and ±100.
- `test_safety`: estop → 0; forward blocked at 14 cm, allowed at 16 cm; reverse and turn-in-place allowed while blocked; scoop-DOWN self-echo ignored; low battery → 0.
- `test_target`: highest score wins; tie → larger y; min-score filter; stale detections ignored; scoop-zone edges; steering deadband and sign; approach speed ramp.
- `test_image_ops`: crop offsets for 320×240 → 240×240; resize output size; pixel values on a synthetic gradient.
- `test_timed_move`: turn/move durations from calibration; completion timing.
- `test_scoop_seq`: step order; servo rate limit; creep duration.
- `test_brain` (scripted scenarios with fake time and detections):
  1. target centred → ALIGN → SCOOP → TIP → VERIFY → `item_collected`;
  2. target on the left → turns left, on the right → turns right;
  3. target lost → REACQUIRE → SEARCH;
  4. obstacle during approach → AVOID;
  5. scoop fails 3× → `item_failed` → SEARCH;
  6. time limit → DONE;
  7. `max_items` reached → DONE;
  8. ESTOP from every state; reset → IDLE;
  9. MANUAL commands expire;
  10. full 360° search with nothing → forward step;
  11. `stop` from every state → IDLE;
  12. camera unavailable in auto → DONE.
- `test_event_ring`: overwrite when full, increasing sequence numbers, `since` filter.

**Agent, vitest (`npm test` in `agent/`)**
- `robotClient`: every endpoint; token header; timeout; robot offline → friendly error; bad JSON.
- Tools against the mock robot: each tool; `take_photo` returns image content whose data starts with JPEG bytes FF D8; `stop` retries.
- Contract: mock responses parse with the zod schemas in `contract.ts`.
- Mock session: `start_cleaning` → events show collected items; with `MOCK_FAIL_EVERY` → `item_failed` appears.
- Prompt: `clean_room` is registered and contains the safety rules.

**Python, pytest (`python -m pytest tools/tests -q`)**
- Crop box maths; bbox transform (inside / partly outside / tiny → dropped); COCO writer output structure; `log_report` statistics on a sample log.

---

## 12. Documents to write (all mandatory)
- `README.md` — what it is, architecture (Mermaid: robot reflexes ↔ HTTP API ↔ MCP server ↔ Claude), BOM, quick start, gate status table, links to every doc.
- `docs/PLAN.md` — progress log at the top (dated entries), gate table (software status / hardware test status), known issues.
- `docs/USER_STEPS.md` — one ordered checklist from buying parts to the Gate 7 demo: tools to install; assembly; setting buck voltages with a multimeter; wiring per `WIRING.md`; first power-on checks; flashing (`python -m platformio run -d firmware -e xiao -t upload`, USB-C, power switch OFF, how to enter bootloader mode if the upload fails); joining the `TrashBot-XXXX` WiFi and opening `192.168.4.1`; G1 checklist; calibration; photo collection; Edge Impulse training and export (project named `TrashBot`); dropping the library into `firmware/lib/`; G2–G6 tests; filling `secrets.h` for home WiFi; building and installing the `.mcpb`; the G7 demo and eval.
- `docs/DECISIONS.md` — every decision and assumption (date, decision, why, how to change).
- `docs/REFERENCES.md` — Section 10 results.
- `docs/API.md` — Section 7, with an example for each route in both PowerShell (`Invoke-RestMethod`) and `curl`.
- `docs/WIRING.md` — pin table, power table, ASCII wiring diagram, safety notes (buck voltages, common ground, echo divider, heatsink, capacitors, servo on its own supply, USB + battery warning).
- `docs/TESTING.md` — per-gate checklists (G1: each direction, turn in place, obstacle stop at 15 cm, release → stops within about 0.3 s, STOP button, ESTOP; …) and the scenario suite table (bright light, dim light, near a wall, in a corner, two items close together, look-alike non-trash next to trash, cluttered floor, dark vs light floor) with columns: setup, expected, actual, pass/fail, notes.
- `docs/DATASET.md` — ≥ 150 photos with trash taken **by the robot's own camera at its mounting height** + ≥ 50 without trash; leave-alone items (phone, keys, slippers, charger, earphones) included **unlabelled**; variety of light, floor, distance (20–100 cm) and angle; one label `trash`; Edge Impulse steps (free Developer plan; project **TrashBot**; upload; label; impulse = 96×96 image, object detection, FOMO MobileNetV2 0.35; try grayscale if too slow; target F1 ≥ 0.8; export Arduino library, quantised int8); where to put the library and how to rebuild; optional TACO experiment (with vs without, compare F1); check Edge Impulse's current docs for a recommended Arduino-ESP32 core version and note it.
- `docs/AGENT.md` — architecture, tools table, the `clean_room` prompt, WiFi requirement, install steps, troubleshooting, evals.
- `docs/FUTURE_CATCH_MODE.md` — Section 10.
- `AGENTS.md` — a short version of Sections 0, 14 and the `lib/core` purity rule.
- `dataset/README.md` — folder conventions.

---

## 13. Phases, commands and commits

Before Phase 0, create the checklist of all phases in `docs/PLAN.md` and tick items off as you go.

**Phase 0 — Environment and skeleton**
1. `git --version`, `python --version`, `node --version`, `npm --version` → install anything missing (Section 1).
2. `python -m pip install --upgrade pip platformio` → `python -m platformio --version`.
3. `git init`; set the repo-local identity if none exists; create `.gitignore`, `.gitattributes`, `LICENSE`, `AGENTS.md`, the `docs/` skeleton, and `docs/MASTER_PROMPT.md` (this document, verbatim).
4. Commit `chore: project skeleton`.

**Phase 1 — References**
1. Section 10 end to end, including `third_party/` licences, `docs/REFERENCES.md` and `docs/FUTURE_CATCH_MODE.md`.
2. Delete `references/`.
3. Commit `chore: reuse reference code with attribution, remove downloads`.

**Phase 2 — Firmware core + Gate 1**
1. `platformio.ini`, `config.h`, `secrets.example.h`, `lib/core` (types, motor_math, safety_logic, timed_move, event_ring) + tests.
2. `lib/hw` motors, ultrasonic, servo, status_led, battery; `lib/store`; `lib/net` (WiFi, API routes for status/mode/drive/move/turn/scoop/stop/estop/log/calib, web UI Drive + Log tabs); `main.cpp` with tasks.
3. `python -m platformio test -d firmware -e native` and `python -m platformio run -d firmware -e xiao` → fix until green. Pin ArduinoJson's exact version.
4. Docs: `WIRING.md`, G1 in `TESTING.md`, G1 section in `USER_STEPS.md`, first version of `API.md`.
5. Commit `feat(firmware): drive, safety, web UI and API (Gate 1)`.

**Phase 3 — Vision + Gate 2 tooling**
1. `core/image_ops` + `core/target` + tests; `hw/camera`, `detector_fake`, `detector_ei` (+ stub); vision task; `/api/photo`; Camera tab.
2. `tools/` (common, collect_photos, taco_subset, placeholder script) + pytest; `python -m pip install -r tools/requirements.txt -r tools/requirements-dev.txt`; `python -m pytest tools/tests -q`.
3. `DATASET.md`, G2 sections of `TESTING.md` and `USER_STEPS.md`.
4. Build + all tests green. Commit `feat(vision): camera pipeline, detectors and dataset tools (Gate 2)`.

**Phase 4 — Brain + Gates 3–5**
1. `core/scoop_seq`, `core/brain` + all brain scenario tests; wire into `controlTask`; `/api/clean`; Auto + Calibrate tabs; calibration endpoints.
2. Build + all tests green. Docs for G3–G5.
3. Commit `feat(brain): autonomous search, approach, scoop and verify (Gates 3-5)`.

**Phase 5 — Gate 6 extras**
1. `hw/sound_trigger` (clap to start); scenario label in sessions; `tools/log_report.py` + tests; scenario suite in `TESTING.md`; keyword-spotting future note in `DATASET.md`.
2. Build + all tests green. Commit `feat: event log reports, scenario suite, clap to start (Gate 6)`.

**Phase 6 — Gate 7 agent**
1. `agent/` per Section 8: contract, client, tools, prompt, mock robot, tests, manifest, evals.
2. `npm install`, `npm run build`, `npm test`, `npm run pack` (or the documented fallback).
3. `docs/AGENT.md`, G7 sections of `TESTING.md` and `USER_STEPS.md`; finalise `API.md`.
4. Commit `feat(agent): MCP server, mock robot, evals and .mcpb package (Gate 7)`.

**Phase 7 — CI and final pass**
1. `.github/workflows/ci.yml`: firmware job (`pip install platformio`, `pio run -d firmware -e xiao`, `pio test -d firmware -e native`), agent job (Node 20: `npm ci`, `npm run build`, `npm test`), tools job (`pytest`).
2. Run everything once more from clean: firmware build, native tests, `npm ci` + build + test, pytest.
3. Finish `README.md`, `PLAN.md` (all gates: software done or known issue; hardware test pending user), and the complete `USER_STEPS.md`.
4. Commit `docs: final pass`, then write the final report (Section 16).

---

## 14. MUST / MUST NOT

**MUST**
- Save this document as `docs/MASTER_PROMPT.md` first; re-read it at the start of every phase.
- Keep `lib/core` free of Arduino/ESP headers and fully tested.
- Put every number in `config.h` (units in names or comments); calibration overrides via NVS.
- Route every motor command through `safety_logic`.
- Record every decision in `DECISIONS.md`; keep licences and attribution for reused code.
- Make one commit per phase; keep builds and tests green.
- Keep `USER_STEPS.md` complete enough that I can reach the Gate 7 demo without asking anyone.
- Mark hardware tests "pending user test", never "passed".

**MUST NOT**
- Ask me anything, wait for approval, or end a message with a question.
- Upload/flash firmware or open a serial monitor.
- Touch anything outside this project folder; inside it, delete only `references/` and files you created.
- Push to a remote or create GitHub repositories.
- Copy code from repos #6, #8, #9, #10 (no clear licence).
- Keep Jetson / ROS / Caffe / Raspberry Pi / Johnny-Five / Java code.
- Put Python or an LLM on the robot, or make Gates 1–6 depend on the laptop or internet.
- Let the web UI, API or agent bypass firmware safety.
- Use `delay()` in control code, access the camera from the web task, or reuse LEDC channel 7 / timer 3.
- Power the servo from the XIAO or run the TT motors at the full 8.4 V.
- Hardcode or commit WiFi passwords, tokens, API keys, `secrets.h`, datasets or large binaries.
- Fake a trained model or test results — use clearly named stubs.
- Use external CDNs in the robot's web page.
- Write anything but MCP protocol messages to stdout in the MCP server.
- Edit my Claude Desktop config or any other app's settings.

---

## 15. Definition of done
- [ ] `python -m platformio run -d firmware -e xiao` → success (stub detector, no model yet)
- [ ] `python -m platformio test -d firmware -e native` → all pass (or missing host compiler documented)
- [ ] `agent/`: `npm ci`, `npm run build`, `npm test` → all pass; `npm run mock` starts
- [ ] `trashbot.mcpb` built, or the manual config fallback documented
- [ ] `python -m pytest tools/tests -q` → all pass
- [ ] `references/` deleted; `REFERENCES.md` and `third_party/` complete
- [ ] Every document in Section 12 exists and is filled in
- [ ] Every gate: software status + "hardware test: pending user test"
- [ ] One commit per phase; working tree clean

---

## 16. Final report (your only final message)
1. What was built, by folder
2. Every build/test command run, with pass counts
3. Per reference repo: reused → where; ignored; deleted
4. Your 10 most important decisions
5. My next steps from `USER_STEPS.md`, in order, short
6. Known issues

---

## 17. Bill of materials (approximate India prices, September 2026)

| Part | Approx. price |
|---|---|
| Seeed XIAO ESP32S3 Sense | ₹1,585 |
| TB6612FNG motor driver | ₹157–194 |
| 4WD chassis with 4 motors and wheels | ₹499–649 |
| MG996R servo (**180° version**, not 360°) | about ₹212 |
| HC-SR04 ultrasonic + 1 kΩ and 2 kΩ resistors | about ₹99 |
| 2× 18650 cells + 2-cell holder + charger | ₹500–800 |
| 2 adjustable buck converters (5 V for board + sensor; 6 V ≥ 3 A for servo) | ₹200–400 |
| Small plastic dustbin, dustpan material, wires, switch, capacitors, heatsink | ₹200–300 |
| **Total** | **about ₹3,500–4,300** |
