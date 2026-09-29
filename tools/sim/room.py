"""4 m × 3 m room simulator (numpy)."""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

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
    is_trash: bool = True


@dataclass
class KeepItem:
    x: float
    y: float
    label: str = "keep"


@dataclass
class Robot:
    x: float = 2.0
    y: float = 1.5
    theta: float = 0.0
    wheel_base: float = 0.14
    last_x: float = 2.0
    last_y: float = 1.5

    def apply_motor(self, left_pct: float, right_pct: float, dt: float) -> None:
        self.last_x, self.last_y = self.x, self.y
        avg = (left_pct + right_pct) / 2.0
        v = (FWD_CM_PER_S / 100.0) * (avg / 45.0)
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
    keep_items: list[KeepItem] = field(default_factory=list)
    scoop_p_success: float = 0.85
    rng: np.random.Generator = field(default_factory=lambda: np.random.default_rng(0))
    battery_v: float = 8.0
    bumper_pressed: bool = False
    motion_score: float = 0.0
    detection_lag_buffer: tuple[list[dict], int] | None = None
    fps: float = 7.0
    _frame_counter: int = 0

    def ultrasonic_cm(self) -> int:
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

    def _visible_objects(self, include_keep: bool) -> list[tuple[float, float, float, bool]]:
        objs: list[tuple[float, float, float, bool]] = []
        for b in self.balls:
            if not b.collected and b.is_trash:
                objs.append((b.x, b.y, 0.9, True))
        if include_keep:
            for k in self.keep_items:
                objs.append((k.x, k.y, 0.55, False))
        return objs

    def camera_detections(
        self,
        frame_drop: bool = False,
        hide_trash: bool = False,
        include_keep: bool = False,
    ) -> list[dict]:
        self._frame_counter += 1
        if int(self._frame_counter % max(1, int(30 / self.fps))) != 0:
            return []
        if frame_drop:
            return []
        if hide_trash:
            return []
        out: list[dict] = []
        fov = math.radians(70)
        for x, y, base_score, is_trash in self._visible_objects(include_keep):
            ang = math.atan2(y - self.robot.y, x - self.robot.x) - self.robot.theta
            while ang > math.pi:
                ang -= 2 * math.pi
            while ang < -math.pi:
                ang += 2 * math.pi
            dist = math.hypot(x - self.robot.x, y - self.robot.y)
            if abs(ang) > fov / 2 or dist > 1.2:
                continue
            nx = 0.5 + ang / fov
            ny = 0.9 - dist * 0.35
            nx += float(self.rng.normal(0, 0.02))
            ny += float(self.rng.normal(0, 0.02))
            score = float(np.clip(base_score + self.rng.normal(0, 0.05), 0.45, 0.99))
            if not is_trash:
                score = min(score, 0.65)
            out.append({"x": nx, "y": ny, "w": 0.08, "h": 0.08, "score": score})
        return out[:8]

    def try_scoop(self, force_fail: bool = False) -> bool:
        for b in self.balls:
            if b.collected or not b.is_trash:
                continue
            if math.hypot(b.x - self.robot.x, b.y - self.robot.y) < 0.18:
                if force_fail:
                    return False
                if self.rng.random() < self.scoop_p_success:
                    b.collected = True
                    return True
                return False
        return False

    def remaining_trash(self) -> int:
        return sum(1 for b in self.balls if not b.collected and b.is_trash)

    def update_motion_score(self, left: int, right: int, gray: Any) -> None:
        moved = math.hypot(self.robot.x - self.robot.last_x, self.robot.y - self.robot.last_y)
        if abs(left) + abs(right) < 5:
            self.motion_score = max(0.0, self.motion_score * 0.9)
        else:
            self.motion_score = min(255.0, moved * 800.0 + self.motion_score * 0.5)

    def sample_gray(self) -> float:
        return float(self.rng.random())
