#include "health_core.h"
#include "config.h"

static HealthStatus worst(HealthStatus a, HealthStatus b) {
    if (a == HealthStatus::Critical || b == HealthStatus::Critical) return HealthStatus::Critical;
    if (a == HealthStatus::Degraded || b == HealthStatus::Degraded) return HealthStatus::Degraded;
    return HealthStatus::Ok;
}

HealthStatus healthOverall(const HealthInputs& in) {
    HealthStatus o = HealthStatus::Ok;
    if (!in.psram_ok) o = worst(o, HealthStatus::Critical);
    if (in.heap_free < 32768) o = worst(o, HealthStatus::Critical);
    if (!in.camera_ok) o = worst(o, HealthStatus::Degraded);
    if (!in.detector_ok) o = worst(o, HealthStatus::Degraded);
    if (!in.motor_lease_ok) o = worst(o, HealthStatus::Critical);
    if (!in.vision_hb_ok) o = worst(o, HealthStatus::Critical);
    if (!in.control_hb_ok) o = worst(o, HealthStatus::Critical);
    if (in.estop) o = worst(o, HealthStatus::Critical);
    if (in.battery_enabled && in.battery_v > 0 && in.battery_v < cfg::BATTERY_STOP_V)
        o = worst(o, HealthStatus::Critical);
    if (in.temp_c > cfg::OVERTEMP_C) o = worst(o, HealthStatus::Critical);
    if (!in.wifi_ok) o = worst(o, HealthStatus::Degraded);
    return o;
}

bool healthBlocksAuto(const HealthInputs& in) { return healthOverall(in) == HealthStatus::Critical; }

int healthBuildChecks(const HealthInputs& in, HealthCheckRow* rows, int max_rows) {
    int n = 0;
    auto add = [&](const char* name, HealthStatus st, const char* val, const char* detail) {
        if (n >= max_rows) return;
        rows[n++] = {name, st, val, detail};
    };
    add("psram", in.psram_ok ? HealthStatus::Ok : HealthStatus::Critical, in.psram_ok ? "ok" : "fail", "");
    add("heap", in.heap_free >= 32768 ? HealthStatus::Ok : HealthStatus::Critical, "bytes", "");
    add("camera", in.camera_ok ? HealthStatus::Ok : HealthStatus::Degraded, in.camera_ok ? "ok" : "error", "");
    add("detector", in.detector_ok ? HealthStatus::Ok : HealthStatus::Degraded, in.detector_ok ? "ok" : "missing",
        "");
    add("motor_lease", in.motor_lease_ok ? HealthStatus::Ok : HealthStatus::Critical,
        in.motor_lease_ok ? "ok" : "expired", "");
    add("vision_heartbeat", in.vision_hb_ok ? HealthStatus::Ok : HealthStatus::Critical,
        in.vision_hb_ok ? "ok" : "stale", "");
    add("control_heartbeat", in.control_hb_ok ? HealthStatus::Ok : HealthStatus::Critical,
        in.control_hb_ok ? "ok" : "stale", "");
    add("wifi", in.wifi_ok ? HealthStatus::Ok : HealthStatus::Degraded, in.wifi_ok ? "up" : "down", "");
    add("temperature", in.temp_c <= cfg::OVERTEMP_C ? HealthStatus::Ok : HealthStatus::Critical, "c", "");
    if (in.battery_enabled)
        add("battery", (in.battery_v < 0 || in.battery_v >= cfg::BATTERY_STOP_V) ? HealthStatus::Ok
                                                                                 : HealthStatus::Critical,
            "v", "");
    add("uptime", HealthStatus::Ok, "ms", "");
    add("reset_reason", HealthStatus::Ok, in.reset_reason, "");
    if (in.last_error && in.last_error[0])
        add("last_error", HealthStatus::Degraded, in.last_error, "");
    return n;
}
