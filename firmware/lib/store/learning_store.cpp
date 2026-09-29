#include "learning_store.h"

static BanditState g_bandit{};
static int g_active_recipe = 0;

BanditState& learningBandit() { return g_bandit; }

int learningActiveRecipe() { return g_active_recipe; }

void learningSetActiveRecipe(int idx) { g_active_recipe = idx; }

void learningResetBandit() {
    g_bandit = {};
    g_active_recipe = 0;
}
