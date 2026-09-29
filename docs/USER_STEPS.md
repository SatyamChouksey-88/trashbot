# TrashBot — your checklist

Work through in order. Software is already in this repo; you bring hardware, flashing, and field tests.

## 1. Tools on your PC

1. Git, Python 3.10+, Node 20 LTS (no admin installers required on a locked-down laptop).
2. `python -m pip install platformio ziglang` (use `python -m platformio`, not bare `pio`).
3. Core firmware unit tests (no MSVC/WSL): `python tools/run_core_tests.py` (uses `python -m ziglang c++`). CI also runs `platformio test -e native` on Linux.
4. Verify: `python -m platformio run -d firmware -e xiao`, `python tools/run_core_tests.py`, `python -m pytest tools -q`, `cd agent && npm ci && npm test`.

## 2. Parts and mechanical

1. Buy BOM in `README.md` / master prompt Section 17.
2. Mount XIAO on mast, camera tilted to see floor 20–100 cm ahead.
3. Attach dustpan arm (MG996R **180°**), ultrasonic forward, heatsink on ESP32-S3.

## 3. Power and wiring

1. Fit a **2S Li-ion BMS** on the pack; set buck #1 to **5.0 V**, buck #2 to **6.0 V** (multimeter before connecting).
2. Wire per `docs/WIRING.md` (TB6612, servo on 6 V, common ground, ECHO divider). Optional: front bumper on D6, battery divider on D2 (`config.h` flags default off).
3. Power switch **OFF** when using USB-C for flashing.

## 4. First flash and G1

1. Copy `firmware/include/secrets.example.h` → `secrets.h` (can leave WiFi empty for AP mode).
2. `python -m platformio run -d firmware -e xiao -t upload` (bootloader: hold BOOT if needed).
3. Join `TrashBot-XXXX` WiFi, password `trashbot123`, open http://192.168.4.1.
4. G1 checklist in `docs/TESTING.md`: drive, obstacle stop, dead-man, STOP, ESTOP.

## 5. Calibration (web **Calibrate** tab)

1. Servo DOWN / CARRY / TIP angles, scoop zone from a detection, self-echo with scoop DOWN.
2. Optional: measure turn and forward speeds (web prompts or manual notes → NVS keys).

## 6. Gate 2 — dataset and Edge Impulse

1. `python tools/collect_photos.py --url http://192.168.4.1 --count 50 --crop 240`.
2. Follow `docs/DATASET.md`: project name **`TrashBot`**, FOMO, export Arduino library.
3. Drop library in `firmware/lib/TrashBot_inferencing/`, rebuild and reflash.
4. G2 hardware checklist in `docs/TESTING.md`.

## 7. Gates 3–6 on the floor

1. Run autonomy and scenario rows in `docs/TESTING.md`.
2. Clap-to-start from idle (tune `SOUND_TRIGGER_LEVEL` in `config.h` if needed).
3. `python tools/log_report.py` on exported `/api/log` JSON for session stats.

## 8. Gate 7 — agent in Cursor (primary)

1. `cd agent && npm ci && npm run build` (bundled `dist/index.js`).
2. In a terminal: `npm run mock` (http://localhost:8787).
3. Open this repo in **Cursor**; enable the **trashbot** MCP server from `.cursor/mcp.json` (Settings → MCP).
4. In Cursor chat, run the **clean_room** prompt against the mock; later set `TRASHBOT_URL` to `http://192.168.4.1` or `http://trashbot.local` when the robot is on your LAN (`secrets.h` WiFi for home).

**Optional (personal PC):** `npm run pack` → `trashbot.mcpb` for Claude Desktop — see `docs/AGENT.md`.
