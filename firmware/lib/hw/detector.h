#pragma once
#include "types.h"

class Detector {
public:
    virtual ~Detector() = default;
    virtual bool begin() = 0;
    virtual bool detect(const uint8_t* rgb96, Detections& out) = 0;
    virtual const char* name() const = 0;
    virtual bool modelLoaded() const = 0;
};
