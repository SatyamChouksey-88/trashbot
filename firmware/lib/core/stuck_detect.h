#pragma once
#include <stdint.h>

struct StuckState {
    uint32_t stuck_since_ms = 0;
    int last_distance_cm = 400;
    bool latched = false;
};

void stuckDetectUpdate(StuckState& st, uint32_t now_ms, int left, int right, float motion_score, int distance_cm,
                       bool ultrasonic_valid);
bool stuckDetectTriggered(const StuckState& st, uint32_t now_ms);
