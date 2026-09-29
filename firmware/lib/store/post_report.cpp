#include "post_report.h"
#include "config.h"
#include "ultrasonic.h"
#include <Arduino.h>
#include <WiFi.h>
#include <cstring>
#include <esp_system.h>

static PostReport s_last{};

static const char* resetReasonStr() {
    switch (esp_reset_reason()) {
    case ESP_RST_POWERON: return "power_on";
    case ESP_RST_SW: return "software";
    case ESP_RST_PANIC: return "panic";
    case ESP_RST_INT_WDT: return "int_wdt";
    case ESP_RST_TASK_WDT: return "task_wdt";
    case ESP_RST_WDT: return "wdt";
    case ESP_RST_BROWNOUT: return "brownout";
    default: return "other";
    }
}

PostReport runBootPost(bool camera_ok) {
    PostReport report{};
    strncpy(report.reset_reason, resetReasonStr(), sizeof(report.reset_reason) - 1);

    PostInputs in{};
    in.psram_ok = ESP.getPsramSize() > 0;
    in.nvs_ok = true;
    in.camera_ok = camera_ok;
    in.detector_ok = true;
    in.servo_ok = true;

    int valid = 0;
    for (int i = 0; i < 5; i++) {
        ultrasonicTrigger();
        delay(70);
        int cm = ultrasonicReadCm();
        if (cm > 0 && cm < cfg::US_NO_ECHO_CM) valid++;
    }
    in.ultrasonic_valid_samples = valid;
    in.ultrasonic_no_echo_declared = valid < 3;

    in.wifi_ok = WiFi.status() == WL_CONNECTED || WiFi.getMode() == WIFI_AP;

    report.result = evaluatePost(in);
    report.finished_ms = millis();
    s_last = report;
    return report;
}

const PostReport* postLastReport() { return &s_last; }
