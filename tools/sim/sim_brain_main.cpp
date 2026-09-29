#include "brain.h"
#include "config.h"
#include <cstdio>
#include <cstring>
#include <iostream>
#include <string>

static float parseFloat(const char* key, const char* json, float def) {
    char pat[64];
    snprintf(pat, sizeof(pat), "\"%s\":", key);
    const char* p = strstr(json, pat);
    if (!p) return def;
    return (float)atof(p + strlen(pat));
}

static int parseInt(const char* key, const char* json, int def) {
    return (int)parseFloat(key, json, (float)def);
}

static bool parseBool(const char* key, const char* json, bool def) {
    char pat[64];
    snprintf(pat, sizeof(pat), "\"%s\":", key);
    const char* p = strstr(json, pat);
    if (!p) return def;
    p += strlen(pat);
    if (strncmp(p, "true", 4) == 0) return true;
    if (strncmp(p, "false", 5) == 0) return false;
    return def;
}

static BrainInput parseInput(const std::string& line) {
    BrainInput in{};
    const char* j = line.c_str();
    in.now_ms = (uint32_t)parseInt("now_ms", j, 0);
    in.distance_cm = parseInt("distance_cm", j, 400);
    in.detections_age_ms = (uint32_t)parseInt("detections_age_ms", j, 0);
    in.camera_ok = parseBool("camera_ok", j, true);
    in.calib = {cfg::SCOOP_ZONE_X_MIN, cfg::SCOOP_ZONE_X_MAX, cfg::SCOOP_ZONE_Y_MIN,
                cfg::SERVO_DOWN_DEG, cfg::SERVO_CARRY_DEG, cfg::SERVO_TIP_DEG,
                cfg::TURN_DEG_PER_S_AT_TURN_SPEED, cfg::FWD_CM_PER_S_AT_DRIVE_SPEED,
                cfg::SCOOP_SELF_ECHO_CM, cfg::MOTOR_MAX_DUTY_PCT};

    if (strstr(j, "\"start\":true")) {
        in.commands.start = true;
        in.commands.start_max_items = parseInt("start_max_items", j, 5);
        in.commands.start_max_time_s = parseInt("start_max_time_s", j, 180);
    }
    if (strstr(j, "\"stop\":true")) in.commands.stop = true;
    if (strstr(j, "\"estop\":true")) in.commands.estop = true;
    if (strstr(j, "\"estop_reset\":true")) in.commands.estop_reset = true;
    if (strstr(j, "\"set_mode\":true")) {
        in.commands.set_mode = true;
        in.commands.mode_target = strstr(j, "\"mode\":\"manual\"") ? Mode::Manual : Mode::Idle;
    }

    const char* d = strstr(j, "\"detections\":[");
    if (d) {
        in.detections.count = 0;
        const char* cur = d;
        while (in.detections.count < 8) {
            const char* o = strstr(cur, "{");
            if (!o || o > strstr(cur, "]")) break;
            Detection det{};
            det.x = parseFloat("x", o, 0.5f);
            det.y = parseFloat("y", o, 0.5f);
            det.w = parseFloat("w", o, 0.1f);
            det.h = parseFloat("h", o, 0.1f);
            det.score = parseFloat("score", o, 0.9f);
            in.detections.items[in.detections.count++] = det;
            in.detections.t_ms = in.now_ms;
            cur = o + 1;
            if (!strstr(cur, "{")) break;
        }
    }
    return in;
}

static const char* stateName(State s) {
    switch (s) {
    case State::IDLE: return "IDLE";
    case State::MANUAL: return "MANUAL";
    case State::SEARCH: return "SEARCH";
    case State::APPROACH: return "APPROACH";
    case State::REACQUIRE: return "REACQUIRE";
    case State::ALIGN: return "ALIGN";
    case State::SCOOP: return "SCOOP";
    case State::TIP: return "TIP";
    case State::VERIFY: return "VERIFY";
    case State::BACKUP: return "BACKUP";
    case State::AVOID: return "AVOID";
    case State::RECOVERY: return "RECOVERY";
    case State::SAFE_PAUSE: return "SAFE_PAUSE";
    case State::DONE: return "DONE";
    case State::ESTOP: return "ESTOP";
    }
    return "UNKNOWN";
}

static void emit(const BrainOutput& o) {
    std::cout << "{\"state\":\"" << stateName(o.state) << "\",\"motor\":{\"left\":" << o.motor.left
              << ",\"right\":" << o.motor.right << "},\"servo_deg\":" << o.servo_deg
              << ",\"session\":{\"collected\":" << o.session.collected << ",\"failed\":" << o.session.failed
              << ",\"active\":" << (o.session.active ? "true" : "false") << "},\"events\":[";
    for (int i = 0; i < o.event_count; i++) {
        if (i) std::cout << ",";
        std::cout << "{\"type\":" << (int)o.events[i].type << "}";
    }
    std::cout << "]}\n";
}

int main() {
    Brain brain;
    brain.reset();
    std::string line;
    while (std::getline(std::cin, line)) {
        if (line.empty()) continue;
        auto in = parseInput(line);
        auto out = brain.step(in);
        emit(out);
    }
    return 0;
}
