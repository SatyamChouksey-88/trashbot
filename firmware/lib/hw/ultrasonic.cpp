#include "ultrasonic.h"
#include "config.h"
#include <Arduino.h>

static int history[3] = {400, 400, 400};
static int hidx = 0;

void ultrasonicBegin() {
    pinMode(cfg::PIN_US_TRIG, OUTPUT);
    pinMode(cfg::PIN_US_ECHO, INPUT);
}

void ultrasonicTrigger() {
    digitalWrite(cfg::PIN_US_TRIG, LOW);
    delayMicroseconds(2);
    digitalWrite(cfg::PIN_US_TRIG, HIGH);
    delayMicroseconds(10);
    digitalWrite(cfg::PIN_US_TRIG, LOW);
}

static int median3(int a, int b, int c) {
    if (a > b) { int t = a; a = b; b = t; }
    if (b > c) { int t = b; b = c; c = t; }
    if (a > b) { int t = a; a = b; b = t; }
    return b;
}

int ultrasonicReadCm() {
    unsigned long dur = pulseIn(cfg::PIN_US_ECHO, HIGH, cfg::US_TIMEOUT_US);
    int cm = dur == 0 ? cfg::US_NO_ECHO_CM : (int)(dur / 58);
    history[hidx] = cm;
    hidx = (hidx + 1) % 3;
    return median3(history[0], history[1], history[2]);
}
