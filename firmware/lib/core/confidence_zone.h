#pragma once
#include <stdint.h>

enum class ConfidenceZone : uint8_t { Ignore = 0, Uncertain, Confident };

ConfidenceZone classifyScore(float score, float ignore_below, float confident_at);
