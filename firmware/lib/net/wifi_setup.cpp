#include "wifi_setup.h"
#include "config.h"
#include <ESPmDNS.h>
#include <WiFi.h>
#include <cstring>

#if __has_include("secrets.h")
#include "secrets.h"
#else
#define WIFI_SSID ""
#define WIFI_PASS ""
#endif

void wifiSetupBegin(char* ipOut, int ipLen) {
    WiFi.mode(WIFI_STA);
    if (strlen(WIFI_SSID) > 0) {
        WiFi.begin(WIFI_SSID, WIFI_PASS);
        uint32_t start = millis();
        while (WiFi.status() != WL_CONNECTED && millis() - start < cfg::STA_CONNECT_TIMEOUT_MS) delay(100);
    }
    if (WiFi.status() != WL_CONNECTED) {
        uint8_t mac[6];
        WiFi.macAddress(mac);
        char ssid[32];
        snprintf(ssid, sizeof(ssid), "%s%02X%02X", cfg::AP_SSID_PREFIX, mac[4], mac[5]);
        WiFi.mode(WIFI_AP);
        WiFi.softAP(ssid, cfg::AP_PASSWORD);
        strncpy(ipOut, "192.168.4.1", ipLen);
    } else {
        strncpy(ipOut, WiFi.localIP().toString().c_str(), ipLen);
    }
    MDNS.begin(cfg::MDNS_NAME);
    MDNS.addService("http", "tcp", cfg::HTTP_PORT);
}
