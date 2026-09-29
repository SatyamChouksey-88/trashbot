from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class FaultEffect:
    camera_ok: bool | None = None
    ultrasonic_invalid: bool = False
    motor_no_response: bool = False
    force_scoop_fail: bool = False
    hide_detections: bool = False
    detection_lag_ms: int = 0
    frame_drop: bool = False
    bumper: bool = False
    low_battery: bool = False
    overtemp: bool = False


@dataclass
class FaultEngine:
    faults: list[dict] = field(default_factory=list)

    def effect_at(self, t_ms: int) -> FaultEffect:
        t_s = t_ms / 1000.0
        eff = FaultEffect()
        for f in self.faults:
            at = float(f.get("at_s", 0))
            dur = float(f.get("duration_s", 0.5))
            if not (at <= t_s < at + dur):
                continue
            typ = f.get("type", "")
            if typ in ("camera_failure", "camera_timeout", "detector_timeout"):
                eff.camera_ok = False
                eff.frame_drop = True
            elif typ == "ultrasonic_invalid":
                eff.ultrasonic_invalid = True
            elif typ == "motor_no_response":
                eff.motor_no_response = True
            elif typ == "scoop_failure":
                eff.force_scoop_fail = True
            elif typ == "target_disappears":
                eff.hide_detections = True
            elif typ in ("stale_detection", "duplicate_detection"):
                eff.detection_lag_ms = max(eff.detection_lag_ms, 500)
            elif typ == "sensor_lag":
                eff.detection_lag_ms = max(eff.detection_lag_ms, int(f.get("lag_ms", 800)))
            elif typ == "low_battery":
                eff.low_battery = True
            elif typ == "bumper_hit":
                eff.bumper = True
            elif typ == "overtemp":
                eff.overtemp = True
                eff.camera_ok = False
        return eff
