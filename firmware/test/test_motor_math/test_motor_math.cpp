#include <unity.h>
#include "motor_math.h"

void test_clamp(void) {
    TEST_ASSERT_EQUAL(100, clampPct(150));
    TEST_ASSERT_EQUAL(-100, clampPct(-200));
}

void test_cap(void) {
    auto c = applyCap({100, 100}, 70);
    TEST_ASSERT_EQUAL(70, c.left);
}

void test_ramp(void) {
    TEST_ASSERT_EQUAL(10, rampToward(0, 50, 10));
    TEST_ASSERT_EQUAL(-5, rampToward(0, -50, 5));
}

void test_arcade(void) {
    auto m = mixArcade(50, 20);
    TEST_ASSERT_EQUAL(70, m.left);
    TEST_ASSERT_EQUAL(30, m.right);
}

void test_duty(void) {
    TEST_ASSERT_EQUAL(0, pctToDuty(0, 10, 70));
    TEST_ASSERT_TRUE(pctToDuty(100, 10, 70) > 0);
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_clamp);
    RUN_TEST(test_cap);
    RUN_TEST(test_ramp);
    RUN_TEST(test_arcade);
    RUN_TEST(test_duty);
    return UNITY_END();
}
