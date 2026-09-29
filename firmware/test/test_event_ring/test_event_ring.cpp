#include <unity.h>
#include "event_ring.h"

void test_ring(void) {
    EventRing r(4);
    r.push(EventType::boot, 1);
    r.push(EventType::wifi_ready, 2);
    Event e[8];
    int n = r.since(0, e, 8);
    TEST_ASSERT_EQUAL(2, n);
    TEST_ASSERT_TRUE(e[1].seq > e[0].seq);
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_ring);
    return UNITY_END();
}
