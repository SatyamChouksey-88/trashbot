#include "recipe_bandit.h"
#include "unity.h"

void test_round_robin_then_greedy() {
    BanditState st{};
    int first = banditSelectRecipe(st, 42, 0.0f);
    TEST_ASSERT_EQUAL(0, first);
    banditRecordOutcome(st, first, true);
    int second = banditSelectRecipe(st, 99, 0.0f);
    TEST_ASSERT_EQUAL(1, second);
}

void test_recipe_table() {
    ScoopRecipe r = recipeAt(0);
    TEST_ASSERT_TRUE(r.creep_cm >= 10);
    TEST_ASSERT_TRUE(r.creep_speed_pct > 0);
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_round_robin_then_greedy);
    RUN_TEST(test_recipe_table);
    return UNITY_END();
}
