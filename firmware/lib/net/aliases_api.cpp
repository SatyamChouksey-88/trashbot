#include "aliases_api.h"
#include "alias_rules.h"
#include "alias_store.h"
#include "config.h"
#include "shared_state.h"
#include <ArduinoJson.h>
#include <cstring>

static const int kMaxAliases = 50;

static bool parseBody(WebServer& server, JsonDocument& doc) {
    if (server.arg("plain").length() == 0) return false;
    DeserializationError err = deserializeJson(doc, server.arg("plain"));
    return !err;
}

static bool stepFromJson(JsonObject o, AliasStep& s) {
    const char* intent = o["intent"] | "";
    strncpy(s.intent, intent, sizeof(s.intent) - 1);
    JsonObject p = o["params"].as<JsonObject>();
    if (!p.isNull()) {
        strncpy(s.params.direction, p["direction"] | "", sizeof(s.params.direction) - 1);
        strncpy(s.params.action, p["action"] | "", sizeof(s.params.action) - 1);
        s.params.distance_cm = p["distance_cm"] | 0;
        s.params.degrees = p["degrees"] | 0;
        s.params.speed = p["speed"] | 0;
        s.params.max_items = p["max_items"] | 0;
        s.params.max_time_s = p["max_time_s"] | 0;
    }
    return s.intent[0] != 0;
}

static bool entryFromJson(JsonObject o, AliasEntry& e) {
    memset(&e, 0, sizeof(e));
    const char* phrase = o["phrase"] | "";
    strncpy(e.phrase, phrase, sizeof(e.phrase) - 1);
    JsonArray steps = o["steps"].as<JsonArray>();
    if (steps.isNull()) return false;
    e.step_count = 0;
    for (JsonObject st : steps) {
        if (e.step_count >= 3) return false;
        if (!stepFromJson(st, e.steps[e.step_count])) return false;
        e.step_count++;
    }
    return e.step_count > 0;
}

static bool loadDoc(JsonDocument& doc) {
    char buf[4096];
    size_t n = 0;
    if (!aliasStoreReadJson(buf, sizeof(buf), &n)) return false;
    return deserializeJson(doc, buf) == DeserializationError::Ok;
}

static bool saveDoc(JsonDocument& doc) {
    String out;
    serializeJson(doc, out);
    return aliasStoreWriteJson(out.c_str(), out.length());
}

void registerAliasesRoutes(WebServer& server, bool (*checkToken)(WebServer&)) {
    server.on("/api/aliases", HTTP_GET, [&]() {
        if (!checkToken(server)) return;
        char buf[4096];
        size_t n = 0;
        if (!aliasStoreReadJson(buf, sizeof(buf), &n)) {
            server.send(500, "application/json", "{\"error\":\"read_failed\"}");
            return;
        }
        server.send(200, "application/json", buf);
    });

    server.on("/api/aliases", HTTP_POST, [&]() {
        if (!checkToken(server)) return;
        if (!cfg::ALIASES_ENABLED) {
            server.send(503, "application/json", "{\"error\":\"aliases_disabled\"}");
            return;
        }
        if (server.arg("plain").length() > 2048) {
            server.send(400, "application/json", "{\"error\":\"body_too_large\"}");
            return;
        }
        JsonDocument body;
        if (!parseBody(server, body)) {
            server.send(400, "application/json", "{\"error\":\"invalid_json\"}");
            return;
        }
        AliasEntry entry{};
        if (!entryFromJson(body.as<JsonObject>(), entry)) {
            server.send(400, "application/json", "{\"error\":\"bad_param\"}");
            return;
        }
        AliasReason vr = validateAliasEntry(entry);
        if (vr != AliasReason::Ok) {
            server.send(400, "application/json", String("{\"error\":\"") + aliasReasonToString(vr) + "\"}");
            return;
        }
        JsonDocument doc;
        if (!loadDoc(doc)) {
            doc["aliases"].to<JsonArray>();
        }
        JsonArray arr = doc["aliases"].to<JsonArray>();
        bool replaced = false;
        for (JsonObject o : arr) {
            const char* ph = o["phrase"] | "";
            if (strcmp(ph, entry.phrase) == 0) {
                o["steps"] = body["steps"];
                replaced = true;
                break;
            }
        }
        if (!replaced) {
            if (arr.size() >= kMaxAliases) {
                server.send(409, "application/json", "{\"error\":\"full\"}");
                return;
            }
            JsonObject o = arr.add<JsonObject>();
            o["phrase"] = entry.phrase;
            o["steps"] = body["steps"];
        }
        if (!saveDoc(doc)) {
            server.send(500, "application/json", "{\"error\":\"save_failed\"}");
            return;
        }
        sharedEvents().push(EventType::alias_saved, millis(), replaced ? 1 : 0, 0, entry.phrase);
        JsonDocument resp;
        resp["ok"] = true;
        resp["replaced"] = replaced;
        resp["count"] = arr.size();
        String out;
        serializeJson(resp, out);
        server.send(200, "application/json", out);
    });

    server.on("/api/aliases/reset", HTTP_POST, [&]() {
        if (!checkToken(server)) return;
        aliasStoreResetFile();
        sharedEvents().push(EventType::aliases_reset, millis(), 0, 0, "reset");
        server.send(200, "application/json", "{\"ok\":true}");
    });

    server.on("/api/aliases", HTTP_DELETE, [&]() {
        if (!checkToken(server)) return;
        if (!server.hasArg("phrase")) {
            server.send(400, "application/json", "{\"error\":\"phrase_required\"}");
            return;
        }
        String phrase = server.arg("phrase");
        JsonDocument doc;
        if (!loadDoc(doc)) {
            server.send(200, "application/json", "{\"ok\":true,\"removed\":false}");
            return;
        }
        JsonArray arr = doc["aliases"].to<JsonArray>();
        bool removed = false;
        for (size_t i = 0; i < arr.size(); i++) {
            const char* ph = arr[i]["phrase"] | "";
            if (phrase == ph) {
                arr.remove(i);
                removed = true;
                break;
            }
        }
        saveDoc(doc);
        if (removed) sharedEvents().push(EventType::alias_removed, millis(), 0, 0, phrase.c_str());
        JsonDocument resp;
        resp["ok"] = true;
        resp["removed"] = removed;
        String out;
        serializeJson(resp, out);
        server.send(200, "application/json", out);
    });
}
