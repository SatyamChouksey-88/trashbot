# TrashBot

Small ESP32-S3 robot dustbin: on-device vision, autonomous scooping, and an optional Claude MCP agent on your laptop.

## Quick start (software)

```bash
python -m pip install platformio
python -m platformio run -d firmware -e xiao
cd agent && npm ci && npm run build && npm test
python -m pip install -r tools/requirements.txt -r tools/requirements-dev.txt
python -m pytest tools/tests -q
```

Hardware assembly, flashing, and Gate checklists: `docs/USER_STEPS.md`.

## Docs

| Doc | Purpose |
|-----|---------|
| [docs/MASTER_PROMPT.md](docs/MASTER_PROMPT.md) | Full build specification |
| [docs/PLAN.md](docs/PLAN.md) | Progress and gate status |
| [docs/WIRING.md](docs/WIRING.md) | Pin map and power (to be expanded) |
| [docs/API.md](docs/API.md) | Robot HTTP API |

## Gates

Software is in progress; hardware validation is always **pending user test** until you run the checklists on the physical robot.
