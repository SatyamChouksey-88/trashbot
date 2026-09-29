#include <unity.h>
#include "mission_core.h"

void test_mission_id_format(void) {
    char buf[32];
    formatMissionId(3, 7, buf, sizeof(buf));
    TEST_ASSERT_EQUAL_STRING("TB-3-7", buf);
}

void test_termination_parse(void) {
    TEST_ASSERT_EQUAL((int)TerminationReason::ItemLimit, (int)terminationFromStrings("item_limit"));
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_mission_id_format);
    RUN_TEST(test_termination_parse);
    return UNITY_END();
}
