"""Pin map in firmware/include/config.h must not reuse GPIO numbers."""

import re
from pathlib import Path

CONFIG = Path(__file__).resolve().parents[2] / "firmware" / "include" / "config.h"


def _pin_constants() -> dict[str, int]:
    text = CONFIG.read_text(encoding="utf-8")
    found: dict[str, int] = {}
    for line in text.splitlines():
        for m in re.finditer(r"PIN_(\w+)\s*=\s*(-?\d+)", line):
            found[m.group(1)] = int(m.group(2))
    return found


def test_pin_map_no_duplicate_gpio():
    pins = _pin_constants()
    assert pins, "no PIN_* constants parsed from config.h"
    values = list(pins.values())
    assert len(values) == len(set(values)), f"duplicate GPIO in pin map: {pins}"


def test_bumper_43_echo_44():
    pins = _pin_constants()
    assert pins.get("BUMPER") == 43
    assert pins.get("US_ECHO") == 44
    assert pins["BUMPER"] != pins["US_ECHO"]
