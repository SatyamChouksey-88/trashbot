#include "battery.h"
#include "config.h"
#include <Arduino.h>

float batteryReadVolts() {
    if (!cfg::BATTERY_MONITOR_ENABLED) return -1.0f;
    int raw = analogRead(cfg::PIN_BATTERY_ADC);
    return (raw / 4095.0f) * 3.3f * cfg::BATTERY_DIVIDER_RATIO;
}
