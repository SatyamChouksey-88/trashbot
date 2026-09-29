#pragma once
#include "types.h"

struct TimedMove {
    MotorCmd cmd{};
    uint32_t start_ms = 0;
    uint32_t duration_ms = 0;
    bool active = false;
};

TimedMove turnDegrees(int deg, int speed, float degPerS);
TimedMove moveCm(int cm, int speed, float cmPerS);
void timedMoveBegin(TimedMove& tm, uint32_t now);
bool timedMoveStep(TimedMove& tm, uint32_t now);
