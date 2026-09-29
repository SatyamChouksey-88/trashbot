#!/usr/bin/env python3
"""Evaluate a simple detection metrics file (CI / dataset tooling stub)."""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def evaluate(metrics_path: Path) -> dict:
    data = json.loads(metrics_path.read_text(encoding="utf-8"))
    tp = int(data.get("true_positives", 0))
    fp = int(data.get("false_positives", 0))
    fn = int(data.get("false_negatives", 0))
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "tp": tp,
        "fp": fp,
        "fn": fn,
    }


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("metrics", type=Path, help="JSON with tp/fp/fn counts")
    p.add_argument("--json", action="store_true")
    args = p.parse_args()
    result = evaluate(args.metrics)
    if args.json:
        print(json.dumps(result))
    else:
        print(f"precision={result['precision']} recall={result['recall']} f1={result['f1']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
