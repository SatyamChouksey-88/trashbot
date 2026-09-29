#pragma once
#include "brain.h"
#include <ArduinoJson.h>

void calibBegin();
BrainCalib calibLoad();
bool calibSaveFloat(const char* key, float value);
bool calibSaveInt(const char* key, int value);
void calibToJson(JsonObject obj);
