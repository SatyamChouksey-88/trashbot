#include "bumper.h"
#include "config.h"
#include <Arduino.h>

void bumperInit() {
    if (!cfg::BUMPER_ENABLED) return;
    pinMode(cfg::PIN_BUMPER, INPUT_PULLUP);
}

bool bumperPressed() {
    if (!cfg::BUMPER_ENABLED) return false;
    return digitalRead(cfg::PIN_BUMPER) == LOW;
}
