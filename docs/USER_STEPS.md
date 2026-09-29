# TrashBot — your checklist

Work through in order. Software is already in this repo; you bring hardware, flashing, and field tests.

## 1. Tools on your PC

1. Git, Python 3.10+, Node 20 LTS.
2. `python -m pip install platformio` (use `python -m platformio`, not bare `pio`).
3. Optional: C++ toolchain for firmware unit tests — LLVM, MSVC Build Tools, or WinLibs (if install fails, use WSL or skip; CI runs native tests on Linux).
4. Verify: `python -m platformio run -d firmware -e xiao`, `python -m pytest tools -q`, `cd agent && npm ci && npm test`.

## 2. Parts and mechanical

1. Buy BOM in `README.md` / master prompt Section 17.
2. Mount XIAO on mast, camera tilted to see floor 20–100 cm ahead.
3. Attach dustpan arm (MG996R **180°**), ultrasonic forward, heatsink on ESP32-S3.

## 3. Power and wiring

1. Set buck #1 to **5.0 V**, buck #2 to **6.0 V** (multimeter before connecting).
2. Wire per `docs/WIRING.md` (TB6612, servo on 6 V, common ground, ECHO divider).
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

## 8. Gate 7 — agent on laptop

1. Copy `secrets.h` with home `WIFI_SSID` / `WIFI_PASS` so robot and laptop share LAN.
2. `cd agent && npm ci && npm run build && npm run pack` → install `agent.mcpb` (`docs/AGENT.md`).
3. Claude: use **clean_room** prompt; confirm trash vs keep behaviour with eval photos in `agent/evals/`.
