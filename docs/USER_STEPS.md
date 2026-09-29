# TrashBot — your checklist

Detailed steps will be filled in as each gate is implemented. Start here after software build is complete.

1. Install tools: Git, Python 3.10+, Node 20 LTS, PlatformIO (`python -m pip install platformio`).
2. Buy parts per `README.md` BOM and `docs/WIRING.md`.
3. Set buck converters to 5.0 V and 6.0 V before connecting loads.
4. Wire per pin map; power switch OFF when USB-C is used for flashing.
5. Build firmware: `python -m platformio run -d firmware -e xiao` (upload only when board is connected).

(More steps added in later phases.)
