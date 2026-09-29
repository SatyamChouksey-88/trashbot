#!/usr/bin/env python3
"""Download a small TACO subset for optional training experiments."""
from __future__ import annotations

import argparse
import json
import random
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image
from tqdm import tqdm

from common import centre_crop_box, transform_bbox_after_crop_resize

TACO_ANN = "https://raw.githubusercontent.com/pedropro/TACO/master/data/annotations.json"
TRASH_CAT_ID = 1
TRASH_CAT_NAME = "trash"


def write_coco(path: Path, images: list, annotations: list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    coco = {
        "images": images,
        "annotations": annotations,
        "categories": [{"id": TRASH_CAT_ID, "name": TRASH_CAT_NAME}],
    }
    path.write_text(json.dumps(coco), encoding="utf-8")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--out", type=Path, default=Path("dataset/taco_subset"))
    p.add_argument("--max-images", type=int, default=200)
    p.add_argument("--test-split", type=float, default=0.2)
    p.add_argument("--size", type=int, default=240)
    p.add_argument(
        "--keywords",
        default="paper,wrapper,film,cap,can,cup,crisp,tissue,straw,carton,packet",
    )
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
        write_coco(args.out / "training" / "_annotations.coco.json", [], [])
        write_coco(args.out / "testing" / "_annotations.coco.json", [], [])
        return

    keys = [k.strip().lower() for k in args.keywords.split(",") if k.strip()]
    cat_ids = {
        c["id"]
        for c in ann.get("categories", [])
        if any(k in c.get("name", "").lower() for k in keys)
    }
    anns_by_image: dict[int, list] = {}
    for a in ann.get("annotations", []):
        if a.get("category_id") not in cat_ids:
            continue
        anns_by_image.setdefault(a["image_id"], []).append(a)

    candidates = [img for img in ann.get("images", []) if img["id"] in anns_by_image]
    random.shuffle(candidates)
    candidates = candidates[: args.max_images]

    train_imgs, test_imgs = [], []
    if candidates:
        split = int(len(candidates) * (1.0 - args.test_split))
        train_candidates = candidates[:split]
        test_candidates = candidates[split:]
    else:
        train_candidates, test_candidates = [], []

    def process_split(split_name: str, image_list: list) -> None:
        images_out: list = []
        anns_out: list = []
        ann_id = 1
        img_dir = args.out / split_name
        img_dir.mkdir(parents=True, exist_ok=True)
        for img in tqdm(image_list, desc=split_name):
            url = img.get("flickr_url") or img.get("url") or img.get("file_name")
            if not url or not str(url).startswith("http"):
                continue
            try:
                r = requests.get(url, timeout=15)
                r.raise_for_status()
            except requests.RequestException:
                continue
            try:
                im = Image.open(BytesIO(r.content)).convert("RGB")
            except OSError:
                continue
            w, h = im.size
            crop = centre_crop_box(w, h, args.size)
            im = im.crop(crop)
            if im.width != args.size:
                im = im.resize((args.size, args.size), Image.Resampling.BILINEAR)
            file_name = f"{img['id']}.jpg"
            im.save(img_dir / file_name, quality=95)
            images_out.append({"id": img["id"], "file_name": file_name, "width": args.size, "height": args.size})
            for a in anns_by_image.get(img["id"], []):
                bbox = a.get("bbox")
                if not bbox or len(bbox) != 4:
                    continue
                tb = transform_bbox_after_crop_resize(tuple(bbox), crop, args.size)
                if tb is None:
                    continue
                x, y, bw, bh = tb
                anns_out.append(
                    {
                        "id": ann_id,
                        "image_id": img["id"],
                        "category_id": TRASH_CAT_ID,
                        "bbox": [x, y, bw, bh],
                        "area": bw * bh,
                        "iscrowd": 0,
                    }
                )
                ann_id += 1
        write_coco(args.out / split_name / "_annotations.coco.json", images_out, anns_out)

    process_split("training", train_candidates)
    process_split("testing", test_candidates)
    print(f"Done. Output under {args.out}")


if __name__ == "__main__":
    main()
