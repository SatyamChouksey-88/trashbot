#include "api_json.h"
#include "config.h"
#include <Arduino.h>
#include <ArduinoJson.h>
#include <WiFi.h>

const char* stateToString(State s) {
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
    case State::DONE: return "DONE";
    case State::ESTOP: return "ESTOP";
    }
    return "UNKNOWN";
}

const char* eventTypeToString(EventType t) {
    switch (t) {
    case EventType::boot: return "boot";
    case EventType::wifi_ready: return "wifi_ready";
    case EventType::camera_error: return "camera_error";
    case EventType::model_missing: return "model_missing";
    case EventType::mode_changed: return "mode_changed";
    case EventType::session_start: return "session_start";
    case EventType::target_found: return "target_found";
    case EventType::target_lost: return "target_lost";
    case EventType::obstacle: return "obstacle";
    case EventType::scoop_start: return "scoop_start";
    case EventType::item_collected: return "item_collected";
    case EventType::item_failed: return "item_failed";
    case EventType::item_skipped: return "item_skipped";
    case EventType::session_done: return "session_done";
    case EventType::estop: return "estop";
    case EventType::estop_reset: return "estop_reset";
    case EventType::manual_expired: return "manual_expired";
    case EventType::sound_trigger: return "sound_trigger";
    case EventType::low_battery: return "low_battery";
    case EventType::vision_unavailable: return "vision_unavailable";
    case EventType::calib_saved: return "calib_saved";
    }
    return "unknown";
}

void sendStatusJson(WebServer& server) {
    sharedStateLock();
    auto& s = sharedStatus();
    JsonDocument doc;
    doc["fw"] = s.fw;
    doc["mode"] = s.mode == Mode::Auto ? "auto" : (s.mode == Mode::Manual ? "manual" : "idle");
    doc["state"] = stateToString(s.state);
    JsonObject sess = doc["session"].to<JsonObject>();
    sess["active"] = s.session.active;
    sess["collected"] = s.session.collected;
    sess["failed"] = s.session.failed;
    sess["skipped"] = s.session.skipped;
    sess["max_items"] = s.session.max_items;
    sess["elapsed_s"] = s.session.elapsed_s;
    sess["max_time_s"] = s.session.max_time_s;
    if (s.session_label[0]) sess["label"] = s.session_label;
    doc["distance_cm"] = s.distance_cm;
    JsonArray dets = doc["detections"].to<JsonArray>();
    for (int i = 0; i < s.detections.count; i++) {
        JsonObject o = dets.add<JsonObject>();
        o["x"] = s.detections.items[i].x;
        o["y"] = s.detections.items[i].y;
        o["w"] = s.detections.items[i].w;
        o["h"] = s.detections.items[i].h;
        o["score"] = s.detections.items[i].score;
    }
    doc["detections_age_ms"] = s.detections_age_ms;
    doc["vision_ms"] = s.vision_ms;
    doc["detector"] = s.detector;
    doc["model_loaded"] = s.model_loaded;
    doc["camera"] = s.camera;
    JsonObject scoop = doc["scoop"].to<JsonObject>();
    scoop["deg"] = s.scoop_deg;
    scoop["state"] = s.scoop_deg <= s.servo_down_calib + 5 ? "down" : "carry";
    JsonObject wifi = doc["wifi"].to<JsonObject>();
    if (WiFi.getMode() == WIFI_AP) {
        wifi["mode"] = "ap";
        wifi["ip"] = WiFi.softAPIP().toString();
        wifi["rssi"] = 0;
    } else {
        wifi["mode"] = "sta";
        wifi["ip"] = WiFi.localIP().toString();
        wifi["rssi"] = WiFi.RSSI();
    }
    doc["psram_bytes"] = ESP.getPsramSize();
    doc["chip_temp_c"] = temperatureRead();
    if (s.battery_v >= 0) doc["battery_v"] = s.battery_v;
    else doc["battery_v"] = nullptr;
    doc["estop"] = s.estop;
    if (s.last_error[0]) doc["last_error"] = s.last_error;
    else doc["last_error"] = nullptr;
    doc["uptime_ms"] = millis();
    String out;
    serializeJson(doc, out);
    sharedStateUnlock();
    server.send(200, "application/json", out);
}
