#pragma once
#include "detector.h"

class FakeDetector : public Detector {
public:
    bool begin() override;
    bool detect(const uint8_t* rgb96, Detections& out) override;
    const char* name() const override { return "fake"; }
    bool modelLoaded() const override { return false; }
};
