#include "mission_core.h"
#include <cstdio>
#include <cstring>

const char* terminationReasonToString(TerminationReason r) {
    switch (r) {
    case TerminationReason::Completed: return "completed";
    case TerminationReason::TimeLimit: return "time_limit";
    case TerminationReason::ItemLimit: return "item_limit";
    case TerminationReason::Stopped: return "stopped";
    case TerminationReason::Estop: return "estop";
    case TerminationReason::SafeStop: return "safe_stop";
    case TerminationReason::VisionUnavailable: return "vision_unavailable";
    case TerminationReason::LowBattery: return "low_battery";
    case TerminationReason::HealthCritical: return "health_critical";
    default: return "";
    }
}

void formatMissionId(uint32_t boot_count, uint32_t mission_n, char* out, int out_len) {
    if (!out || out_len < 8) return;
    snprintf(out, out_len, "TB-%lu-%lu", (unsigned long)boot_count, (unsigned long)mission_n);
}

TerminationReason terminationFromStrings(const char* s) {
    if (!s || !s[0]) return TerminationReason::None;
    if (strcmp(s, "completed") == 0) return TerminationReason::Completed;
    if (strcmp(s, "time_limit") == 0) return TerminationReason::TimeLimit;
    if (strcmp(s, "item_limit") == 0) return TerminationReason::ItemLimit;
    if (strcmp(s, "stopped") == 0) return TerminationReason::Stopped;
    if (strcmp(s, "estop") == 0) return TerminationReason::Estop;
    if (strcmp(s, "safe_stop") == 0) return TerminationReason::SafeStop;
    if (strcmp(s, "vision_unavailable") == 0) return TerminationReason::VisionUnavailable;
    if (strcmp(s, "low_battery") == 0) return TerminationReason::LowBattery;
    if (strcmp(s, "health_critical") == 0) return TerminationReason::HealthCritical;
    return TerminationReason::None;
}
