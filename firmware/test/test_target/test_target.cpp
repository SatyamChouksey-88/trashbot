#include <unity.h>
#include "target.h"

void test_pick_highest(void) {
    Detections d{};
    d.count = 2;
    d.t_ms = 1000;
    d.items[0] = {0.5f, 0.5f, 0.1f, 0.1f, 0.7f};
    d.items[1] = {0.5f, 0.6f, 0.1f, 0.1f, 0.7f};
    Detection out{};
    TEST_ASSERT_TRUE(pickTarget(d, 0.6f, 500, 1100, out));
    TEST_ASSERT_EQUAL_FLOAT(0.6f, out.y);
}

void test_pick_zoned(void) {
    Detections d{};
    d.count = 2;
    d.t_ms = 1000;
    d.items[0] = {0.5f, 0.6f, 0.1f, 0.1f, 0.4f};
    d.items[1] = {0.5f, 0.5f, 0.1f, 0.1f, 0.65f};
    Detection out{};
    ConfidenceZone zone = ConfidenceZone::Ignore;
    TEST_ASSERT_TRUE(pickTargetZoned(d, 0.5f, 0.75f, 500, 1100, out, zone));
    TEST_ASSERT_EQUAL((int)ConfidenceZone::Uncertain, (int)zone);
    TEST_ASSERT_EQUAL_FLOAT(0.65f, out.score);
}

void test_steer_deadband(void) {
    TEST_ASSERT_EQUAL(0, steer(0.51f, 90.0f, 0.06f));
    TEST_ASSERT_TRUE(steer(0.7f, 90.0f, 0.06f) > 0);
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_pick_highest);
    RUN_TEST(test_pick_zoned);
    RUN_TEST(test_steer_deadband);
    return UNITY_END();
}
