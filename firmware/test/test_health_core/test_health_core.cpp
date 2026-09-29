#include <unity.h>
#include "health_core.h"

void test_health_critical_estop(void) {
    HealthInputs in{};
    in.psram_ok = true;
    in.heap_free = 100000;
    in.estop = true;
    TEST_ASSERT_TRUE(healthBlocksAuto(in));
}

void test_health_ok_baseline(void) {
    HealthInputs in{};
    in.psram_ok = true;
    in.heap_free = 100000;
    in.motor_lease_ok = true;
    in.vision_hb_ok = true;
    in.control_hb_ok = true;
    TEST_ASSERT_FALSE(healthBlocksAuto(in));
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_health_critical_estop);
    RUN_TEST(test_health_ok_baseline);
    return UNITY_END();
}
