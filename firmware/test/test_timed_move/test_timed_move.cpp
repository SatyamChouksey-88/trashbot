#include <unity.h>
#include "timed_move.h"

void test_turn_duration(void) {
    auto tm = turnDegrees(90, 45, 120.0f);
    TEST_ASSERT_TRUE(tm.active);
    TEST_ASSERT_TRUE(tm.duration_ms > 0);
    timedMoveBegin(tm, 0);
    TEST_ASSERT_FALSE(timedMoveStep(tm, 0));
    TEST_ASSERT_TRUE(timedMoveStep(tm, tm.duration_ms + 1));
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_turn_duration);
    return UNITY_END();
}
