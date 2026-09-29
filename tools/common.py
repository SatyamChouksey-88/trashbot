"""Shared helpers for dataset and log tools."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable


def centre_crop_box(w: int, h: int, size: int) -> tuple[int, int, int, int]:
    """Return (left, top, right, bottom) for a centred square crop."""
    left = max(0, (w - size) // 2)
    top = max(0, (h - size) // 2)
    return left, top, left + size, top + size


def transform_bbox_after_crop_resize(
    bbox: tuple[float, float, float, float],
    crop_box: tuple[int, int, int, int],
    out_size: int,
) -> tuple[float, float, float, float] | None:
    """Map COCO bbox (x,y,w,h) through crop then uniform resize to out_size."""
    x, y, bw, bh = bbox
    cl, ct, cr, cb = crop_box
    crop_w = cr - cl
    crop_h = cb - ct
    x2, y2 = x + bw, y + bh
    if x2 <= cl or y2 <= ct or x >= cr or y >= cb:
        return None
    nx = max(x, cl) - cl
    ny = max(y, ct) - ct
    nx2 = min(x2, cr) - cl
    ny2 = min(y2, cb) - ct
    scale = out_size / crop_w
    nx *= scale
    ny *= scale
    nw = (nx2 - (max(x, cl) - cl)) * scale
    nh = (ny2 - (max(y, ct) - ct)) * scale
    if nw < 4 or nh < 4:
        return None
    return nx, ny, nw, nh


def read_jsonl(path: Path) -> Iterable[dict[str, Any]]:
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)
