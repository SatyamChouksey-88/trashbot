#include "detector_ei.h"
#include "config.h"

#if __has_include(TRASHBOT_EI_HEADER)
#define TRASHBOT_EI_AVAILABLE 1
#include TRASHBOT_EI_HEADER
#else
#define TRASHBOT_EI_AVAILABLE 0
#endif

bool EiDetector::begin() {
#if TRASHBOT_EI_AVAILABLE
    return true;
#else
    return false;
#endif
}

bool EiDetector::detect(const uint8_t* rgb96, Detections& out) {
#if TRASHBOT_EI_AVAILABLE
    (void)rgb96;
    (void)out;
    return false;
#else
    (void)rgb96;
    out.count = 0;
    return false;
#endif
}

bool EiDetector::modelLoaded() const {
#if TRASHBOT_EI_AVAILABLE
    return true;
#else
    return false;
#endif
}
