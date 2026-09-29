#pragma once
#include "brain.h"

void calibBegin();
BrainCalib calibLoad();
bool calibSaveKey(const char* key, float value);
