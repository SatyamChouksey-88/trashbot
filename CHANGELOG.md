# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] - 2026-09-30

### Added

- ESP32-S3 Sense firmware: drive, vision (FakeDetector + Edge Impulse hook), autonomy brain, safety layer, web UI, HTTP API.
- v3: digital-twin simulator, reliability (motor lease, watchdog, stuck recovery, health API), missions, learning bandit, expanded CI.
- v4 Bolo: Hinglish/English command parser (`shared/lang`), phone Bolo box, learned phrase aliases, MCP `run_command`.
- MCP agent with `read_only` / `dry_run` / `full` modes; mock robot for tests.

### Known limitations

- **Hardware not field-tested** — software gates are CI-backed; G0–G11 on a physical robot are pending the owner.
- Edge Impulse model not shipped in-repo; use `FakeDetector` until `TrashBot_inferencing` is added locally.
- Optional battery monitor and bumper are off by default until wired and enabled in `config.h`.
