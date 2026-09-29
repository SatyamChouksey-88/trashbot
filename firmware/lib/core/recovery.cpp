#include "recovery.h"
#include "brain.h"
#include "config.h"

const char* recoveryReasonToString(RecoveryReason r) {
    switch (r) {
    case RecoveryReason::TargetLost: return "target_lost";
    case RecoveryReason::Obstacle: return "obstacle";
    case RecoveryReason::Stuck: return "stuck";
    case RecoveryReason::ScoopFailed: return "scoop_failed";
    case RecoveryReason::VisionUnavailable: return "vision_unavailable";
    case RecoveryReason::Bumper: return "bumper";
    case RecoveryReason::SensorInvalid: return "sensor_invalid";
    default: return "none";
    }
}

const char* recoveryStepLabel(RecoveryReason r, int step) {
    switch (r) {
    case RecoveryReason::TargetLost:
        if (step == 0) return "rescan_20";
        if (step == 1) return "rescan_45";
        return "give_up";
    case RecoveryReason::Obstacle:
        if (step == 0) return "backup_10";
        if (step == 1) return "turn_90";
        if (step == 2) return "turn_180";
        return "safe_stop";
    case RecoveryReason::Stuck:
        if (step == 0) return "stop";
        if (step == 1) return "backup_15";
        if (step == 2) return "turn_60";
        return "backup_turn_120";
    case RecoveryReason::ScoopFailed:
        if (step == 0) return "backup_reapproach";
        return "item_failed";
    case RecoveryReason::Bumper:
        if (step == 0) return "stop";
        if (step == 1) return "backup_10";
        return "turn_90";
    default:
        return "step";
    }
}

void RecoveryManager::resetSession() {
    reason_ = RecoveryReason::None;
    step_ = 0;
    attempt_ = 0;
    session_count_ = 0;
    episode_start_ms_ = 0;
}

int RecoveryManager::stepsTotal() const {
    switch (reason_) {
    case RecoveryReason::TargetLost: return 3;
    case RecoveryReason::Obstacle: return 4;
    case RecoveryReason::Stuck: return 4;
    case RecoveryReason::ScoopFailed: return 2;
    case RecoveryReason::VisionUnavailable: return 2;
    case RecoveryReason::Bumper: return 3;
    case RecoveryReason::SensorInvalid: return 2;
    default: return 0;
    }
}

bool RecoveryManager::start(RecoveryReason reason, uint32_t now_ms) {
    if (reason == RecoveryReason::None) return false;
    if (session_count_ >= cfg::RECOVERY_MAX_PER_SESSION) return false;
    if (episode_start_ms_ != 0 && now_ms - episode_start_ms_ > cfg::RECOVERY_TIMEOUT_MS) return false;
    if (reason_ == reason) attempt_++;
    else {
        attempt_ = 1;
        reason_ = reason;
        step_ = 0;
    }
    if (attempt_ > cfg::RECOVERY_MAX_ATTEMPTS) return false;
    if (episode_start_ms_ == 0) episode_start_ms_ = now_ms;
    session_count_++;
    return true;
}

TimedMove RecoveryManager::stepMove(const BrainCalib& calib) const {
    TimedMove idle{};
    if (!active()) return idle;
    switch (reason_) {
    case RecoveryReason::TargetLost:
        if (step_ == 0) return turnDegrees(cfg::REACQUIRE_SWEEP_DEG, cfg::TURN_SPEED_PCT, calib.turn_dps);
        if (step_ == 1) return turnDegrees(-2 * cfg::REACQUIRE_SWEEP_DEG, cfg::TURN_SPEED_PCT, calib.turn_dps);
        return idle;
    case RecoveryReason::Obstacle:
        if (step_ == 0) return moveCm(-cfg::RETRY_BACKUP_CM, cfg::CREEP_SPEED_PCT, calib.fwd_cps);
        if (step_ == 1) {
            int deg = turn_left_ ? cfg::AVOID_TURN_DEG : -cfg::AVOID_TURN_DEG;
            return turnDegrees(deg, cfg::TURN_SPEED_PCT, calib.turn_dps);
        }
        if (step_ == 2) return turnDegrees(180, cfg::TURN_SPEED_PCT, calib.turn_dps);
        return idle;
    case RecoveryReason::Stuck:
        if (step_ == 0) return idle;
        if (step_ == 1) return moveCm(-15, cfg::CREEP_SPEED_PCT, calib.fwd_cps);
        if (step_ == 2) return turnDegrees(60, cfg::TURN_SPEED_PCT, calib.turn_dps);
        if (step_ == 3) {
            TimedMove m = moveCm(-15, cfg::CREEP_SPEED_PCT, calib.fwd_cps);
            return m;
        }
        return idle;
    case RecoveryReason::ScoopFailed:
        if (step_ == 0) return moveCm(-cfg::RETRY_BACKUP_CM, cfg::CREEP_SPEED_PCT, calib.fwd_cps);
        return idle;
    case RecoveryReason::Bumper:
        if (step_ == 0) return idle;
        if (step_ == 1) return moveCm(-cfg::RETRY_BACKUP_CM, cfg::CREEP_SPEED_PCT, calib.fwd_cps);
        if (step_ == 2) {
            int deg = turn_left_ ? cfg::AVOID_TURN_DEG : -cfg::AVOID_TURN_DEG;
            return turnDegrees(deg, cfg::TURN_SPEED_PCT, calib.turn_dps);
        }
        return idle;
    case RecoveryReason::VisionUnavailable:
        return idle;
    case RecoveryReason::SensorInvalid:
        return idle;
    default:
        return idle;
    }
}

RecoveryAdvance RecoveryManager::onStepDone(uint32_t now_ms) {
    if (!active()) return RecoveryAdvance::Success;
    if (now_ms - episode_start_ms_ > cfg::RECOVERY_TIMEOUT_MS) {
        reason_ = RecoveryReason::None;
        return RecoveryAdvance::SafeStop;
    }
    step_++;
    turn_left_ = !turn_left_;
    if (reason_ == RecoveryReason::TargetLost && step_ >= stepsTotal()) {
        reason_ = RecoveryReason::None;
        return RecoveryAdvance::SkipItem;
    }
    if (reason_ == RecoveryReason::Obstacle && step_ >= stepsTotal()) {
        reason_ = RecoveryReason::None;
        return RecoveryAdvance::SafeStop;
    }
    if (reason_ == RecoveryReason::Stuck && step_ >= stepsTotal()) {
        reason_ = RecoveryReason::None;
        return RecoveryAdvance::SafeStop;
    }
    if (reason_ == RecoveryReason::ScoopFailed && step_ >= stepsTotal()) {
        reason_ = RecoveryReason::None;
        return RecoveryAdvance::Failed;
    }
    if (reason_ == RecoveryReason::Bumper && step_ >= 3) {
        reason_ = RecoveryReason::None;
        return RecoveryAdvance::Continue;
    }
    if (step_ >= stepsTotal()) {
        reason_ = RecoveryReason::None;
        return RecoveryAdvance::Success;
    }
    return RecoveryAdvance::Continue;
}
