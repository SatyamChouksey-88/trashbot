#!/usr/bin/env python3
"""Fetch JPEG snapshots from TrashBot and save centre-cropped training images."""
from __future__ import annotations

import argparse
import time
from datetime import datetime
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image
from tqdm import tqdm

from common import centre_crop_box


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--url", default="http://192.168.4.1")
    p.add_argument("--count", type=int, default=50)
    p.add_argument("--interval", type=float, default=1.5)
    p.add_argument("--out", type=Path, default=None)
    p.add_argument("--crop", type=int, default=240)
    args = p.parse_args()
    out = args.out or Path("dataset/raw") / datetime.now().strftime("%Y%m%d_%H%M%S")
    out.mkdir(parents=True, exist_ok=True)
    print("Tips: vary distance, lighting, angle; include leave-alone items unlabelled.")
    for i in tqdm(range(args.count), desc="photos"):
        try:
            r = requests.get(f"{args.url.rstrip('/')}/api/photo", timeout=8)
            if r.status_code != 200:
                time.sleep(args.interval)
                continue
            img = Image.open(BytesIO(r.content)).convert("RGB")
            box = centre_crop_box(img.width, img.height, args.crop)
            img = img.crop(box)
            img.save(out / f"{i:04d}.jpg", quality=95)
        except requests.RequestException:
            pass
        time.sleep(args.interval)
    print(f"Saved to {out}")


if __name__ == "__main__":
    main()
