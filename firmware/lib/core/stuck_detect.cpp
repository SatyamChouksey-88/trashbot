#include "stuck_detect.h"
#include "config.h"

static bool forwardCommand(int left, int right) {
    int avg = (left + right) / 2;
    int diff = left - right;
    if (avg >= cfg::STUCK_MIN_CMD_PCT) return true;
    if (diff >= cfg::STUCK_MIN_CMD_PCT || diff <= -cfg::STUCK_MIN_CMD_PCT) return true;
    return false;
}

void stuckDetectUpdate(StuckState& st, uint32_t now_ms, int left, int right, float motion_score, int distance_cm,
                       bool ultrasonic_valid) {
    if (!forwardCommand(left, right)) {
        st.stuck_since_ms = 0;
        st.latched = false;
        st.last_distance_cm = distance_cm;
        return;
    }
    bool low_motion = motion_score < cfg::STUCK_MOTION_MAX;
    int progress = st.last_distance_cm - distance_cm;
    bool no_progress = !ultrasonic_valid || progress < cfg::STUCK_MIN_PROGRESS_CM;
    if (low_motion && no_progress) {
        if (st.stuck_since_ms == 0) st.stuck_since_ms = now_ms;
        if (now_ms - st.stuck_since_ms >= cfg::STUCK_TIME_MS) st.latched = true;
    } else {
        st.stuck_since_ms = 0;
        st.latched = false;
    }
    st.last_distance_cm = distance_cm;
}

bool stuckDetectTriggered(const StuckState& st, uint32_t now_ms) {
    return st.latched && st.stuck_since_ms != 0 && now_ms - st.stuck_since_ms >= cfg::STUCK_TIME_MS;
}
