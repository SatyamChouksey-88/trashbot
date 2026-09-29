#include <unity.h>
#include "config.h"
#include "stuck_detect.h"

void test_stuck_latches_low_motion(void) {
    StuckState st{};
    uint32_t t = 0;
    for (int i = 0; i < 200; i++) {
        t += 20;
        stuckDetectUpdate(st, t, 40, 40, 1.0f, 100, true);
    }
    TEST_ASSERT_TRUE(stuckDetectTriggered(st, t));
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_stuck_latches_low_motion);
    return UNITY_END();
}
