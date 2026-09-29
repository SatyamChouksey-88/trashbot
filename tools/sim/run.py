#!/usr/bin/env python3
"""Digital twin: python tools/sim/run.py --suite all --runs 20"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(ROOT / "tools"))
from native_env import native_skipped, skip_exit_ok

from episode import run_episode
from load_scenarios import list_scenarios, load_scenario


def _fault_active(typ: str) -> bool:
    from faults import FaultEngine

    eng = FaultEngine(faults=[{"at_s": 4.0, "type": typ, "duration_s": 2.0, "lag_ms": 800}])
    eff = eng.effect_at(5000)
    if typ == "camera_timeout":
        return eff.camera_ok is False
    if typ == "ultrasonic_invalid":
        return eff.ultrasonic_invalid
    if typ == "motor_no_response":
        return eff.motor_no_response
    if typ == "scoop_failure":
        return eff.force_scoop_fail
    if typ == "target_disappears":
        return eff.hide_detections
    if typ == "sensor_lag":
        return eff.detection_lag_ms > 0
    if typ == "low_battery":
        return eff.low_battery
    if typ == "bumper_hit":
        return eff.bumper
    if typ == "overtemp":
        return eff.overtemp
    return False


def fault_matrix_rows() -> list[str]:
    types = [
        "camera_timeout",
        "ultrasonic_invalid",
        "motor_no_response",
        "scoop_failure",
        "target_disappears",
        "sensor_lag",
        "low_battery",
        "bumper_hit",
        "overtemp",
    ]
    rows = ["", "## Fault matrix (smoke)", "", "| Fault | Active at t=5s |", "|-------|----------------|"]
    for typ in types:
        rows.append(f"| `{typ}` | {'yes' if _fault_active(typ) else '—'} |")
    return rows


def write_report(results: dict[str, tuple[int, int]], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Simulation report",
        "",
        f"Generated: {datetime.now(timezone.utc).isoformat()}",
        "",
        "| Scenario | Pass | Runs | Rate |",
        "|----------|------|------|------|",
    ]
    for name, (ok, total) in sorted(results.items()):
        rate = ok / total if total else 0
        lines.append(f"| {name} | {ok} | {total} | {rate:.0%} |")
    lines.extend(fault_matrix_rows())
    lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    if native_skipped():
        return skip_exit_ok()
    parser = argparse.ArgumentParser()
    parser.add_argument("--scenario", default=None, help="Single scenario name")
    parser.add_argument("--suite", default=None, help="Use 'all' for every JSON scenario")
    parser.add_argument("--runs", type=int, default=10)
    parser.add_argument("--gif", type=Path, default=None, help="GIF path (default: docs/media/basic_clean.gif on suite all)")
    parser.add_argument("--report", type=Path, default=ROOT / "docs" / "reports" / "sim_latest.md")
    args = parser.parse_args()

    if args.suite == "all":
        names = list_scenarios()
    elif args.scenario:
        names = ["bright_light"] if args.scenario == "bright_light" else [args.scenario]
        if args.scenario == "all":
            names = list_scenarios()
    else:
        names = ["basic_clean"]

    # legacy alias
    names = ["basic_clean" if n == "bright_light" else n for n in names]

    gif_default = ROOT / "docs" / "media" / "basic_clean.gif"
    if args.suite == "all" and args.gif is None:
        args.gif = gif_default

    print(f"{'Scenario':<28} {'Pass rate':>10}")
    print("-" * 40)
    table: dict[str, tuple[int, int]] = {}
    for name in names:
        try:
            spec = load_scenario(name)
        except KeyError:
            print(f"Unknown scenario {name}", file=sys.stderr)
            return 1
        ok = 0
        for r in range(args.runs):
            gif = args.gif if args.gif and name == "basic_clean" and r == 0 else None
            res = run_episode(spec, seed=1000 + r, gif_path=gif)
            if res.success:
                ok += 1
        table[name] = (ok, args.runs)
        print(f"{name:<28} {ok / args.runs:>9.0%}")

    if args.report:
        write_report(table, args.report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
