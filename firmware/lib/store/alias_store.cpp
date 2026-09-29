#include "alias_store.h"
#include <Arduino.h>
#include <FS.h>
#include <LittleFS.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <cstring>

static const char* kPath = "/aliases.json";
static const char* kTmp = "/aliases.tmp";
static const size_t kMaxBytes = 16384;
static SemaphoreHandle_t mux;

static bool atomicWrite(const char* data, size_t len) {
    if (len > kMaxBytes) return false;
    File f = LittleFS.open(kTmp, "w");
    if (!f) return false;
    if (f.write((const uint8_t*)data, len) != len) {
        f.close();
        LittleFS.remove(kTmp);
        return false;
    }
    f.close();
    LittleFS.remove(kPath);
    return LittleFS.rename(kTmp, kPath);
}

void aliasStoreBegin() {
    if (!mux) mux = xSemaphoreCreateMutex();
    if (!LittleFS.begin(true)) LittleFS.format(), LittleFS.begin(true);
}

void aliasStoreResetFile() {
    if (mux) xSemaphoreTake(mux, portMAX_DELAY);
    LittleFS.remove(kPath);
    LittleFS.remove(kTmp);
    if (mux) xSemaphoreGive(mux);
}

bool aliasStoreReadJson(char* out, size_t out_cap, size_t* out_len) {
    if (!out || out_cap < 4) return false;
    if (mux) xSemaphoreTake(mux, portMAX_DELAY);
    File f = LittleFS.open(kPath, "r");
    if (!f) {
        const char* empty = "{\"aliases\":[]}";
        size_t n = strlen(empty);
        if (n >= out_cap) {
            if (mux) xSemaphoreGive(mux);
            return false;
        }
        memcpy(out, empty, n + 1);
        if (out_len) *out_len = n;
        if (mux) xSemaphoreGive(mux);
        return true;
    }
    size_t n = f.size();
    if (n >= out_cap || n > kMaxBytes) {
        f.close();
        if (mux) xSemaphoreGive(mux);
        return false;
    }
    n = f.readBytes(out, out_cap - 1);
    out[n] = 0;
    f.close();
    if (out_len) *out_len = n;
    if (mux) xSemaphoreGive(mux);
    return true;
}

bool aliasStoreWriteJson(const char* json, size_t len) {
    if (!json || len == 0 || len > kMaxBytes) return false;
    if (mux) xSemaphoreTake(mux, portMAX_DELAY);
    bool ok = atomicWrite(json, len);
    if (mux) xSemaphoreGive(mux);
    return ok;
}
