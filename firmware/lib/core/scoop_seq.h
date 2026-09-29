#pragma once
#include <stdint.h>

enum class ScoopPhase : uint8_t { Down, Creep, Tip, Hold, Carry, Done };

struct ScoopSequencer {
    ScoopPhase phase = ScoopPhase::Down;
    int targetServoDeg = 0;
    int downDeg_ = 0, carryDeg_ = 0, tipDeg_ = 0;
    uint32_t phaseStartMs = 0;
    uint32_t creepEndMs = 0;
    bool started = false;

    void reset(int downDeg, int carryDeg, int tipDeg, int creepDurationMs);
    bool step(uint32_t now, int& servoDegOut, bool& creepActive);
};
