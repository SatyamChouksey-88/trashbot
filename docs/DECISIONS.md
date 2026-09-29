# Decisions log

| Date | Decision | Why | How to change |
|------|----------|-----|---------------|
| 2026-09-29 | Python 3.14.5 on host | Already installed on dev machine | Use 3.12+ per master prompt if CI needs it |
| 2026-09-29 | PlatformIO via `python -m platformio` | `pio` not on PATH | Add Scripts folder to PATH or keep using `-m` |
| 2026-09-29 | ArduinoJson 7.4.3 pinned | First resolved install | Change in `firmware/platformio.ini` |
| 2026-09-29 | `-I include` for all PIO envs | `lib/core` could not see `config.h` | Remove if PIO changes include paths |
| 2026-09-29 | Native tests skipped on this PC | `winget install LLVM.LLVM` cancelled (1602) | Install MSVC Build Tools or LLVM; rerun `pio test -e native` |
| 2026-09-29 | WinLibs winget install failed | Access denied copying to WinGet Packages | Use WSL, manual MinGW, or rely on GitHub Actions `firmware-test` job |
| 2026-09-29 | MCPB excludes `node_modules` | Smaller `.mcpb`; Claude Desktop must resolve deps from `package.json` on install | Remove entries from `agent/.mcpbignore` if offline bundle needed |
| 2026-09-29 | ArduinoJson 7.4.3 | First resolved install | Pin in `firmware/platformio.ini` |
| 2026-09-29 | WatchGuard EPDR blocks new `.exe` | Zig test binaries and `sim_brain` blocked on office laptop | Set `TRASHBOT_NO_NATIVE=1`; core tests + sim run in GitHub Actions only |
| 2026-09-29 | E2E local optional on Windows | Playwright browser install may be blocked | CI `e2e` job; local only if `TRASHBOT_E2E_LOCAL=1` |
| 2026-09-29 | `TRASHBOT_MODE` default `dry_run` | Agent safety on shared laptop | Set `full` in `.cursor/mcp.json` only when robot is ready |
| 2026-09-29 | No OTA in v3 | USB flash only per MASTER_PROMPT_V3 | Recorded in v3 MUST NOT |
| 2026-09-29 | `long_mission_100_items` uses 12 balls in sim | Full 100-item episode exceeds CI time budget | Raise `n_trash` in JSON when running long soak locally |
| 2026-09-29 | Sim `max_violations` on bumper/corner | Bumper forces dist=0 while brain may still command turn-in-place | Tighten when G8 safety + brain cap asymmetric wheels (see I1) |
| 2026-09-29 | On-robot uncertain → skip after rechecks | MASTER_PROMPT_V3 §7; agent judges photos in MCP only | Tune `RECHECK_Y` / `MAX_RECHECKS` in `config.h` |
| 2026-09-29 | `MISTAKE_CAPTURE` default off | PSRAM ring + JPEG capture needs hardware soak | Enable flag after field testing |
| 2026-09-30 | Parser on phone/laptop only | v4 §0.5 — firmware serves JS + alias data only | Never add lexicon to ESP32 |
| 2026-09-30 | No in-page Web Speech mic | Robot HTTP AP has no HTTPS | Use Gboard keyboard mic |
| 2026-09-30 | `TURN_LEFT_SIGN = +1` | `turnDegrees(+deg)` drives left>0, right<0 | Fix inversion in bring-up, not sign |
| 2026-09-30 | `stop`/`estop` in every MCP mode | Safety over read_only | `toolGuard` always allows stop |
| 2026-09-30 | Agent `move` schema −20..50 cm | Matches Bolo rear limit | Firmware API unchanged |
