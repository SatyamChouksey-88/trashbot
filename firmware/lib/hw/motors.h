#pragma once
#include "types.h"

void motorsBegin();
void motorsRenewLease();
void motorsApply(MotorCmd cmd, int maxDutyPct);
bool motorsLeaseOk();
