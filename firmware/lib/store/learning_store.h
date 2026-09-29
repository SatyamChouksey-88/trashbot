#pragma once
#include "recipe_bandit.h"

BanditState& learningBandit();
int learningActiveRecipe();
void learningSetActiveRecipe(int idx);
void learningResetBandit();
