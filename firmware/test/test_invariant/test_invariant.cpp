#include <unity.h>
#include "invariant_monitor.h"

void test_invariant_estop_zero(void) {
    InvariantInputs in{};
    in.estop = true;
    in.filtered = {10, 10};
    TEST_ASSERT_EQUAL((int)InvariantId::EstopNonZero, (int)checkInvariants(in));
}

void test_invariant_idle_zero(void) {
    InvariantInputs in{};
    in.state = State::IDLE;
    in.filtered = {5, 5};
    TEST_ASSERT_EQUAL((int)InvariantId::StateRequiresZero, (int)checkInvariants(in));
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_invariant_estop_zero);
    RUN_TEST(test_invariant_idle_zero);
    return UNITY_END();
}
