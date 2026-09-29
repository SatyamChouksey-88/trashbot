from __future__ import annotations

import json
import subprocess
from pathlib import Path

SIM_DIR = Path(__file__).resolve().parent
EXE = SIM_DIR / ("sim_brain.exe" if __import__("sys").platform == "win32" else SIM_DIR / "sim_brain")


class SimBrain:
    def __init__(self) -> None:
        if not EXE.is_file():
            raise FileNotFoundError(f"Run python tools/sim/build_sim_brain.py first ({EXE})")
        self.proc = subprocess.Popen(
            [str(EXE)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )

    def step(self, payload: dict) -> dict:
        assert self.proc.stdin and self.proc.stdout
        self.proc.stdin.write(json.dumps(payload, separators=(",", ":")) + "\n")
        self.proc.stdin.flush()
        line = self.proc.stdout.readline()
        return json.loads(line)

    def close(self) -> None:
        if self.proc.stdin:
            self.proc.stdin.close()
        self.proc.terminate()
