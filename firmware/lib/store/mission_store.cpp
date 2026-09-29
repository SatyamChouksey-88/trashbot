#include "mission_store.h"
#include "config.h"
#include <Arduino.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <cstring>

static Preferences prefs;
static MissionRecord current_{};
static uint32_t boot_count_ = 0;
static uint32_t mission_n_ = 0;

void missionStoreBegin() {
    prefs.begin("trashbot", false);
    boot_count_ = prefs.getUInt("boot_count", 0) + 1;
    prefs.putUInt("boot_count", boot_count_);
    mission_n_ = prefs.getUInt("mission_n", 0);
}

uint32_t missionBootCount() { return boot_count_; }

void missionOnStart(const char* label, int max_items, const char* goal, uint32_t uptime_ms) {
    mission_n_++;
    prefs.putUInt("mission_n", mission_n_);
    memset(&current_, 0, sizeof(current_));
    current_.active = true;
    formatMissionId(boot_count_, mission_n_, current_.mission_id, sizeof(current_.mission_id));
    if (goal && goal[0]) strncpy(current_.goal, goal, sizeof(current_.goal) - 1);
    else strncpy(current_.goal, "clean", sizeof(current_.goal) - 1);
    if (label) strncpy(current_.label, label, sizeof(current_.label) - 1);
    current_.started_uptime_ms = uptime_ms;
    (void)max_items;
}

void missionSetLabel(const char* label) {
    if (label && current_.active) strncpy(current_.label, label, sizeof(current_.label) - 1);
}

void missionOnRecovery() {
    if (current_.active) current_.recoveries++;
}

void missionOnSessionStats(int collected, int failed, int skipped) {
    current_.items_collected = collected;
    current_.items_failed = failed;
    current_.items_skipped = skipped;
}

static void appendHistoryLine(const MissionRecord& r) {
    JsonDocument doc;
    doc["mission_id"] = r.mission_id;
    doc["goal"] = r.goal;
    doc["label"] = r.label;
    doc["started_uptime_ms"] = r.started_uptime_ms;
    doc["duration_s"] = r.duration_s;
    doc["items_collected"] = r.items_collected;
    doc["items_failed"] = r.items_failed;
    doc["items_skipped"] = r.items_skipped;
    doc["recoveries"] = r.recoveries;
    doc["termination_reason"] = r.termination_reason;
    String line;
    serializeJson(doc, line);
    String hist = prefs.getString("mission_hist", "");
    if (hist.length()) hist += "\n";
    hist += line;
    int lines = 0;
    for (size_t i = 0; i < hist.length(); i++)
        if (hist[i] == '\n') lines++;
    while (lines >= cfg::MISSION_HISTORY && hist.indexOf('\n') >= 0) {
        hist = hist.substring(hist.indexOf('\n') + 1);
        lines--;
    }
    prefs.putString("mission_hist", hist);
}

void missionOnEnd(TerminationReason reason, uint32_t uptime_ms) {
    if (!current_.active) return;
    current_.active = false;
    current_.duration_s = (int)((uptime_ms - current_.started_uptime_ms) / 1000);
    strncpy(current_.termination_reason, terminationReasonToString(reason), sizeof(current_.termination_reason) - 1);
    appendHistoryLine(current_);
}

const MissionRecord& missionCurrent() { return current_; }

int missionHistoryJson(char* out, int out_len, int limit) {
    String hist = prefs.getString("mission_hist", "");
    JsonDocument doc;
    JsonArray arr = doc["missions"].to<JsonArray>();
    int count = 0;
    int start = 0;
    for (size_t i = 0; i <= hist.length(); i++) {
        if (i == hist.length() || hist[i] == '\n') {
            if (i > start) {
                JsonDocument one;
                if (!deserializeJson(one, hist.substring(start, i))) {
                    if (count < limit) arr.add(one.as<JsonObject>());
                    count++;
                }
            }
            start = (int)i + 1;
        }
    }
    String serialized;
    serializeJson(doc, serialized);
    strncpy(out, serialized.c_str(), out_len - 1);
    out[out_len - 1] = 0;
    return (int)serialized.length();
}
