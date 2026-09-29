#pragma once
#include "types.h"
#include <stdint.h>

enum class InvariantId : uint8_t {
    None = 0,
    MotorOverCap,
    EstopNonZero,
    ForwardNearObstacle,
    ManualExpired,
    StateRequiresZero,
};

struct InvariantInputs {
    MotorCmd requested{};
    MotorCmd filtered{};
    bool estop = false;
    int distance_cm = 400;
    int obstacle_stop_cm = 15;
    int max_duty_pct = 70;
    State state = State::IDLE;
    bool manual_expired = true;
};

InvariantId checkInvariants(const InvariantInputs& in);
