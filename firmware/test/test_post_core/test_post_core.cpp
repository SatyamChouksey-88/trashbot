#include <unity.h>
#include "post_core.h"

void test_post_needs_psram(void) {
    PostInputs in{};
    in.psram_ok = false;
    in.nvs_ok = true;
    in.camera_ok = true;
    in.detector_ok = true;
    in.ultrasonic_valid_samples = 3;
    in.wifi_ok = true;
    TEST_ASSERT_FALSE(evaluatePost(in).ok);
}

void test_post_ultrasonic_no_echo_path(void) {
    PostInputs in{};
    in.psram_ok = true;
    in.nvs_ok = true;
    in.camera_ok = true;
    in.detector_ok = true;
    in.ultrasonic_no_echo_declared = true;
    in.wifi_ok = true;
    TEST_ASSERT_TRUE(evaluatePost(in).ultrasonic_ok);
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_post_needs_psram);
    RUN_TEST(test_post_ultrasonic_no_echo_path);
    return UNITY_END();
}
