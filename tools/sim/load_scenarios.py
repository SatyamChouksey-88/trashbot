from __future__ import annotations

import json
from pathlib import Path

SCENARIO_DIR = Path(__file__).resolve().parent / "scenarios"


def load_scenario(name: str) -> dict:
    path = SCENARIO_DIR / f"{name}.json"
    if not path.is_file():
        raise KeyError(f"Unknown scenario {name} (no {path})")
    return json.loads(path.read_text(encoding="utf-8"))


def list_scenarios() -> list[str]:
    return sorted(p.stem for p in SCENARIO_DIR.glob("*.json"))


def build_room_from_spec(spec: dict, seed: int):
    import numpy as np
    from room import Ball, KeepItem, RoomSim, Robot

    room_cfg = spec.get("room", {})
    rng = np.random.default_rng(seed)
    robot_cfg = spec.get("robot", {})
    sim = RoomSim(
        robot=Robot(
            x=float(robot_cfg.get("x", 2.0)),
            y=float(robot_cfg.get("y", 1.5)),
            theta=float(robot_cfg.get("theta", 0.0)),
        ),
        scoop_p_success=float(room_cfg.get("scoop_p", 0.85)),
        rng=rng,
        battery_v=float(room_cfg.get("battery_v", 8.0)),
    )
    n_trash = int(room_cfg.get("n_trash", 3))
    for _ in range(n_trash):
        sim.balls.append(
            Ball(x=float(rng.uniform(0.6, 3.5)), y=float(rng.uniform(0.4, 2.5)), is_trash=True)
        )
    for k in room_cfg.get("keep_items", []):
        sim.keep_items.append(
            KeepItem(x=float(k.get("x", 1.0)), y=float(k.get("y", 1.0)), label=str(k.get("label", "keep")))
        )
    return sim
