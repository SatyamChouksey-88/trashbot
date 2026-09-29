#include <unity.h>
#include "alias_rules.h"
#include <cstring>

static AliasEntry good_clean() {
    AliasEntry e{};
    strncpy(e.phrase, "chotu kaam", sizeof(e.phrase) - 1);
    e.step_count = 1;
    strncpy(e.steps[0].intent, "CLEAN", sizeof(e.steps[0].intent) - 1);
    e.steps[0].params.max_items = 5;
    e.steps[0].params.max_time_s = 120;
    return e;
}

void test_clean_ok(void) {
    TEST_ASSERT_EQUAL((int)AliasReason::Ok, (int)validateAliasEntry(good_clean()));
}

void test_phrase_empty(void) {
    AliasEntry e = good_clean();
    e.phrase[0] = 0;
    TEST_ASSERT_EQUAL((int)AliasReason::PhraseEmpty, (int)validateAliasEntry(e));
}

void test_move_back_limit(void) {
    AliasEntry e = good_clean();
    strncpy(e.steps[0].intent, "MOVE", sizeof(e.steps[0].intent) - 1);
    strncpy(e.steps[0].params.direction, "back", sizeof(e.steps[0].params.direction) - 1);
    e.steps[0].params.distance_cm = 25;
    e.steps[0].params.speed = 40;
    TEST_ASSERT_EQUAL((int)AliasReason::BadParam, (int)validateAliasEntry(e));
}

void test_turn_ok(void) {
    AliasEntry e = good_clean();
    strncpy(e.steps[0].intent, "TURN", sizeof(e.steps[0].intent) - 1);
    strncpy(e.steps[0].params.direction, "left", sizeof(e.steps[0].params.direction) - 1);
    e.steps[0].params.degrees = 90;
    e.steps[0].params.speed = 40;
    TEST_ASSERT_EQUAL((int)AliasReason::Ok, (int)validateAliasEntry(e));
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_clean_ok);
    RUN_TEST(test_phrase_empty);
    RUN_TEST(test_move_back_limit);
    RUN_TEST(test_turn_ok);
    return UNITY_END();
}
