# Decisions log

| Date | Decision | Why | How to change |
|------|----------|-----|---------------|
| 2026-09-29 | Python 3.14.5 on host | Already installed on dev machine | Use 3.12+ per master prompt if CI needs it |
| 2026-09-29 | PlatformIO via `python -m platformio` | `pio` not on PATH | Add Scripts folder to PATH or keep using `-m` |
