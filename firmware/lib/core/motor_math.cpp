#include "motor_math.h"

int clampPct(int v) {
    if (v < -100) return -100;
    if (v > 100) return 100;
    return v;
}

MotorCmd applyCap(MotorCmd cmd, int maxDutyPct) {
    int m = maxDutyPct;
    if (m > 100) m = 100;
    auto scale = [&](int v) {
        if (v == 0) return 0;
        int s = (v * m) / 100;
        if (s == 0 && v != 0) s = (v > 0) ? 1 : -1;
        return clampPct(s);
    };
    return {scale(cmd.left), scale(cmd.right)};
}

int rampToward(int current, int target, int maxStep) {
    int d = target - current;
    if (d > maxStep) return current + maxStep;
    if (d < -maxStep) return current - maxStep;
    return target;
}

MotorCmd mixArcade(int throttle, int turn) {
    throttle = clampPct(throttle);
    turn = clampPct(turn);
    int left = clampPct(throttle + turn);
    int right = clampPct(throttle - turn);
    return {left, right};
}

uint32_t pctToDuty(int pct, uint8_t bits, int maxDutyPct) {
    pct = clampPct(pct);
    const uint32_t maxDuty = ((1u << bits) - 1u) * (uint32_t)maxDutyPct / 100u;
    if (pct == 0) return 0;
    uint32_t mag = (uint32_t)(pct < 0 ? -pct : pct) * maxDuty / 100u;
    return mag;
}
