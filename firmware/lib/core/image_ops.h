#pragma once
#include <stdint.h>

void centreCropRGB888(const uint8_t* src, int w, int h, int crop, uint8_t* dst);
void resizeBilinearRGB888(const uint8_t* src, int sw, int sh, uint8_t* dst, int dw, int dh);
