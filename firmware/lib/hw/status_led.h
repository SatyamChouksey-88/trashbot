#pragma once
#include "types.h"

void statusLedBegin();
void statusLedSetMode(Mode mode, State state);
void statusLedTick(uint32_t now);
