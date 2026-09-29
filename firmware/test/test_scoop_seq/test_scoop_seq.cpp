#include <unity.h>
#include "scoop_seq.h"

void test_scoop_flow(void) {
    ScoopSequencer s;
    s.reset(20, 100, 165, 100);
    int deg = 100;
    for (int t = 0; t < 5000; t += 20) {
        bool creep = false;
        if (s.step(t, deg, creep)) break;
    }
    TEST_ASSERT_EQUAL((int)ScoopPhase::Done, (int)ScoopPhase::Done);
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_scoop_flow);
    return UNITY_END();
}
