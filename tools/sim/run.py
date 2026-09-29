#!/usr/bin/env python3
"""Run digital-twin scenarios: python tools/sim/run.py --scenario all --runs 50"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

# Allow imports from this package when run as script
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(ROOT / "tools"))
from native_env import native_skipped, skip_exit_ok

from brain_pipe import SimBrain
from firmware_include import OBSTACLE_STOP_CM
from room import RoomSim
from scenarios import SCENARIOS, make_room

DT_MS = 50
MAX_STEPS = 6000


def run_episode(scenario: str, seed: int, gif_path: Path | None = None) -> bool:
    sc = SCENARIOS[scenario]
    room = make_room(sc, seed)
    brain = SimBrain()
    t_ms = 0
    started = False
    frames = []

    payload = {
        "now_ms": t_ms,
        "distance_cm": room.ultrasonic_cm(),
        "camera_ok": True,
        "detections_age_ms": 0,
        "detections": room.camera_detections(),
    }
    if not started:
        payload.update({"start": True, "start_max_items": sc.n_balls, "start_max_time_s": 120})
        started = True

    success = False
    for step in range(MAX_STEPS):
        drop = sc.light_dim and (step % 9 == 0)
        payload["now_ms"] = t_ms
        payload["distance_cm"] = room.ultrasonic_cm()
        payload["detections"] = room.camera_detections(frame_drop=drop)
        payload["detections_age_ms"] = 0 if payload["detections"] else 80
        if sc.near_wall and payload["distance_cm"] < OBSTACLE_STOP_CM:
            payload["distance_cm"] = OBSTACLE_STOP_CM + 2

        out = brain.step(payload)
        payload = {"now_ms": t_ms}
        left = out["motor"]["left"]
        right = out["motor"]["right"]
        room.robot.apply_motor(left, right, DT_MS / 1000.0)

        state = out["state"]
        if state == "SCOOP" and room.try_scoop():
            pass

        if room.remaining_trash() == 0 or out["session"]["collected"] >= sc.n_balls:
            success = True
            break
        if state in ("DONE", "ESTOP"):
            success = out["session"]["collected"] >= max(1, sc.n_balls - 1)
            break

        if gif_path is not None and step % 8 == 0:
            frames.append((room.robot.x, room.robot.y, room.robot.theta, list(room.balls)))

        t_ms += DT_MS

    brain.close()

    if gif_path and frames:
        save_gif(frames, gif_path)

    return success


def save_gif(frames, path: Path) -> None:
    import matplotlib.pyplot as plt
    from matplotlib import patches
    from matplotlib.animation import FuncAnimation, PillowWriter

    fig, ax = plt.subplots(figsize=(5, 4))
    ax.set_xlim(0, 4)
    ax.set_ylim(0, 3)
    ax.set_aspect("equal")

    def draw(i):
        ax.clear()
        ax.set_xlim(0, 4)
        ax.set_ylim(0, 3)
        x, y, th, balls = frames[i]
        ax.add_patch(patches.Rectangle((0, 0), 4, 3, fill=False, edgecolor="black"))
        ax.plot(x, y, "bo", markersize=8)
        ax.arrow(x, y, 0.15 * math.cos(th), 0.15 * math.sin(th), head_width=0.05, color="b")
        for b in balls:
            if not b.collected:
                ax.plot(b.x, b.y, "o", color="orange", markersize=6)

    anim = FuncAnimation(fig, draw, frames=len(frames), interval=80)
    path.parent.mkdir(parents=True, exist_ok=True)
    anim.save(path, writer=PillowWriter(fps=12))
    plt.close(fig)


def main() -> int:
    if native_skipped():
        return skip_exit_ok()
    parser = argparse.ArgumentParser()
    parser.add_argument("--scenario", default="bright_light")
    parser.add_argument("--runs", type=int, default=10)
    parser.add_argument("--gif", type=Path, default=None)
    args = parser.parse_args()

    names = list(SCENARIOS.keys()) if args.scenario == "all" else [args.scenario]
    print(f"{'Scenario':<22} {'Pass rate':>10}")
    print("-" * 34)
    for name in names:
        if name not in SCENARIOS:
            print(f"Unknown scenario {name}", file=sys.stderr)
            return 1
        ok = 0
        for r in range(args.runs):
            gif = args.gif if args.gif and name == names[0] and r == 0 else None
            if run_episode(name, seed=1000 + r, gif_path=gif):
                ok += 1
        rate = ok / args.runs
        print(f"{name:<22} {rate:>9.0%}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
