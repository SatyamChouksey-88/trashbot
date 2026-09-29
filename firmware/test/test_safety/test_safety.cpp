#include <unity.h>
#include "safety_logic.h"

void test_estop(void) {
    SafetyInputs in{};
    in.estop = true;
    auto o = filterMotor({50, 50}, {0, 0}, in);
    TEST_ASSERT_EQUAL(0, o.left);
}

void test_forward_block(void) {
    SafetyInputs in{};
    in.distance_cm = 14;
    in.obstacleStopCm = 15;
    in.maxDutyPct = 100;
    in.rampPctPerS = 1000;
    in.dt_ms = 20;
    auto o = filterMotor({50, 50}, {0, 0}, in);
    TEST_ASSERT_EQUAL(0, o.left);
    in.distance_cm = 16;
    o = filterMotor({50, 50}, {0, 0}, in);
    TEST_ASSERT_TRUE(o.left > 0);
}

void test_scoop_echo(void) {
    SafetyInputs in{};
    in.distance_cm = 10;
    in.scoopDown = true;
    in.scoopSelfEchoCm = 12;
    in.obstacleStopCm = 15;
    in.maxDutyPct = 100;
    in.rampPctPerS = 1000;
    in.dt_ms = 20;
    auto o = filterMotor({50, 50}, {0, 0}, in);
    TEST_ASSERT_TRUE(o.left > 0);
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_estop);
    RUN_TEST(test_forward_block);
    RUN_TEST(test_scoop_echo);
    return UNITY_END();
}
