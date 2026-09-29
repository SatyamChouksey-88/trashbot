#pragma once
#include "detector.h"

class EiDetector : public Detector {
public:
    bool begin() override;
    bool detect(const uint8_t* rgb96, Detections& out) override;
    const char* name() const override { return "edge_impulse"; }
    bool modelLoaded() const override;
};
