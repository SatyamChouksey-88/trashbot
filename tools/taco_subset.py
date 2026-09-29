#!/usr/bin/env python3
"""Download a small TACO subset for optional training experiments."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import requests
from tqdm import tqdm

from common import centre_crop_box, transform_bbox_after_crop_resize

TACO_ANN = "https://raw.githubusercontent.com/pedropro/TACO/master/data/annotations.json"


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--out", type=Path, default=Path("dataset/taco_subset"))
    p.add_argument("--max-images", type=int, default=200)
    p.add_argument("--test-split", type=float, default=0.2)
    p.add_argument("--size", type=int, default=240)
    p.add_argument("--keywords", default="paper,wrapper,film,cap,can,cup,crisp,tissue,straw,carton,packet")
    args = p.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "LICENSE_NOTE.md").write_text(
        "TACO dataset licence: see https://github.com/pedropro/TACO README.\n",
        encoding="utf-8",
    )
    try:
        ann = requests.get(TACO_ANN, timeout=15).json()
    except requests.RequestException:
        print("Could not download TACO annotations; exiting cleanly.")
        return
    keys = [k.strip().lower() for k in args.keywords.split(",") if k.strip()]
    cat_ids = {
        c["id"]
        for c in ann.get("categories", [])
        if any(k in c.get("name", "").lower() for k in keys)
    }
    images = ann.get("images", [])[: args.max_images]
    print(f"Selected {len(images)} candidate images (may skip download failures).")
    for img in tqdm(images):
        url = img.get("flickr_url") or img.get("url")
        if not url:
            continue
        try:
            requests.get(url, timeout=15)
        except requests.RequestException:
            continue
    print(f"Output directory prepared at {args.out} (partial pipeline stub).")


if __name__ == "__main__":
    main()
