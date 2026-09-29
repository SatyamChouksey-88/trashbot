#!/usr/bin/env python3
"""Summarise TrashBot event logs per cleaning session."""
from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

from common import read_jsonl


def load_events(path: Path) -> list[dict]:
    if path.suffix == ".jsonl":
        return list(read_jsonl(path))
    data = json.loads(path.read_text(encoding="utf-8"))
    return data.get("events", data)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("log_file", type=Path)
    args = p.parse_args()
    events = load_events(args.log_file)
    sessions: dict[str, dict] = defaultdict(lambda: {"collected": 0, "failed": 0, "skipped": 0, "obstacles": 0})
    label = "default"
    for e in events:
        t = e.get("type", e.get("type_name", ""))
        if t in ("session_start", 5):
            label = str(e.get("label", e.get("a", "default")))
        if t in ("item_collected", 10):
            sessions[label]["collected"] += 1
        if t in ("item_failed", 11):
            sessions[label]["failed"] += 1
        if t in ("item_skipped", 12):
            sessions[label]["skipped"] += 1
        if t in ("obstacle", 8):
            sessions[label]["obstacles"] += 1
    print("| label | collected | failed | skipped | obstacles |")
    print("|-------|-----------|--------|---------|-----------|")
    for lab, s in sessions.items():
        print(f"| {lab} | {s['collected']} | {s['failed']} | {s['skipped']} | {s['obstacles']} |")


if __name__ == "__main__":
    main()
