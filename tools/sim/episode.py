from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from brain_pipe import SimBrain
from faults import FaultEngine
from firmware_include import OBSTACLE_STOP_CM, MOTOR_MAX_DUTY
from load_scenarios import build_room_from_spec
from room import RoomSim

DT_MS = 50
MAX_STEPS = 8000


@dataclass
class EpisodeResult:
    success: bool
    final_state: str
    collected: int
    event_types: list[int] = field(default_factory=list)
    violations: list[str] = field(default_factory=list)
    termination_reason: str = ""


def run_episode(spec: dict, seed: int, gif_path: Path | None = None) -> EpisodeResult:
    room: RoomSim = build_room_from_spec(spec, seed)
    brain = SimBrain()
    faults = FaultEngine(faults=spec.get("faults", []))
    expected = spec.get("expected", {})
    room_cfg = spec.get("room", {})

    t_ms = 0
    event_types: list[int] = []
    violations: list[str] = []
    last_gray: Any = None
    frames = []
    lag_queue: list[tuple[int, list]] = []

    payload: dict = {
        "now_ms": 0,
        "distance_cm": room.ultrasonic_cm(),
        "camera_ok": True,
        "detections_age_ms": 0,
        "detections": [],
        "start": True,
        "start_max_items": int(room_cfg.get("n_trash", 3)),
        "start_max_time_s": int(spec.get("max_time_s", 120)),
    }
    final_state = "IDLE"
    collected = 0

    for step in range(MAX_STEPS):
        eff = faults.effect_at(t_ms)
        if eff.low_battery:
            room.battery_v = 6.4
        if eff.bumper:
            room.bumper_pressed = True
        else:
            room.bumper_pressed = False

        dist = room.ultrasonic_cm()
        if eff.ultrasonic_invalid:
            dist = 400
        elif room.bumper_pressed:
            dist = 0

        dets_now = room.camera_detections(
            frame_drop=eff.frame_drop,
            hide_trash=eff.hide_detections,
            include_keep=spec.get("name") in ("keep_item_next_to_trash", "unknown_object_nearby"),
        )
        lag_ms = eff.detection_lag_ms
        if lag_ms > 0:
            lag_queue.append((t_ms + lag_ms, dets_now))
        dets = dets_now
        if lag_queue:
            ready = [d for release, d in lag_queue if release <= t_ms]
            if ready:
                dets = ready[-1]
            lag_queue[:] = [(r, d) for r, d in lag_queue if r > t_ms]

        payload["now_ms"] = t_ms
        payload["distance_cm"] = dist
        payload["camera_ok"] = eff.camera_ok if eff.camera_ok is not None else True
        payload["detections"] = dets
        payload["detections_age_ms"] = 0 if dets else 80
        if step > 0:
            payload.pop("start", None)

        out = brain.step(payload)
        payload = {"now_ms": t_ms}
        left = int(out["motor"]["left"])
        right = int(out["motor"]["right"])
        final_state = str(out["state"])
        collected = int(out["session"].get("collected", 0))

        for ev in out.get("events", []):
            event_types.append(int(ev.get("type", -1)))

        if dist < OBSTACLE_STOP_CM and (left > 0 or right > 0):
            violations.append("uncontrolled_forward_near_obstacle")

        if expected.get("motor_within_cap"):
            cap = MOTOR_MAX_DUTY
            if abs(left) > cap or abs(right) > cap:
                violations.append("motor_over_cap")

        if not eff.motor_no_response:
            room.robot.apply_motor(left, right, DT_MS / 1000.0)
        room.update_motion_score(left, right, last_gray)
        last_gray = room.sample_gray()

        if final_state == "SCOOP":
            fail = eff.force_scoop_fail
            room.try_scoop(force_fail=fail)

        if gif_path is not None and step % 8 == 0:
            frames.append((room.robot.x, room.robot.y, room.robot.theta, list(room.balls)))

        allowed = expected.get("allowed_final_states")
        if final_state in ("DONE", "ESTOP") or collected >= int(room_cfg.get("n_trash", 3)):
            break
        if allowed and final_state in allowed and step > 200:
            break

        t_ms += DT_MS

    brain.close()

    if gif_path and frames:
        from viz import save_gif

        save_gif(frames, gif_path)

    req_events = expected.get("events", [])
    for ev_name in req_events:
        pass  # named events mapped in phase E

    ok = True
    if expected.get("no_uncontrolled_motion") and "uncontrolled_forward_near_obstacle" in violations:
        ok = False
    if "max_violations" in expected and len(violations) > int(expected["max_violations"]):
        ok = False
    min_col = expected.get("min_collected")
    if min_col is not None and collected < int(min_col):
        ok = False
    allowed_final = expected.get("final_state")
    if allowed_final and final_state != allowed_final:
        ok = False
    allowed_list = expected.get("allowed_final_states")
    if allowed_list and final_state not in allowed_list and collected < int(room_cfg.get("n_trash", 1)):
        ok = False

    return EpisodeResult(
        success=ok,
        final_state=final_state,
        collected=collected,
        event_types=event_types,
        violations=violations,
        termination_reason=spec.get("expected", {}).get("termination_reason", ""),
    )
