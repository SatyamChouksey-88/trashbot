#pragma once
#include "motor_math.h"

struct SafetyInputs {
    int distance_cm;
    bool scoopDown;
    bool estop;
    bool lowBattery;
    bool bumperPressed;
    int obstacleStopCm;
    int scoopSelfEchoCm;
    int maxDutyPct;
    int rampPctPerS;
    uint32_t dt_ms;
};

MotorCmd filterMotor(MotorCmd requested, MotorCmd previous, const SafetyInputs& in);
