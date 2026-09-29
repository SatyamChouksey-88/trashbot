#include "http_api.h"
#include "api_json.h"
#include "calib.h"
#include "config.h"
#include "shared_state.h"
#include "target.h"
#include "web_index.h"
#include <ArduinoJson.h>
#include <cmath>
#include <cstring>

#if __has_include("secrets.h")
#include "secrets.h"
#else
#define API_TOKEN ""
#endif

static bool checkToken(WebServer& server) {
    if (strlen(API_TOKEN) == 0) return true;
    if (server.hasHeader("X-TrashBot-Token") && server.header("X-TrashBot-Token") == API_TOKEN) return true;
    server.send(401, "application/json", "{\"error\":\"unauthorized\"}");
    return false;
}

static void enqueue(const RobotCommand& c) { xQueueSend(commandQueue(), &c, 0); }

static bool parseBody(WebServer& server, JsonDocument& doc) {
    if (deserializeJson(doc, server.arg("plain"))) {
        server.send(400, "application/json", "{\"error\":\"bad json\"}");
        return false;
    }
    return true;
}

static Mode currentMode() {
    sharedStateLock();
    Mode m = sharedStatus().mode;
    sharedStateUnlock();
    return m;
}

static bool rejectUnlessManual(WebServer& server, const char* action) {
    Mode m = currentMode();
    if (m != Mode::Manual) {
        String msg = String("{\"error\":\"") + action + " requires manual mode\"}";
        server.send(409, "application/json", msg);
        return true;
    }
    return false;
}

static void handleCalibPost(WebServer& server, const String& key) {
    if (!checkToken(server)) return;
    JsonDocument doc;
    if (!parseBody(server, doc)) return;
    float value = 0;
    if (doc["from"].is<const char*>()) {
        const char* from = doc["from"];
        if (strcmp(from, "current_distance") == 0) {
            sharedStateLock();
            value = (float)sharedStatus().distance_cm;
            sharedStateUnlock();
        } else if (strcmp(from, "current_target") == 0) {
            sharedStateLock();
            Detection d{};
            bool ok = pickTarget(sharedStatus().detections, cfg::DETECTION_MIN_SCORE, cfg::DETECTION_MAX_AGE_MS,
                                 millis(), d);
            sharedStateUnlock();
            if (!ok) {
                server.send(400, "application/json", "{\"error\":\"no target\"}");
                return;
            }
            if (key == "zone_xmin") value = d.x - d.w / 2;
            else if (key == "zone_xmax") value = d.x + d.w / 2;
            else if (key == "zone_ymin") value = d.y - d.h / 2;
            else {
                server.send(400, "application/json", "{\"error\":\"bad key for target\"}");
                return;
            }
        }
    } else {
        value = doc["value"] | 0.0f;
    }
    if (key == "servo_down" || key == "servo_carry" || key == "servo_tip" || key == "self_echo_cm" ||
        key == "max_duty")
        calibSaveInt(key.c_str(), (int)value);
    else
        calibSaveFloat(key.c_str(), value);
    server.send(200, "application/json", String("{\"ok\":true,\"key\":\"") + key + "\",\"value\":" + value + "}");
}

void httpApiBegin(WebServer& server) {
    server.on("/", [&]() { server.send_P(200, "text/html", WEB_INDEX); });

    server.on("/api/status", HTTP_GET, [&]() {
        if (!checkToken(server)) return;
        sendStatusJson(server);
    });

    server.on("/api/health", HTTP_GET, [&]() {
        if (!checkToken(server)) return;
        sendHealthJson(server);
    });

    server.on("/api/photo", HTTP_GET, [&]() {
        if (!checkToken(server)) return;
        sharedStateLock();
        if (!sharedStatus().photo_len) {
            sharedStateUnlock();
            server.send(503, "application/json", "{\"error\":\"camera unavailable\"}");
            return;
        }
        size_t len = sharedStatus().photo_len;
        uint8_t* buf = sharedStatus().photo;
        sharedStateUnlock();
        server.sendHeader("Content-Type", "image/jpeg");
        server.sendHeader("Content-Length", String(len));
        server.send(200);
        server.client().write(buf, len);
    });

    server.on("/api/mode", HTTP_POST, [&]() {
        if (!checkToken(server)) return;
        JsonDocument doc;
        if (!parseBody(server, doc)) return;
        const char* mode = doc["mode"] | "idle";
        if (strcmp(mode, "auto") == 0) {
            server.send(400, "application/json", "{\"error\":\"use /api/clean for auto\"}");
            return;
        }
        RobotCommand c{CmdType::SetMode};
        c.mode = strcmp(mode, "manual") == 0 ? Mode::Manual : Mode::Idle;
        enqueue(c);
        server.send(200, "application/json", String("{\"ok\":true,\"mode\":\"") + mode + "\"}");
    });

    server.on("/api/drive", HTTP_POST, [&]() {
        if (!checkToken(server)) return;
        if (rejectUnlessManual(server, "drive")) return;
        JsonDocument doc;
        if (!parseBody(server, doc)) return;
        RobotCommand c{CmdType::Drive};
        c.left = doc["left"] | 0;
        c.right = doc["right"] | 0;
        c.duration_ms = doc["duration_ms"] | cfg::MANUAL_CMD_DEFAULT_MS;
        if (c.duration_ms > cfg::MANUAL_CMD_MAX_MS) c.duration_ms = cfg::MANUAL_CMD_MAX_MS;
        enqueue(c);
        server.send(200, "application/json", "{\"ok\":true}");
    });

    server.on("/api/move", HTTP_POST, [&]() {
        if (!checkToken(server)) return;
        if (currentMode() == Mode::Auto) {
            server.send(409, "application/json", "{\"error\":\"move not allowed in auto\"}");
            return;
        }
        JsonDocument doc;
        if (!parseBody(server, doc)) return;
        RobotCommand c{CmdType::Move};
        c.move_cm = doc["distance_cm"] | 0;
        c.move_speed = doc["speed"] | cfg::DRIVE_SPEED_PCT;
        enqueue(c);
        int dur = (int)(std::abs(c.move_cm) * 1000.0f / cfg::FWD_CM_PER_S_AT_DRIVE_SPEED);
        server.send(200, "application/json", String("{\"ok\":true,\"duration_ms\":") + dur + "}");
    });

    server.on("/api/turn", HTTP_POST, [&]() {
        if (!checkToken(server)) return;
        if (currentMode() == Mode::Auto) {
            server.send(409, "application/json", "{\"error\":\"turn not allowed in auto\"}");
            return;
        }
        JsonDocument doc;
        if (!parseBody(server, doc)) return;
        RobotCommand c{CmdType::Turn};
        c.turn_deg = doc["degrees"] | 0;
        c.turn_speed = doc["speed"] | cfg::TURN_SPEED_PCT;
        enqueue(c);
        int dur = (int)(std::abs(c.turn_deg) * 1000.0f / cfg::TURN_DEG_PER_S_AT_TURN_SPEED);
        server.send(200, "application/json", String("{\"ok\":true,\"duration_ms\":") + dur + "}");
    });

    server.on("/api/scoop", HTTP_POST, [&]() {
        if (!checkToken(server)) return;
        if (rejectUnlessManual(server, "scoop")) return;
        JsonDocument doc;
        if (!parseBody(server, doc)) return;
        RobotCommand c{CmdType::Scoop};
        const char* action = doc["action"] | "carry";
        strncpy(c.scoop_action, action, sizeof(c.scoop_action) - 1);
        enqueue(c);
        server.send(200, "application/json", "{\"ok\":true}");
    });

    server.on("/api/clean", HTTP_POST, [&]() {
        if (!checkToken(server)) return;
        if (healthBlocksAuto(buildHealthInputs())) {
            server.send(409, "application/json", "{\"error\":\"health_critical\"}");
            return;
        }
        JsonDocument doc;
        if (!parseBody(server, doc)) return;
        RobotCommand c{CmdType::Clean};
        c.max_items = doc["max_items"] | cfg::SESSION_MAX_ITEMS_DEFAULT;
        c.max_time_s = doc["max_time_s"] | cfg::SESSION_MAX_S_DEFAULT;
        const char* label = doc["label"] | "";
        strncpy(c.label, label, sizeof(c.label) - 1);
        enqueue(c);
        server.send(200, "application/json", "{\"ok\":true}");
    });

    server.on("/api/stop", HTTP_POST, [&]() {
        if (!checkToken(server)) return;
        enqueue(RobotCommand{CmdType::Stop});
        server.send(200, "application/json", "{\"ok\":true}");
    });

    server.on("/api/estop", HTTP_POST, [&]() {
        if (!checkToken(server)) return;
        enqueue(RobotCommand{CmdType::Estop});
        server.send(200, "application/json", "{\"ok\":true}");
    });

    server.on("/api/estop/reset", HTTP_POST, [&]() {
        if (!checkToken(server)) return;
        enqueue(RobotCommand{CmdType::EstopReset});
        server.send(200, "application/json", "{\"ok\":true}");
    });

    server.on("/api/calib", HTTP_GET, [&]() {
        if (!checkToken(server)) return;
        JsonDocument doc;
        calibToJson(doc.to<JsonObject>());
        String out;
        serializeJson(doc, out);
        server.send(200, "application/json", out);
    });

    static const char* calibKeys[] = {"zone_xmin", "zone_xmax", "zone_ymin", "servo_down", "servo_carry",
                                      "servo_tip", "turn_dps", "fwd_cps", "self_echo_cm", "max_duty"};
    for (const char* k : calibKeys) {
        String key = k;
        String path = String("/api/calib/") + key;
        server.on(path.c_str(), HTTP_POST, [&, key]() { handleCalibPost(server, key); });
    }

    server.on("/api/log", HTTP_GET, [&]() {
        if (!checkToken(server)) return;
        uint32_t since = server.hasArg("since") ? server.arg("since").toInt() : 0;
        Event ev[64];
        int n = sharedEvents().since(since, ev, 64);
        JsonDocument doc;
        JsonArray arr = doc["events"].to<JsonArray>();
        for (int i = 0; i < n; i++) {
            JsonObject o = arr.add<JsonObject>();
            o["seq"] = ev[i].seq;
            o["t_ms"] = ev[i].t_ms;
            o["type"] = eventTypeToString(ev[i].type);
            o["a"] = ev[i].a;
            o["b"] = ev[i].b;
        }
        doc["last_seq"] = sharedEvents().lastSeq();
        String out;
        serializeJson(doc, out);
        server.send(200, "application/json", out);
    });

    server.begin();
}

void httpApiHandle(WebServer& server) { server.handleClient(); }
