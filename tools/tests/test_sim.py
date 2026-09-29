import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SIM = ROOT / "tools" / "sim"


def test_sim_physics_ultrasonic():
    sys.path.insert(0, str(SIM))
    from room import Ball, KeepItem, RoomSim

    sim = RoomSim()
    sim.robot.x = 2.0
    sim.robot.y = 1.5
    sim.robot.theta = 0.0
    d = sim.ultrasonic_cm()
    assert 150 < d < 250
    sim.keep_items.append(KeepItem(1.0, 1.0))
    dets = sim.camera_detections(include_keep=True)
    assert isinstance(dets, list)
    b = Ball(2.0, 1.5, is_trash=False)
    sim.balls.append(b)
    assert sim.remaining_trash() >= 0


def test_sim_scenarios_load():
    sys.path.insert(0, str(SIM))
    from load_scenarios import list_scenarios, load_scenario

    names = list_scenarios()
    assert "basic_clean" in names
    assert len(names) >= 16
    spec = load_scenario("obstacle_ahead")
    assert spec["robot"]["x"] < 0.5


def test_sim_fault_engine():
    sys.path.insert(0, str(SIM))
    from faults import FaultEngine

    eng = FaultEngine(faults=[{"at_s": 1.0, "type": "bumper_hit", "duration_s": 1.0}])
    assert not eng.effect_at(500).bumper
    assert eng.effect_at(1500).bumper


def test_sim_run_skips_without_native():
    env = {**os.environ, "TRASHBOT_NO_NATIVE": "1"}
    run = subprocess.run(
        [sys.executable, str(SIM / "run.py"), "--scenario", "basic_clean", "--runs", "1"],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        timeout=30,
        env=env,
    )
    assert run.returncode == 0
    assert "Skipped native" in run.stderr or "skip" in run.stderr.lower()


def test_sim_brain_smoke():
    if os.environ.get("TRASHBOT_NO_NATIVE", "").strip().lower() in ("1", "true", "yes"):
        return
    build = subprocess.run(
        [sys.executable, str(SIM / "build_sim_brain.py")],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert build.returncode == 0, build.stderr
    run = subprocess.run(
        [sys.executable, str(SIM / "run.py"), "--scenario", "basic_clean", "--runs", "2"],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        timeout=180,
        env=os.environ,
    )
    assert run.returncode == 0, run.stdout + run.stderr
    assert "basic_clean" in run.stdout
