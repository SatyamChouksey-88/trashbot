#pragma once
#include "types.h"

int clampPct(int v);
MotorCmd applyCap(MotorCmd cmd, int maxDutyPct);
int rampToward(int current, int target, int maxStep);
MotorCmd mixArcade(int throttle, int turn);
uint32_t pctToDuty(int pct, uint8_t bits, int maxDutyPct);
