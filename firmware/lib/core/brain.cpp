#include "brain.h"
#include "config.h"
#include "motor_math.h"
#include <cmath>
#include <cstring>

void Brain::pushEvent(BrainOutput& out, EventType t, uint32_t now, int32_t a, int32_t b) {
    if (out.event_count >= 4) return;
    out.events[out.event_count++] = {0, now, t, a, b};
}

ScoopZone Brain::zone(const BrainCalib& c) const {
    return {c.zone_xmin, c.zone_xmax, c.zone_ymin};
}

void Brain::reset() {
    state_ = State::IDLE;
    mode_ = Mode::Idle;
    session_ = {};
    has_target_ = false;
    lost_frames_ = 0;
    retries_ = 0;
    search_step_ = 0;
    search_turned_deg_ = 0;
    servo_deg_ = cfg::SERVO_CARRY_DEG;
    timed_.active = false;
    manual_until_ms_ = 0;
    recovery_.resetSession();
    safe_pause_until_ms_ = 0;
    safe_pause_count_ = 0;
}

BrainOutput Brain::step(const BrainInput& in) {
    BrainOutput out{};
    out.state = state_;
    out.mode = mode_;
    out.servo_deg = servo_deg_;
    out.session = session_;

    if (session_.active) {
        out.session.elapsed_s = (int)((in.now_ms - session_start_ms_) / 1000);
    }

    if (in.commands.estop) {
        state_ = State::ESTOP;
        pushEvent(out, EventType::estop, in.now_ms);
    }
    if (state_ == State::ESTOP && in.commands.estop_reset) {
        state_ = State::IDLE;
        pushEvent(out, EventType::estop_reset, in.now_ms);
    }

    if (in.commands.stop) {
        state_ = State::IDLE;
        mode_ = Mode::Idle;
        session_.active = false;
        pushEvent(out, EventType::mode_changed, in.now_ms, (int)mode_);
    }

    if (session_.active && (out.session.elapsed_s >= session_.max_time_s ||
                            session_.collected >= session_.max_items)) {
        state_ = State::DONE;
    }
    if (mode_ == Mode::Auto && !in.camera_ok && state_ != State::ESTOP && state_ != State::SAFE_PAUSE) {
        state_before_pause_ = state_;
        state_ = State::SAFE_PAUSE;
        safe_pause_until_ms_ = in.now_ms + cfg::SAFE_PAUSE_MS;
        safe_pause_count_++;
        pushEvent(out, EventType::safe_pause, in.now_ms, 1);
        if (safe_pause_count_ > cfg::SAFE_PAUSE_MAX) {
            state_ = State::DONE;
            pushEvent(out, EventType::vision_unavailable, in.now_ms);
        }
    }
    if (in.health_critical && state_ != State::ESTOP && state_ != State::SAFE_PAUSE) {
        state_before_pause_ = state_;
        state_ = State::SAFE_PAUSE;
        safe_pause_until_ms_ = in.now_ms + cfg::SAFE_PAUSE_MS;
        pushEvent(out, EventType::safe_pause, in.now_ms, 2);
    }
    if (in.chip_temp_c > cfg::OVERTEMP_C && state_ != State::ESTOP) {
        state_before_pause_ = state_;
        state_ = State::SAFE_PAUSE;
        safe_pause_until_ms_ = in.now_ms + cfg::SAFE_PAUSE_MS;
        pushEvent(out, EventType::safe_pause, in.now_ms, 3);
    }
    if (last_distance_ms_ != 0 && in.now_ms - last_distance_ms_ <= 200) {
        int drop = last_distance_cm_ - in.distance_cm;
        if (last_distance_cm_ < 100 && drop > cfg::SUDDEN_DROP_CM && in.distance_cm < 30) {
            state_before_pause_ = state_;
            state_ = State::SAFE_PAUSE;
            safe_pause_until_ms_ = in.now_ms + cfg::SAFE_PAUSE_MS;
            pushEvent(out, EventType::safe_pause, in.now_ms, 4);
        }
    }
    last_distance_cm_ = in.distance_cm;
    last_distance_ms_ = in.now_ms;

    if (in.stuck_detected && mode_ == Mode::Auto && state_ != State::RECOVERY && state_ != State::ESTOP) {
        pushEvent(out, EventType::stuck_detected, in.now_ms);
        if (recovery_.start(RecoveryReason::Stuck, in.now_ms)) {
            pushEvent(out, EventType::recovery_started, in.now_ms, (int)RecoveryReason::Stuck, 0);
            state_ = State::RECOVERY;
            timed_.active = false;
        }
    }
    if (in.bumper_hit && mode_ == Mode::Auto && state_ != State::RECOVERY) {
        if (recovery_.start(RecoveryReason::Bumper, in.now_ms)) {
            pushEvent(out, EventType::recovery_started, in.now_ms, (int)RecoveryReason::Bumper, 0);
            state_ = State::RECOVERY;
            timed_.active = false;
        }
    }
    if (in.motion_score > cfg::MOTION_WHILE_STILL && out.motor.left == 0 && out.motor.right == 0 &&
        (state_ == State::SEARCH || state_ == State::APPROACH)) {
        state_before_pause_ = state_;
        state_ = State::SAFE_PAUSE;
        safe_pause_until_ms_ = in.now_ms + cfg::SAFE_PAUSE_MS;
        pushEvent(out, EventType::safe_pause, in.now_ms, 5);
    }

    Detection det{};
    bool valid = pickTarget(in.detections, cfg::DETECTION_MIN_SCORE, cfg::DETECTION_MAX_AGE_MS,
                            in.now_ms, det);
    if (valid) {
        target_ = det;
        has_target_ = true;
    }

    if (in.commands.set_mode && state_ != State::ESTOP) {
        mode_ = in.commands.mode_target;
        if (mode_ == Mode::Manual) state_ = State::MANUAL;
        if (mode_ == Mode::Idle) state_ = State::IDLE;
        pushEvent(out, EventType::mode_changed, in.now_ms, (int)mode_);
    }

    if (in.commands.start && state_ != State::ESTOP) {
        mode_ = Mode::Auto;
        state_ = State::SEARCH;
        session_.active = true;
        session_.collected = session_.failed = session_.skipped = 0;
        session_.max_items = in.commands.start_max_items;
        session_.max_time_s = in.commands.start_max_time_s;
        session_start_ms_ = in.now_ms;
        search_step_ = 0;
        search_turned_deg_ = 0;
        pushEvent(out, EventType::session_start, in.now_ms, session_.max_items, session_.max_time_s);
    }

    switch (state_) {
    case State::IDLE:
        out.motor = {0, 0};
        servo_deg_ = in.calib.servo_carry;
        if (in.commands.start) break;
        if (in.commands.set_mode && mode_ == Mode::Manual) state_ = State::MANUAL;
        break;

    case State::MANUAL:
        if (in.commands.manual_drive) {
            manual_cmd_ = {in.commands.manual_left, in.commands.manual_right};
            manual_until_ms_ = in.now_ms + in.commands.manual_duration_ms;
        }
        if (in.now_ms < manual_until_ms_) out.motor = manual_cmd_;
        else if (manual_until_ms_ != 0) pushEvent(out, EventType::manual_expired, in.now_ms);
        if (in.commands.move_cmd) {
            timed_ = moveCm(in.commands.move_cm, in.commands.move_speed, in.calib.fwd_cps);
            timedMoveBegin(timed_, in.now_ms);
        }
        if (in.commands.turn_cmd) {
            timed_ = turnDegrees(in.commands.turn_deg, in.commands.turn_speed, in.calib.turn_dps);
            timedMoveBegin(timed_, in.now_ms);
        }
        if (timed_.active && !timedMoveStep(timed_, in.now_ms)) out.motor = timed_.cmd;
        if (in.commands.scoop_cmd) {
            if (strcmp(in.commands.scoop_action, "down") == 0) servo_deg_ = in.calib.servo_down;
            else if (strcmp(in.commands.scoop_action, "tip") == 0) servo_deg_ = in.calib.servo_tip;
            else servo_deg_ = in.calib.servo_carry;
        }
        break;

    case State::SEARCH:
        if (valid) {
            state_ = State::APPROACH;
            pushEvent(out, EventType::target_found, in.now_ms);
            lost_frames_ = 0;
        } else if (in.now_ms >= search_pause_until_) {
            timed_ = turnDegrees(cfg::SEARCH_STEP_DEG, cfg::TURN_SPEED_PCT, in.calib.turn_dps);
            timedMoveBegin(timed_, in.now_ms);
            search_pause_until_ = in.now_ms + cfg::SEARCH_PAUSE_MS + timed_.duration_ms;
            search_turned_deg_ += cfg::SEARCH_STEP_DEG;
            if (search_turned_deg_ >= 360) {
                search_turned_deg_ = 0;
                if (in.distance_cm >= cfg::OBSTACLE_STOP_CM + 5) {
                    timed_ = moveCm(cfg::SEARCH_FORWARD_CM, cfg::DRIVE_SPEED_PCT, in.calib.fwd_cps);
                    timedMoveBegin(timed_, in.now_ms);
                } else if (recovery_.start(RecoveryReason::Obstacle, in.now_ms)) {
                    pushEvent(out, EventType::recovery_started, in.now_ms, (int)RecoveryReason::Obstacle, 0);
                    state_ = State::RECOVERY;
                    timed_.active = false;
                }
            }
        }
        if (timed_.active && !timedMoveStep(timed_, in.now_ms)) out.motor = timed_.cmd;
        break;

    case State::APPROACH: {
        if (in.distance_cm < cfg::OBSTACLE_STOP_CM) {
            obstacle_count_++;
            pushEvent(out, EventType::obstacle, in.now_ms, in.distance_cm);
            if (recovery_.start(RecoveryReason::Obstacle, in.now_ms)) {
                pushEvent(out, EventType::recovery_started, in.now_ms, (int)RecoveryReason::Obstacle, 0);
                state_ = State::RECOVERY;
                timed_.active = false;
            }
            break;
        }
        if (!valid) {
            lost_frames_++;
            if (lost_frames_ > cfg::TARGET_LOST_FRAMES) {
                if (recovery_.start(RecoveryReason::TargetLost, in.now_ms)) {
                    pushEvent(out, EventType::recovery_started, in.now_ms, (int)RecoveryReason::TargetLost, 0);
                    state_ = State::RECOVERY;
                    timed_.active = false;
                }
            }
        } else {
            lost_frames_ = 0;
            auto z = zone(in.calib);
            if (inScoopZone(target_, z)) {
                state_ = State::ALIGN;
                align_stable_ = 0;
            } else {
                int spd = approachSpeed(target_.y, cfg::DRIVE_SPEED_PCT, cfg::CREEP_SPEED_PCT,
                                        cfg::APPROACH_Y_FAST, cfg::APPROACH_Y_SLOW);
                int tr = steer(target_.x, cfg::STEER_KP_PCT, cfg::STEER_DEADBAND);
                out.motor = mixArcade(spd, tr);
            }
        }
        break;
    }

    case State::REACQUIRE:
        if (valid) {
            state_ = State::APPROACH;
        } else if (in.now_ms - reacquire_start_ms_ > cfg::REACQUIRE_MS) {
            state_ = State::SEARCH;
            pushEvent(out, EventType::target_lost, in.now_ms);
        } else {
            timed_ = turnDegrees(reacquire_dir_ * cfg::REACQUIRE_SWEEP_DEG, cfg::TURN_SPEED_PCT, in.calib.turn_dps);
            timedMoveBegin(timed_, in.now_ms);
            if (timed_.active && !timedMoveStep(timed_, in.now_ms)) out.motor = timed_.cmd;
        }
        break;

    case State::ALIGN:
        out.motor = {0, 0};
        if (valid && inScoopZone(target_, zone(in.calib))) {
            if (std::fabs(target_.x - 0.5f) <= cfg::STEER_DEADBAND) align_stable_++;
            else {
                align_stable_ = 0;
                timed_ = turnDegrees(target_.x < 0.5f ? -10 : 10, cfg::TURN_SPEED_PCT, in.calib.turn_dps);
                timedMoveBegin(timed_, in.now_ms);
                if (timed_.active && !timedMoveStep(timed_, in.now_ms)) out.motor = timed_.cmd;
            }
            if (align_stable_ >= cfg::ALIGN_STABLE_FRAMES) {
                state_ = State::SCOOP;
                pushEvent(out, EventType::scoop_start, in.now_ms);
                scoop_.reset(in.calib.servo_down, in.calib.servo_carry, in.calib.servo_tip,
                             (uint32_t)(cfg::SCOOP_CREEP_CM * 1000.0f / in.calib.fwd_cps));
            }
        } else if (valid) {
            state_ = State::APPROACH;
        }
        break;

    case State::SCOOP: {
        bool creep = false;
        if (scoop_.step(in.now_ms, servo_deg_, creep)) state_ = State::TIP;
        if (creep) out.motor = MotorCmd{cfg::CREEP_SPEED_PCT, cfg::CREEP_SPEED_PCT};
        break;
    }

    case State::TIP: {
        int tip = in.calib.servo_tip;
        if (servo_deg_ < tip) servo_deg_ += 2;
        else {
            verify_start_ms_ = in.now_ms;
            state_ = State::VERIFY;
        }
        break;
    }

    case State::VERIFY: {
        out.motor = {0, 0};
        if (in.now_ms - verify_start_ms_ < cfg::VERIFY_WAIT_MS) break;
        bool still = valid && (target_.y >= 0.4f || inScoopZone(target_, zone(in.calib)));
        if (!still) {
            session_.collected++;
            pushEvent(out, EventType::item_collected, in.now_ms);
            retries_ = 0;
            state_ = State::SEARCH;
            if (session_.collected >= session_.max_items) state_ = State::DONE;
        } else {
            retries_++;
            if (retries_ < cfg::MAX_RETRIES) {
                if (recovery_.start(RecoveryReason::ScoopFailed, in.now_ms)) {
                    pushEvent(out, EventType::recovery_started, in.now_ms, (int)RecoveryReason::ScoopFailed, 0);
                    state_ = State::RECOVERY;
                    timed_.active = false;
                }
            }
            else {
                session_.failed++;
                pushEvent(out, EventType::item_failed, in.now_ms);
                timed_ = turnDegrees(cfg::FAIL_TURN_AWAY_DEG, cfg::TURN_SPEED_PCT, in.calib.turn_dps);
                timedMoveBegin(timed_, in.now_ms);
                state_ = State::SEARCH;
                retries_ = 0;
            }
        }
        break;
    }

    case State::RECOVERY:
        runRecoveryStep(out, in);
        break;

    case State::SAFE_PAUSE:
        out.motor = {0, 0};
        servo_deg_ = in.calib.servo_carry;
        if (in.now_ms >= safe_pause_until_ms_) {
            if (in.camera_ok && !in.health_critical && in.chip_temp_c <= cfg::OVERTEMP_C) {
                state_ = state_before_pause_;
                if (state_ == State::SAFE_PAUSE) state_ = State::SEARCH;
            } else if (safe_pause_count_ > cfg::SAFE_PAUSE_MAX) {
                state_ = State::DONE;
                pushEvent(out, EventType::vision_unavailable, in.now_ms);
            }
        }
        break;

    case State::BACKUP:
    case State::AVOID:
        state_ = State::SEARCH;
        break;

    case State::DONE:
        out.motor = {0, 0};
        servo_deg_ = in.calib.servo_carry;
        session_.active = false;
        pushEvent(out, EventType::session_done, in.now_ms, session_.collected, session_.failed);
        state_ = State::IDLE;
        mode_ = Mode::Idle;
        break;

    case State::ESTOP:
        out.motor = {0, 0};
        break;
    }

    out.state = state_;
    out.mode = mode_;
    out.servo_deg = servo_deg_;
    out.session = session_;
    out.recovery_reason = recovery_.reason();
    out.recovery_step = recovery_.step();
    out.recovery_attempt = recovery_.attempt();
    return out;
}

void Brain::runRecoveryStep(BrainOutput& out, const BrainInput& in) {
    if (!recovery_.active()) {
        state_ = State::SEARCH;
        return;
    }
    auto finish = [&](RecoveryAdvance adv) {
        if (adv == RecoveryAdvance::Continue) return;
        if (adv == RecoveryAdvance::Success) {
            pushEvent(out, EventType::recovery_success, in.now_ms);
            state_ = State::SEARCH;
            return;
        }
        if (adv == RecoveryAdvance::SkipItem) {
            session_.skipped++;
            pushEvent(out, EventType::item_skipped, in.now_ms);
            pushEvent(out, EventType::target_lost, in.now_ms);
            pushEvent(out, EventType::recovery_failed, in.now_ms);
            state_ = State::SEARCH;
            return;
        }
        if (adv == RecoveryAdvance::Failed) {
            session_.failed++;
            pushEvent(out, EventType::item_failed, in.now_ms);
            pushEvent(out, EventType::recovery_failed, in.now_ms);
            state_ = State::SEARCH;
            retries_ = 0;
            return;
        }
        pushEvent(out, EventType::recovery_failed, in.now_ms);
        state_ = State::DONE;
    };

    if (!timed_.active) {
        timed_ = recovery_.stepMove(in.calib);
        if (timed_.duration_ms > 0) timedMoveBegin(timed_, in.now_ms);
        else finish(recovery_.onStepDone(in.now_ms));
        return;
    }
    if (!timedMoveStep(timed_, in.now_ms)) {
        out.motor = timed_.cmd;
        return;
    }
    timed_.active = false;
    finish(recovery_.onStepDone(in.now_ms));
}
