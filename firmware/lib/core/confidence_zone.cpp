#include "confidence_zone.h"

ConfidenceZone classifyScore(float score, float ignore_below, float confident_at) {
    if (score < ignore_below) return ConfidenceZone::Ignore;
    if (score < confident_at) return ConfidenceZone::Uncertain;
    return ConfidenceZone::Confident;
}
