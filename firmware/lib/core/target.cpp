#include "target.h"
#include <cmath>

bool pickTarget(const Detections& dets, float minScore, uint32_t maxAgeMs, uint32_t now, Detection& out) {
    if (dets.count <= 0) return false;
    if (now - dets.t_ms > maxAgeMs) return false;
    bool found = false;
    Detection best{};
    for (int i = 0; i < dets.count; i++) {
        const auto& d = dets.items[i];
        if (d.score < minScore) continue;
        if (!found || d.score > best.score || (d.score == best.score && d.y > best.y)) {
            best = d;
            found = true;
        }
    }
    if (!found) return false;
    out = best;
    return true;
}

bool inScoopZone(const Detection& det, const ScoopZone& zone) {
    return det.x >= zone.x_min && det.x <= zone.x_max && det.y >= zone.y_min;
}

int steer(float x, float kp, float deadband) {
    float err = x - 0.5f;
    if (std::fabs(err) <= deadband) return 0;
    int turn = (int)(err * kp);
    if (turn > 100) turn = 100;
    if (turn < -100) turn = -100;
    return turn;
}

int approachSpeed(float y, int driveSpeed, int creepSpeed, float yFast, float ySlow) {
    if (y <= yFast) return driveSpeed;
    if (y >= ySlow) return creepSpeed;
    float t = (y - yFast) / (ySlow - yFast);
    return (int)(driveSpeed + t * (creepSpeed - driveSpeed));
}
