#!/usr/bin/env python3
"""Emit a tiny JPEG as TypeScript for mock-robot placeholder.ts."""
from __future__ import annotations

import base64
from io import BytesIO

from PIL import Image


def main() -> None:
    img = Image.new("RGB", (64, 48), color=(80, 120, 60))
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=85)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    print('export const PLACEHOLDER_JPEG_B64 =')
    print(f'  "{b64}";')


if __name__ == "__main__":
    main()
