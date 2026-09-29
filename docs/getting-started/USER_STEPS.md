# TrashBot — your checklist

Work through in order. Software is already in this repo; you bring hardware, flashing, and field tests.

## 1. Tools on your PC

1. Git, Python 3.10+, Node 20 LTS (no admin installers required on a locked-down laptop).
2. **Restricted dev machine:** set user env `TRASHBOT_NO_NATIVE=1` if endpoint security blocks new native `.exe` files. Core tests and the simulator run in **GitHub Actions** instead.
3. `python -m pip install platformio` (and `ziglang` only on machines that allow compiling test `.exe` files).
4. Verify locally: `python -m platformio run -d firmware -e xiao`, `python -m pytest tools -q`, `cd agent && npm ci && npm run build && npm test`. Skip `tools/run_core_tests.py` when `TRASHBOT_NO_NATIVE=1` (it prints a skip message). E2E: CI only unless `TRASHBOT_E2E_LOCAL=1` and Playwright installed.
5. Before flashing hardware: `python tools/release_check.py` must print **GO** (on CI or a personal PC with native tools enabled).

## 2. Parts and mechanical

1. Buy BOM in `README.md` / master prompt Section 17.
2. Mount XIAO on mast, camera tilted to see floor 20–100 cm ahead.
3. Attach dustpan arm (MG996R **180°**), ultrasonic forward, heatsink on ESP32-S3.

## 3. Power and wiring

1. Fit a **2S Li-ion BMS** on the pack; set buck #1 to **5.0 V**, buck #2 to **6.0 V** (multimeter before connecting).
2. Wire per `docs/getting-started/WIRING.md` (TB6612, servo on 6 V, common ground, ECHO divider). Optional: front bumper on D6, battery divider on D2 (`config.h` flags default off).
3. Power switch **OFF** when using USB-C for flashing.

## 4. First flash and G1

1. Copy `firmware/include/secrets.example.h` → `secrets.h` (can leave WiFi empty for AP mode).
2. `python -m platformio run -d firmware -e xiao -t upload` (bootloader: hold BOOT if needed).
3. Join `TrashBot-XXXX` WiFi, password `trashbot123`, open http://192.168.4.1.
4. G1 checklist in `docs/reference/TESTING.md`: drive, obstacle stop, dead-man, STOP, ESTOP.

## 5. G0 — Bring-up wizard (web **Bring-up** tab)

1. Put the robot on a box so the wheels are **off the ground**.
2. Open **Bring-up** → pulse left/right wheels; toggle **invert** / **swap** until each side spins forward as labeled.
3. Set servo angles (or use **Calibrate**), check ultrasonic at ~30 cm to a box, confirm camera snapshot is upright (flip checkbox if needed).
4. Save scoop zone from a paper ball in the **Calibrate** tab.
5. Click **Finish bring-up** (manual mode). `/api/status` should show `bringup_done: true` and `POST` ok in serial log.
6. Auto clean stays blocked with **409** until bring-up and minimum calibration are done.

## 6. Calibration (web **Calibrate** tab)

1. Servo DOWN / CARRY / TIP angles, scoop zone from a detection, self-echo with scoop DOWN.
2. Optional: measure turn and forward speeds (web prompts or manual notes → NVS keys).

## 6. Gate 2 — dataset and Edge Impulse

1. `python tools/collect_photos.py --url http://192.168.4.1 --count 50 --crop 240`.
2. Follow `docs/reference/DATASET.md`: project name **`TrashBot`**, FOMO, export Arduino library.
3. Drop library in `firmware/lib/TrashBot_inferencing/`, rebuild and reflash.
4. G2 hardware checklist in `docs/reference/TESTING.md`.

## 7. Gates 3–6 on the floor

1. Run autonomy and scenario rows in `docs/reference/TESTING.md`.
2. Clap-to-start from idle (tune `SOUND_TRIGGER_LEVEL` in `config.h` if needed).
3. `python tools/log_report.py` on exported `/api/log` JSON for session stats.

## 8. Gate 7 — agent in Cursor (primary)

1. `cd agent && npm ci && npm run build` (bundled `dist/index.js`).
2. In a terminal: `npm run mock` (http://localhost:8787).
3. Open this repo in **Cursor**; enable the **trashbot** MCP server from `.cursor/mcp.json` (Settings → MCP).
4. In Cursor chat, run the **clean_room** prompt against the mock; later set `TRASHBOT_URL` to `http://192.168.4.1` or `http://trashbot.local` when the robot is on your LAN (`secrets.h` WiFi for home).

**Optional:** `npm run pack` → `trashbot.mcpb` for an MCP-compatible desktop app — see `docs/reference/AGENT.md`.

## 9. Gate G11 — Bolo on hardware

1. Flash latest `xiao` firmware (includes Bolo box on the web page).
2. Wheels **off the ground** first: type `50 cm aage` in Bolo, then `ruko` — motion must stop quickly.
3. `aage mat jao` must not move the wheels.
4. On the floor after calibration: `20 cm aage`, `90 degree left ghumo`, voice `kachra saaf karo` + `ruko`.
5. Teach a phrase (confirm “yaad rakhun?”), reboot, confirm it still works; delete via Settings / aliases reset if needed.
6. Full checklist: `docs/reference/TESTING.md` § G11 and `docs/dev/prompts/MASTER_PROMPT_V4.md` §8.
