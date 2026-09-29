"""Office-laptop / EPDR: skip zig-native binaries when TRASHBOT_NO_NATIVE=1."""
from __future__ import annotations

import os
import sys

SKIP_MSG = (
    "Skipped native C++/sim binary (TRASHBOT_NO_NATIVE=1). "
    "Runs in GitHub Actions CI or on a personal machine without endpoint blocking."
)


def native_skipped() -> bool:
    v = os.environ.get("TRASHBOT_NO_NATIVE", "").strip().lower()
    return v in ("1", "true", "yes")


def skip_exit_ok() -> int:
    print(SKIP_MSG, file=sys.stderr)
    return 0
