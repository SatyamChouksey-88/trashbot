from __future__ import annotations

from dataclasses import dataclass

from room import Ball, RoomSim


@dataclass
class Scenario:
    name: str
    setup: str
    expected: str
    scoop_p: float = 0.85
    light_dim: bool = False
    near_wall: bool = False
    corner: bool = False
    n_balls: int = 3
    decoy: bool = False


SCENARIOS: dict[str, Scenario] = {
    "bright_light": Scenario("bright_light", "Sunlit floor", "Finds trash", scoop_p=0.9),
    "dim_light": Scenario("dim_light", "Evening lamp", "Finds trash", light_dim=True, scoop_p=0.75),
    "near_wall": Scenario("near_wall", "20 cm to wall", "Avoids / stops", near_wall=True),
    "corner": Scenario("corner", "Two walls", "Escapes avoid", corner=True),
    "two_items_close": Scenario("two_items_close", "2 balls 30 cm apart", "Collects both", n_balls=2),
    "look_alike": Scenario("look_alike", "Phone + paper", "Skips phone", decoy=True),
    "cluttered_floor": Scenario("cluttered_floor", "Many objects", "No false scoops", n_balls=6, scoop_p=0.7),
    "dark_vs_light_floor": Scenario("dark_vs_light_floor", "Both surfaces", "Stable detection", n_balls=4),
}


def make_room(sc: Scenario, seed: int) -> RoomSim:
    import numpy as np

    rng = np.random.default_rng(seed)
    sim = RoomSim(scoop_p_success=sc.scoop_p, rng=rng)
    if sc.near_wall:
        sim.robot.x = 0.25
        sim.robot.y = 1.5
        sim.robot.theta = 0.0
    if sc.corner:
        sim.robot.x = 0.25
        sim.robot.y = 0.25
        sim.robot.theta = 0.4
    for i in range(sc.n_balls):
        sim.balls.append(Ball(x=float(rng.uniform(0.6, 3.5)), y=float(rng.uniform(0.4, 2.5))))
    if sc.decoy:
        sim.balls.append(Ball(x=1.0, y=1.0, radius=0.06))
    return sim
