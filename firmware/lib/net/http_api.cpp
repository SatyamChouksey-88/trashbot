#include "http_api.h"
#include "config.h"
#include "shared_state.h"
#include "web_index.h"
#include <ArduinoJson.h>

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

static void enqueue(const RobotCommand& c) {
    xQueueSend(commandQueue(), &c, 0);
}

void httpApiBegin(WebServer& server) {
    server.on("/", [&]() { server.send_P(200, "text/html", WEB_INDEX); });
    server.on("/api/status", HTTP_GET, [&]() {
        if (!checkToken(server)) return;
        sharedStateLock();
        auto& s = sharedStatus();
        JsonDocument doc;
        doc["fw"] = s.fw;
        doc["mode"] = s.mode == Mode::Auto ? "auto" : (s.mode == Mode::Manual ? "manual" : "idle");
        doc["state"] = (int)s.state;
        doc["distance_cm"] = s.distance_cm;
        doc["detections_age_ms"] = s.detections_age_ms;
        doc["vision_ms"] = s.vision_ms;
        doc["detector"] = s.detector;
        doc["model_loaded"] = s.model_loaded;
        doc["camera"] = s.camera;
        doc["estop"] = s.estop;
        doc["uptime_ms"] = millis();
        String out;
        serializeJson(doc, out);
        sharedStateUnlock();
        server.send(200, "application/json", out);
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
    server.on("/api/stop", HTTP_POST, [&]() {
        if (!checkToken(server)) return;
        RobotCommand c{CmdType::Stop};
        enqueue(c);
        server.send(200, "application/json", "{\"ok\":true}");
    });
    server.on("/api/drive", HTTP_POST, [&]() {
        if (!checkToken(server)) return;
        JsonDocument doc;
        if (deserializeJson(doc, server.arg("plain"))) {
            server.send(400, "application/json", "{\"error\":\"bad json\"}");
            return;
        }
        RobotCommand c{CmdType::Drive};
        c.left = doc["left"] | 0;
        c.right = doc["right"] | 0;
        c.duration_ms = doc["duration_ms"] | 300;
        enqueue(c);
        server.send(200, "application/json", "{\"ok\":true}");
    });
    server.on("/api/clean", HTTP_POST, [&]() {
        if (!checkToken(server)) return;
        JsonDocument doc;
        deserializeJson(doc, server.arg("plain"));
        RobotCommand c{CmdType::Clean};
        c.max_items = doc["max_items"] | 5;
        c.max_time_s = doc["max_time_s"] | 180;
        enqueue(c);
        server.send(200, "application/json", "{\"ok\":true}");
    });
    server.on("/api/log", HTTP_GET, [&]() {
        if (!checkToken(server)) return;
        uint32_t since = server.hasArg("since") ? server.arg("since").toInt() : 0;
        Event ev[32];
        int n = sharedEvents().since(since, ev, 32);
        JsonDocument doc;
        JsonArray arr = doc["events"].to<JsonArray>();
        for (int i = 0; i < n; i++) {
            JsonObject o = arr.add<JsonObject>();
            o["seq"] = ev[i].seq;
            o["t_ms"] = ev[i].t_ms;
            o["type"] = (int)ev[i].type;
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
