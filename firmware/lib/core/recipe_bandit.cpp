#include "recipe_bandit.h"
#include <algorithm>

static const int kCreepCm[] = {10, 12, 14, 16};
static const int kSpeed[] = {25, 35};
static const float kTol[] = {0.04f, 0.07f};

ScoopRecipe recipeAt(int index) {
    ScoopRecipe r{};
    if (index < 0 || index >= RECIPE_COUNT) return r;
    int cm = index / 4;
    int sp = (index / 2) % 2;
    int tol = index % 2;
    r.creep_cm = kCreepCm[cm % 4];
    r.creep_speed_pct = kSpeed[sp];
    r.align_tolerance = kTol[tol];
    return r;
}

static int bestRecipe(const BanditState& st) {
    int best = 0;
    float bestRate = -1.f;
    for (int i = 0; i < RECIPE_COUNT; i++) {
        if (st.tries[i] == 0) return i;
        float rate = (float)st.successes[i] / (float)st.tries[i];
        if (rate > bestRate) {
            bestRate = rate;
            best = i;
        }
    }
    return best;
}

static bool allTriedOnce(const BanditState& st) {
    for (int i = 0; i < RECIPE_COUNT; i++)
        if (st.tries[i] == 0) return false;
    return true;
}

int banditSelectRecipe(BanditState& st, uint32_t rng_u32, float explore_rate) {
    if (!allTriedOnce(st)) {
        for (int i = 0; i < RECIPE_COUNT; i++) {
            int idx = (st.round_robin_next + i) % RECIPE_COUNT;
            if (st.tries[idx] == 0) {
                st.round_robin_next = (idx + 1) % RECIPE_COUNT;
                return idx;
            }
        }
    }
    uint32_t r = rng_u32 % 1000;
    if (r < (uint32_t)(explore_rate * 1000.f)) {
        return (int)(rng_u32 % RECIPE_COUNT);
    }
    return bestRecipe(st);
}

void banditRecordOutcome(BanditState& st, int recipe_index, bool success) {
    if (recipe_index < 0 || recipe_index >= RECIPE_COUNT) return;
    if (st.tries[recipe_index] < 65535) st.tries[recipe_index]++;
    if (success && st.successes[recipe_index] < 65535) st.successes[recipe_index]++;
}
