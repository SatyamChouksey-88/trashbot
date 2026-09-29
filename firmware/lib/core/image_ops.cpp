#include "image_ops.h"

void centreCropRGB888(const uint8_t* src, int w, int h, int crop, uint8_t* dst) {
    int ox = (w - crop) / 2;
    int oy = (h - crop) / 2;
    for (int y = 0; y < crop; y++) {
        for (int x = 0; x < crop; x++) {
            int si = ((oy + y) * w + (ox + x)) * 3;
            int di = (y * crop + x) * 3;
            dst[di] = src[si];
            dst[di + 1] = src[si + 1];
            dst[di + 2] = src[si + 2];
        }
    }
}

static uint8_t sample(const uint8_t* src, int sw, int x, int y, int c) {
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x >= sw) x = sw - 1;
    if (y >= sw) y = sw - 1;
    return src[(y * sw + x) * 3 + c];
}

void resizeBilinearRGB888(const uint8_t* src, int sw, int sh, uint8_t* dst, int dw, int dh) {
    for (int y = 0; y < dh; y++) {
        float fy = (y + 0.5f) * sh / dh - 0.5f;
        int y0 = (int)fy;
        int y1 = y0 + 1;
        float wy = fy - y0;
        for (int x = 0; x < dw; x++) {
            float fx = (x + 0.5f) * sw / dw - 0.5f;
            int x0 = (int)fx;
            int x1 = x0 + 1;
            float wx = fx - x0;
            for (int c = 0; c < 3; c++) {
                float v00 = sample(src, sw, x0, y0, c);
                float v10 = sample(src, sw, x1, y0, c);
                float v01 = sample(src, sw, x0, y1, c);
                float v11 = sample(src, sw, x1, y1, c);
                float v0 = v00 + wx * (v10 - v00);
                float v1 = v01 + wx * (v11 - v01);
                float v = v0 + wy * (v1 - v0);
                if (v < 0) v = 0;
                if (v > 255) v = 255;
                dst[(y * dw + x) * 3 + c] = (uint8_t)v;
            }
        }
    }
}
