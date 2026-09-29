#include "detector_fake.h"
#include <Arduino.h>

static float phase = 0.0f;

bool FakeDetector::begin() { return true; }

bool FakeDetector::detect(const uint8_t* rgb96, Detections& out) {
    phase += 0.02f;
    if (phase > 1.0f) phase = 0.0f;
    out.count = 1;
    out.items[0] = {0.5f, phase, 0.12f, 0.12f, 0.85f};
    out.t_ms = millis();
    (void)rgb96;
    return true;
}
