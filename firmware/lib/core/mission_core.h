#pragma once
#include <stdint.h>

enum class TerminationReason : uint8_t {
    None = 0,
    Completed,
    TimeLimit,
    ItemLimit,
    Stopped,
    Estop,
    SafeStop,
    VisionUnavailable,
    LowBattery,
    HealthCritical,
};

const char* terminationReasonToString(TerminationReason r);

void formatMissionId(uint32_t boot_count, uint32_t mission_n, char* out, int out_len);

TerminationReason terminationFromStrings(const char* s);
