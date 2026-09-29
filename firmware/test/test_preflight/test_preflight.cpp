#include <unity.h>
#include "preflight_core.h"

void test_preflight_blocks_without_bringup(void) {
    PreflightInputs in{};
    in.bringup_done = false;
    in.calib_present = true;
    auto r = evaluatePreflight(in);
    TEST_ASSERT_FALSE(r.ok);
}

void test_preflight_ok_when_ready(void) {
    PreflightInputs in{};
    in.bringup_done = true;
    in.calib_present = true;
    auto r = evaluatePreflight(in);
    TEST_ASSERT_TRUE(r.ok);
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_preflight_blocks_without_bringup);
    RUN_TEST(test_preflight_ok_when_ready);
    return UNITY_END();
}
