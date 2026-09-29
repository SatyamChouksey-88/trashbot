#include <unity.h>
#include "profile_core.h"

void test_profile_clamp_duty(void) {
    ProfileTunables t{};
    t.max_duty = 200;
    t = profileClamp(t, 12, 80);
    TEST_ASSERT_EQUAL(80, t.max_duty);
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_profile_clamp_duty);
    return UNITY_END();
}
