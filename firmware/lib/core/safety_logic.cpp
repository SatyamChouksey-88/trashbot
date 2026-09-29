#include "safety_logic.h"

static int effectiveDistance(int distance_cm, bool scoopDown, int selfEchoCm) {
    if (scoopDown && distance_cm <= selfEchoCm + 3) return 999;
    return distance_cm;
}

MotorCmd filterMotor(MotorCmd requested, MotorCmd previous, const SafetyInputs& in) {
    if (in.estop || in.lowBattery) return {0, 0};

    int dist = effectiveDistance(in.distance_cm, in.scoopDown, in.scoopSelfEchoCm);
    if (in.bumperPressed) dist = 0;
    MotorCmd out = requested;
    if (dist < in.obstacleStopCm && (out.left + out.right) > 0) {
        if (out.left > 0) out.left = 0;
        if (out.right > 0) out.right = 0;
    }

    out = applyCap(out, in.maxDutyPct);

    int maxStep = (in.rampPctPerS * (int)in.dt_ms) / 1000;
    if (maxStep < 1) maxStep = 1;
    out.left = rampToward(previous.left, out.left, maxStep);
    out.right = rampToward(previous.right, out.right, maxStep);
    return out;
}
