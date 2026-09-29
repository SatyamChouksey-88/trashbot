#include <unity.h>
#include "image_ops.h"

void test_crop_resize(void) {
    uint8_t src[320 * 240 * 3];
    for (int i = 0; i < 320 * 240 * 3; i++) src[i] = (uint8_t)(i % 256);
    uint8_t crop[240 * 240 * 3];
    uint8_t out[96 * 96 * 3];
    centreCropRGB888(src, 320, 240, 240, crop);
    resizeBilinearRGB888(crop, 240, 240, out, 96, 96);
    TEST_ASSERT_EQUAL(96 * 96 * 3, sizeof(out));
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_crop_resize);
    return UNITY_END();
}
