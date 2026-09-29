#pragma once
#include "config.h"
#include "scoop_seq.h"
#include "target.h"
#include "timed_move.h"
#include "types.h"

struct BrainCalib {
    float zone_xmin, zone_xmax, zone_ymin;
    int servo_down, servo_carry, servo_tip;
    float turn_dps, fwd_cps;
    int self_echo_cm, max_duty;
};

struct BrainCommands {
    bool start = false;
    int start_max_items = 10;
    int start_max_time_s = 300;
    const char* start_label = "";
    bool stop = false;
    bool estop = false;
    bool estop_reset = false;
    bool set_mode = false;
    Mode mode_target = Mode::Idle;
    bool manual_drive = false;
    int manual_left = 0, manual_right = 0;
    uint32_t manual_duration_ms = 300;
    bool move_cmd = false;
    int move_cm = 0, move_speed = 45;
    bool turn_cmd = false;
    int turn_deg = 0, turn_speed = 45;
    bool scoop_cmd = false;
    const char* scoop_action = "";
};

struct BrainInput {
    uint32_t now_ms = 0;
    Detections detections{};
    uint32_t detections_age_ms = 0;
    int distance_cm = 400;
    int servo_deg = 100;
    BrainCommands commands{};
    BrainCalib calib{};
    bool camera_ok = true;
};

struct SessionInfo {
    bool active = false;
    int collected = 0, failed = 0, skipped = 0;
    int max_items = 10;
    int elapsed_s = 0;
    int max_time_s = 300;
};

struct BrainOutput {
    MotorCmd motor{0, 0};
    int servo_deg = 100;
    State state = State::IDLE;
    Mode mode = Mode::Idle;
    Event events[4]{};
    int event_count = 0;
    SessionInfo session{};
};

class Brain {
public:
    void reset();
    BrainOutput step(const BrainInput& in);
#ifdef UNIT_TEST
    /** Seed VERIFY with retries already accumulated (for unit tests). */
    void testForceVerify(uint32_t now_ms, int retries_before) {
        state_ = State::VERIFY;
        verify_start_ms_ = now_ms - cfg::VERIFY_WAIT_MS - 1;
        retries_ = retries_before;
        mode_ = Mode::Auto;
        session_.active = true;
        session_.failed = 0;
    }
#endif

private:
    State state_ = State::IDLE;
    Mode mode_ = Mode::Idle;
    SessionInfo session_{};
    uint32_t session_start_ms_ = 0;
    Detection target_{};
    bool has_target_ = false;
    int lost_frames_ = 0;
    int retries_ = 0;
    int search_step_ = 0;
    int search_turned_deg_ = 0;
    int align_stable_ = 0;
    int obstacle_count_ = 0;
    bool avoid_left_ = true;
    TimedMove timed_{};
    ScoopSequencer scoop_{};
    uint32_t verify_start_ms_ = 0;
    uint32_t reacquire_start_ms_ = 0;
    int reacquire_dir_ = 1;
    uint32_t search_pause_until_ = 0;
    uint32_t manual_until_ms_ = 0;
    MotorCmd manual_cmd_{};
    int servo_deg_ = 100;
    void pushEvent(BrainOutput& out, EventType t, uint32_t now, int32_t a = 0, int32_t b = 0);
    ScoopZone zone(const BrainCalib& c) const;
};
