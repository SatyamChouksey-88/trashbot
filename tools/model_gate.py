#!/usr/bin/env python3
"""Gate a candidate vision model against baseline metrics (v3 G9)."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from eval_model import evaluate


def gate(candidate: dict, baseline: dict, min_f1_delta: float = -0.02) -> tuple[bool, str]:
    if candidate["fp"] > baseline["fp"]:
        return False, f"false_positives {candidate['fp']} > baseline {baseline['fp']}"
    if candidate["f1"] < baseline["f1"] + min_f1_delta:
        return False, f"f1 {candidate['f1']} below baseline {baseline['f1']} + {min_f1_delta}"
    return True, "pass"


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("candidate", type=Path)
    p.add_argument("baseline", type=Path)
    p.add_argument("--min-f1-delta", type=float, default=-0.02)
    args = p.parse_args()
    cand = evaluate(args.candidate)
    base = evaluate(args.baseline)
    ok, reason = gate(cand, base, args.min_f1_delta)
    print(json.dumps({"ok": ok, "reason": reason, "candidate": cand, "baseline": base}))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
