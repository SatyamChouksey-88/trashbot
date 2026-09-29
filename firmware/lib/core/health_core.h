#pragma once
#include <stdint.h>

enum class HealthStatus : uint8_t { Ok, Degraded, Critical };

struct HealthCheckRow {
    const char* name;
    HealthStatus status;
    const char* value;
    const char* detail;
};

struct HealthInputs {
    bool psram_ok = false;
    uint32_t heap_free = 0;
    uint32_t heap_min = 0;
    bool camera_ok = false;
    bool detector_ok = true;
    float vision_fps = 0;
    float us_valid_rate = 1.0f;
    bool servo_ok = true;
    bool motor_lease_ok = true;
    bool wifi_ok = true;
    float temp_c = 25;
    float battery_v = -1;
    bool battery_enabled = false;
    bool vision_hb_ok = true;
    bool control_hb_ok = true;
    bool estop = false;
    uint32_t uptime_ms = 0;
    const char* reset_reason = "unknown";
    const char* last_error = "";
};

HealthStatus healthOverall(const HealthInputs& in);
int healthBuildChecks(const HealthInputs& in, HealthCheckRow* rows, int max_rows);
bool healthBlocksAuto(const HealthInputs& in);
