#pragma once
#include <stdint.h>

struct ScoopRecipe {
    int creep_cm = 12;
    int creep_speed_pct = 25;
    float align_tolerance = 0.06f;
};

struct BanditState {
    uint16_t tries[16]{};
    uint16_t successes[16]{};
    int round_robin_next = 0;
};

constexpr int RECIPE_COUNT = 16;

ScoopRecipe recipeAt(int index);
int banditSelectRecipe(BanditState& st, uint32_t rng_u32, float explore_rate);
void banditRecordOutcome(BanditState& st, int recipe_index, bool success);
