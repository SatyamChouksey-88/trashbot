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
