#include "status_led.h"
#include "config.h"
#include <Arduino.h>

static Mode g_mode = Mode::Idle;

void statusLedBegin() {
    pinMode(cfg::PIN_STATUS_LED, OUTPUT);
    digitalWrite(cfg::PIN_STATUS_LED, HIGH);
}

void statusLedSetMode(Mode mode, State) {
    g_mode = mode;
}

void statusLedTick(uint32_t now) {
    bool on = (now / 500) % 2 == 0;
    if (g_mode == Mode::Auto) on = (now / 200) % 2 == 0;
    digitalWrite(cfg::PIN_STATUS_LED, on ? LOW : HIGH);
}
