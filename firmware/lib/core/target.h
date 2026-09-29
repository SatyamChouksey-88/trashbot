#pragma once
#include "confidence_zone.h"
#include "types.h"

struct ScoopZone {
    float x_min, x_max, y_min;
};

bool pickTarget(const Detections& dets, float minScore, uint32_t maxAgeMs, uint32_t now, Detection& out);
bool pickTargetZoned(const Detections& dets, float ignore_below, float confident_at, uint32_t maxAgeMs, uint32_t now,
                     Detection& out, ConfidenceZone& zone);
bool inScoopZone(const Detection& det, const ScoopZone& zone);
int steer(float x, float kp, float deadband);
int approachSpeed(float y, int driveSpeed, int creepSpeed, float yFast, float ySlow);
