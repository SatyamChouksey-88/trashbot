# TrashBot — your checklist

Detailed steps will be filled in as each gate is implemented. Start here after software build is complete.

1. Install tools: Git, Python 3.10+, Node 20 LTS, PlatformIO (`python -m pip install platformio`).
2. Buy parts per `README.md` BOM and `docs/WIRING.md`.
3. Set buck converters to 5.0 V and 6.0 V before connecting loads.
4. Wire per pin map; power switch OFF when USB-C is used for flashing.
5. Build firmware: `python -m platformio run -d firmware -e xiao` (upload only when board is connected).

6. Install a C++ compiler for firmware unit tests (optional on PC): LLVM or MSVC Build Tools, then `python -m platformio test -d firmware -e native`.
7. Flash: `python -m platformio run -d firmware -e xiao -t upload` (power switch OFF, USB-C connected).
8. Join WiFi `TrashBot-XXXX` / password `trashbot123`, open http://192.168.4.1 — test drive, stop, estop.
9. Collect photos: `python tools/collect_photos.py --url http://192.168.4.1 --count 50`.
10. Edge Impulse project **TrashBot**, export library to `firmware/lib/TrashBot_inferencing/`, rebuild firmware.
11. Agent: `cd agent && npm ci && npm run build && npm run pack`, install `.mcpb` per `docs/AGENT.md`.
12. Fill `firmware/include/secrets.h` from `secrets.example.h` for home WiFi before Gate 7 demo.
