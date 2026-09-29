#!/usr/bin/env python3
from __future__ import annotations

import subprocess
import sys
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
from native_env import native_skipped, skip_exit_ok
SIM = Path(__file__).resolve().parent
CORE = ROOT / "firmware" / "lib" / "core"
INCLUDE = ROOT / "firmware" / "include"
OUT = SIM / "sim_brain.exe" if sys.platform == "win32" else SIM / "sim_brain"


def main() -> int:
    if native_skipped():
        return skip_exit_ok()
    sources = [str(CORE / f.name) for f in CORE.glob("*.cpp")]
    cmd = [
        sys.executable,
        "-m",
        "ziglang",
        "c++",
        "-std=c++17",
        f"-I{INCLUDE}",
        f"-I{CORE}",
        "-O2",
        str(SIM / "sim_brain_main.cpp"),
        *sources,
        "-o",
        str(OUT),
    ]
    if sys.platform == "win32":
        cmd.insert(4, "-static")
    r = subprocess.run(cmd, cwd=str(ROOT))
    return r.returncode


if __name__ == "__main__":
    raise SystemExit(main())
