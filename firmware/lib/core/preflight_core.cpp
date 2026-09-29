#include "preflight_core.h"

PreflightResult evaluatePreflight(const PreflightInputs& in) {
    PreflightResult r{};
    r.ok = true;
    auto fail = [&](const char* name) {
        if (r.failed_count < 8) r.failed[r.failed_count++] = name;
        r.ok = false;
    };
    if (in.health_critical) fail("health_critical");
    if (!in.bringup_done) fail("bringup_required");
    if (!in.calib_present) fail("calibration_missing");
    if (in.battery_monitor_enabled && !in.battery_ok) fail("battery_low");
    return r;
}
