# Dataset and Edge Impulse

## Collection goals

- ≥ 150 images **with** trash from the robot camera (mounting height).
- ≥ 50 images **without** trash (empty floor, obstacles).
- Include leave-alone items (phone, keys, slippers, charger, earphones) **unlabelled** in photos.
- Vary light, floor type, distance (20–100 cm), angle.

```bash
python tools/collect_photos.py --url http://192.168.4.1 --count 50 --interval 1.5 --crop 240
```

Images are centre-cropped to 240×240 to match on-device inference geometry.

## Edge Impulse (project name: TrashBot)

1. Create a free Developer account and project **`TrashBot`**.
2. Upload images from `dataset/raw/…` (240×240 JPEGs).
3. Label bounding boxes with single class **`trash`**.
4. Impulse: **96×96** image, **Object detection**, **FOMO MobileNetV2 0.35** (try grayscale if too slow).
5. Target **F1 ≥ 0.8** on validation.
6. Export **Arduino library**, quantized int8.
7. Copy library to `firmware/lib/TrashBot_inferencing/` (gitignored).
8. Rebuild: `python -m platformio run -d firmware -e xiao`.

Check Edge Impulse docs for recommended Arduino-ESP32 core (we build with **espressif32 @ 7.0.1**, core 2.0.x).

## Optional TACO subset

```bash
python tools/taco_subset.py --out dataset/taco_subset --max-images 200
```

Compare training with vs without TACO transfer; record F1 in your lab notebook.

## Keyword spotting (future)

On-device KWS conflicts with a second Edge Impulse library; firmware uses **clap-to-start** (sound level). Document KWS as future work when multi-impulse deployment is available.
