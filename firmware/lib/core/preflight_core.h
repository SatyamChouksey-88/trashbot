#pragma once
#include <stdint.h>

struct PreflightInputs {
    bool health_critical = false;
    bool bringup_done = false;
    bool calib_present = false;
    bool battery_ok = true;
    bool battery_monitor_enabled = false;
};

struct PreflightResult {
    bool ok = true;
    const char* failed[8]{};
    int failed_count = 0;
};

PreflightResult evaluatePreflight(const PreflightInputs& in);
