import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SIM = ROOT / "tools" / "sim"


def test_sim_physics_ultrasonic():
    sys.path.insert(0, str(SIM))
    from room import RoomSim

    sim = RoomSim()
    sim.robot.x = 2.0
    sim.robot.y = 1.5
    sim.robot.theta = 0.0
    d = sim.ultrasonic_cm()
    assert 150 < d < 250


def test_sim_brain_smoke():
    import os

    env = {**os.environ, "TRASHBOT_NO_NATIVE": "1"}
    build = subprocess.run(
        [sys.executable, str(SIM / "build_sim_brain.py")],
        cwd=str(ROOT),
        capture_output=True,
        env=env,
    )
    assert build.returncode == 0, build.stderr.decode()
    run = subprocess.run(
        [sys.executable, str(SIM / "run.py"), "--scenario", "bright_light", "--runs", "2"],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        timeout=120,
        env=env,
    )
    assert run.returncode == 0, run.stdout + run.stderr
    assert "Skipped native" in run.stderr or "bright_light" in run.stdout
