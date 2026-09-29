#include "confidence_zone.h"
#include "unity.h"

void test_classify_zones() {
    TEST_ASSERT_EQUAL((int)ConfidenceZone::Ignore, (int)classifyScore(0.4f, 0.5f, 0.75f));
    TEST_ASSERT_EQUAL((int)ConfidenceZone::Uncertain, (int)classifyScore(0.6f, 0.5f, 0.75f));
    TEST_ASSERT_EQUAL((int)ConfidenceZone::Confident, (int)classifyScore(0.8f, 0.5f, 0.75f));
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_classify_zones);
    return UNITY_END();
}
