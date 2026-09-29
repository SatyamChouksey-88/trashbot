#include "profile_core.h"

static int clampi(int v, int lo, int hi) {
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
}

ProfileTunables profileClamp(const ProfileTunables& in, int obstacle_min_cm, int max_duty_max) {
    ProfileTunables o = in;
    o.obstacle_stop_cm = clampi(o.obstacle_stop_cm, obstacle_min_cm, 40);
    o.max_duty = clampi(o.max_duty, 10, max_duty_max);
    if (o.detection_min_score < 0.4f) o.detection_min_score = 0.4f;
    if (o.detection_min_score > 0.95f) o.detection_min_score = 0.95f;
    return o;
}
