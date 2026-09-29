#include "timed_move.h"
#include <cmath>

static uint32_t durationMs(float amount, float rate) {
    if (rate <= 0.0f) return 0;
    float sec = std::fabs(amount) / rate;
    uint32_t ms = (uint32_t)(sec * 1000.0f);
    return ms < 1 ? 1 : ms;
}

TimedMove turnDegrees(int deg, int speed, float degPerS) {
    TimedMove tm;
    if (deg == 0) return tm;
    int s = speed;
    if (s < 0) s = -s;
    float rate = degPerS * (float)s / 45.0f;
    tm.cmd = {deg > 0 ? s : -s, deg > 0 ? -s : s};
    tm.duration_ms = durationMs((float)deg, rate);
    tm.active = true;
    return tm;
}

TimedMove moveCm(int cm, int speed, float cmPerS) {
    TimedMove tm;
    if (cm == 0) return tm;
    int s = speed;
    if (s < 0) s = -s;
    float rate = cmPerS * (float)s / 45.0f;
    int dir = cm > 0 ? s : -s;
    tm.cmd = {dir, dir};
    tm.duration_ms = durationMs((float)cm, rate);
    tm.active = true;
    return tm;
}

void timedMoveBegin(TimedMove& tm, uint32_t now) {
    tm.start_ms = now;
}

bool timedMoveStep(TimedMove& tm, uint32_t now) {
    if (!tm.active) return true;
    if (now - tm.start_ms >= tm.duration_ms) {
        tm.active = false;
        tm.cmd = {0, 0};
        return true;
    }
    return false;
}
