#pragma once
#include "mission_core.h"
#include <stdint.h>

struct MissionRecord {
    char mission_id[24]{};
    char goal[48] = "clean";
    char label[32]{};
    uint32_t started_uptime_ms = 0;
    int duration_s = 0;
    int items_detected = 0;
    int items_collected = 0;
    int items_failed = 0;
    int items_skipped = 0;
    int recoveries = 0;
    char termination_reason[24]{};
    bool active = false;
};

void missionStoreBegin();
uint32_t missionBootCount();
void missionOnStart(const char* label, int max_items, const char* goal, uint32_t uptime_ms);
void missionSetLabel(const char* label);
void missionOnRecovery();
void missionOnSessionStats(int collected, int failed, int skipped);
void missionOnEnd(TerminationReason reason, uint32_t uptime_ms);
const MissionRecord& missionCurrent();
int missionHistoryJson(char* out, int out_len, int limit);
