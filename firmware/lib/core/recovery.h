#pragma once
#include "timed_move.h"
#include <stdint.h>

struct BrainCalib;

enum class RecoveryReason : uint8_t {
    None = 0,
    TargetLost,
    Obstacle,
    Stuck,
    ScoopFailed,
    VisionUnavailable,
    Bumper,
    SensorInvalid,
};

enum class RecoveryAdvance : uint8_t {
    Continue,
    Success,
    SkipItem,
    SafeStop,
    Failed,
};

const char* recoveryReasonToString(RecoveryReason r);
const char* recoveryStepLabel(RecoveryReason r, int step);

class RecoveryManager {
public:
    void resetSession();
    bool active() const { return reason_ != RecoveryReason::None; }
    RecoveryReason reason() const { return reason_; }
    int step() const { return step_; }
    int attempt() const { return attempt_; }

    bool start(RecoveryReason reason, uint32_t now_ms);

    TimedMove stepMove(const BrainCalib& calib) const;
    RecoveryAdvance onStepDone(uint32_t now_ms);

private:
    RecoveryReason reason_ = RecoveryReason::None;
    int step_ = 0;
    int attempt_ = 0;
    int session_count_ = 0;
    uint32_t episode_start_ms_ = 0;
    bool turn_left_ = true;
    int stepsTotal() const;
};
