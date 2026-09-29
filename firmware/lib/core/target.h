#pragma once
#include "types.h"

struct ScoopZone {
    float x_min, x_max, y_min;
};

bool pickTarget(const Detections& dets, float minScore, uint32_t maxAgeMs, uint32_t now, Detection& out);
bool inScoopZone(const Detection& det, const ScoopZone& zone);
int steer(float x, float kp, float deadband);
int approachSpeed(float y, int driveSpeed, int creepSpeed, float yFast, float ySlow);
