"""4 m × 3 m room simulator (numpy)."""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

from firmware_include import FWD_CM_PER_S, TURN_DEG_PER_S

ROOM_W_M = 4.0
ROOM_H_M = 3.0


@dataclass
class Ball:
    x: float
    y: float
    radius: float = 0.04
    collected: bool = False


@dataclass
class Robot:
    x: float = 2.0
    y: float = 1.5
    theta: float = 0.0
    wheel_base: float = 0.14

    def apply_motor(self, left_pct: float, right_pct: float, dt: float) -> None:
        avg = (left_pct + right_pct) / 2.0
        v = (FWD_CM_PER_S / 100.0) * (avg / 45.0)  # m/s at calibrated drive speed
        w = (TURN_DEG_PER_S * math.pi / 180.0) * ((right_pct - left_pct) / 45.0)
        self.theta += w * dt
        self.x += v * math.cos(self.theta) * dt
        self.y += v * math.sin(self.theta) * dt
        self.x = max(0.08, min(ROOM_W_M - 0.08, self.x))
        self.y = max(0.08, min(ROOM_H_M - 0.08, self.y))


@dataclass
class RoomSim:
    robot: Robot = field(default_factory=Robot)
    balls: list[Ball] = field(default_factory=list)
    scoop_p_success: float = 0.85
    rng: np.random.Generator = field(default_factory=lambda: np.random.default_rng(0))

    def ultrasonic_cm(self) -> int:
        """Forward distance to wall along robot heading."""
        dx = math.cos(self.robot.theta)
        dy = math.sin(self.robot.theta)
        best = 400
        for t in np.linspace(0.05, 4.0, 80):
            px = self.robot.x + dx * t
            py = self.robot.y + dy * t
            if px <= 0 or px >= ROOM_W_M or py <= 0 or py >= ROOM_H_M:
                best = int(t * 100)
                break
        return min(best, 400)

    def camera_detections(self, frame_drop: bool = False) -> list[dict]:
        if frame_drop:
            return []
        out: list[dict] = []
        fov = math.radians(70)
        for b in self.balls:
            if b.collected:
                continue
            ang = math.atan2(b.y - self.robot.y, b.x - self.robot.x) - self.robot.theta
            while ang > math.pi:
                ang -= 2 * math.pi
            while ang < -math.pi:
                ang += 2 * math.pi
            dist = math.hypot(b.x - self.robot.x, b.y - self.robot.y)
            if abs(ang) > fov / 2 or dist > 1.2:
                continue
            x = 0.5 + ang / fov
            y = 0.9 - dist * 0.35
            x += float(self.rng.normal(0, 0.02))
            y += float(self.rng.normal(0, 0.02))
            score = float(np.clip(0.92 + self.rng.normal(0, 0.05), 0.55, 0.99))
            out.append({"x": x, "y": y, "w": 0.08, "h": 0.08, "score": score})
        return out[:8]

    def try_scoop(self) -> bool:
        for b in self.balls:
            if b.collected:
                continue
            if math.hypot(b.x - self.robot.x, b.y - self.robot.y) < 0.18:
                if self.rng.random() < self.scoop_p_success:
                    b.collected = True
                    return True
                return False
        return False

    def remaining_trash(self) -> int:
        return sum(1 for b in self.balls if not b.collected)
