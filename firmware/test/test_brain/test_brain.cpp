#include <unity.h>
#include "brain.h"
#include "config.h"

static BrainCalib defaultCalib() {
    return {cfg::SCOOP_ZONE_X_MIN, cfg::SCOOP_ZONE_X_MAX, cfg::SCOOP_ZONE_Y_MIN,
            cfg::SERVO_DOWN_DEG, cfg::SERVO_CARRY_DEG, cfg::SERVO_TIP_DEG,
            cfg::TURN_DEG_PER_S_AT_TURN_SPEED, cfg::FWD_CM_PER_S_AT_DRIVE_SPEED,
            cfg::SCOOP_SELF_ECHO_CM, cfg::MOTOR_MAX_DUTY_PCT};
}

static bool hasEvent(const BrainOutput& o, EventType t) {
    for (int i = 0; i < o.event_count; i++)
        if (o.events[i].type == t) return true;
    return false;
}

static Detections oneDet(float x, float y, float score, uint32_t t) {
    Detections d{};
    d.count = 1;
    d.items[0] = {x, y, 0.1f, 0.1f, score};
    d.t_ms = t;
    return d;
}

void test_estop_idle(void) {
    Brain b;
    b.reset();
    BrainInput in{};
    in.now_ms = 100;
    in.calib = defaultCalib();
    in.commands.estop = true;
    auto o = b.step(in);
    TEST_ASSERT_EQUAL((int)State::ESTOP, (int)o.state);
    in.commands.estop = false;
    in.commands.estop_reset = true;
    o = b.step(in);
    TEST_ASSERT_EQUAL((int)State::IDLE, (int)o.state);
}

void test_stop(void) {
    Brain b;
    b.reset();
    BrainInput in{};
    in.calib = defaultCalib();
    in.now_ms = 1;
    in.commands.start = true;
    b.step(in);
    in.commands = {};
    in.commands.stop = true;
    auto o = b.step(in);
    TEST_ASSERT_EQUAL((int)State::IDLE, (int)o.state);
}

void test_approach_steer_sign(void) {
    Brain b;
    b.reset();
    BrainInput in{};
    in.calib = defaultCalib();
    in.now_ms = 1000;
    in.commands.start = true;
    b.step(in);
    in.commands = {};
    in.detections = oneDet(0.2f, 0.5f, 0.9f, 1000);
    in.detections_age_ms = 0;
    auto o = b.step(in);
    TEST_ASSERT_TRUE(o.motor.left < o.motor.right || o.state == State::APPROACH);
}

void test_obstacle_avoid(void) {
    Brain b;
    b.reset();
    BrainInput in{};
    in.calib = defaultCalib();
    in.now_ms = 100;
    in.commands.start = true;
    b.step(in);
    in.commands = {};
    in.detections = oneDet(0.5f, 0.5f, 0.9f, 100);
    in.detections_age_ms = 0;
    in.distance_cm = 100;
    b.step(in);
    in.distance_cm = 10;
    auto o = b.step(in);
    TEST_ASSERT_TRUE(o.state == State::AVOID || hasEvent(o, EventType::obstacle));
}

void test_session_time_done(void) {
    Brain b;
    b.reset();
    BrainInput in{};
    in.calib = defaultCalib();
    in.now_ms = 0;
    in.commands.start = true;
    in.commands.start_max_time_s = 1;
    in.commands.start_max_items = 99;
    in.now_ms = 0;
    b.step(in);
    in.commands = {};
    in.now_ms = 2000;
    auto o = b.step(in);
    TEST_ASSERT_TRUE(o.state == State::DONE || o.state == State::IDLE || hasEvent(o, EventType::session_done));
}

void test_camera_unavailable(void) {
    Brain b;
    b.reset();
    BrainInput in{};
    in.calib = defaultCalib();
    in.now_ms = 10;
    in.commands.start = true;
    b.step(in);
    in.commands = {};
    in.camera_ok = false;
    in.now_ms = 20;
    auto o = b.step(in);
    TEST_ASSERT_TRUE(hasEvent(o, EventType::vision_unavailable) || o.state == State::DONE);
}

void test_manual_expired(void) {
    Brain b;
    b.reset();
    BrainInput in{};
    in.calib = defaultCalib();
    in.now_ms = 0;
    in.commands.set_mode = true;
    in.commands.mode_target = Mode::Manual;
    b.step(in);
    in.commands = {};
    in.commands.manual_drive = true;
    in.commands.manual_left = 40;
    in.commands.manual_right = 40;
    in.commands.manual_duration_ms = 50;
    b.step(in);
    in.commands = {};
    in.now_ms = 100;
    auto o = b.step(in);
    TEST_ASSERT_TRUE(o.motor.left == 0 && o.motor.right == 0);
    TEST_ASSERT_TRUE(hasEvent(o, EventType::manual_expired));
}

static BrainOutput stepMs(Brain& b, BrainInput& in, uint32_t dt) {
    in.now_ms += dt;
    in.commands = {};
    return b.step(in);
}

static bool runUntilCollected(Brain& b, BrainInput& in, int maxSteps = 800) {
    in.detections = oneDet(0.5f, 0.85f, 0.95f, in.now_ms);
    in.detections_age_ms = 0;
    for (int i = 0; i < maxSteps; i++) {
        auto o = stepMs(b, in, 30);
        if (o.state == State::TIP || o.state == State::VERIFY) {
            in.detections = {};
            in.detections.count = 0;
        } else if (o.state == State::APPROACH || o.state == State::ALIGN || o.state == State::SCOOP) {
            in.detections = oneDet(0.5f, 0.85f, 0.95f, in.now_ms);
        }
        if (hasEvent(o, EventType::item_collected)) return true;
    }
    return false;
}

void test_scoop_cycle_collected(void) {
    Brain b;
    b.reset();
    BrainInput in{};
    in.calib = defaultCalib();
    in.now_ms = 0;
    in.commands.start = true;
    in.commands.start_max_items = 3;
    b.step(in);
    in.commands = {};
    in.distance_cm = 80;
    TEST_ASSERT_TRUE(runUntilCollected(b, in));
}

void test_target_lost_reacquire_search(void) {
    Brain b;
    b.reset();
    BrainInput in{};
    in.calib = defaultCalib();
    in.now_ms = 100;
    in.commands.start = true;
    b.step(in);
    in.commands = {};
    in.detections = oneDet(0.5f, 0.5f, 0.9f, 100);
    in.detections_age_ms = 0;
    in.distance_cm = 80;
    b.step(in);
    in.detections = {};
    in.detections.count = 0;
    bool sawReacquire = false;
    bool sawLost = false;
    for (int i = 0; i < 40; i++) {
        auto o = stepMs(b, in, 50);
        if (o.state == State::REACQUIRE) sawReacquire = true;
        if (hasEvent(o, EventType::target_lost)) sawLost = true;
    }
    in.now_ms += cfg::REACQUIRE_MS + 100;
    auto o = b.step(in);
    TEST_ASSERT_TRUE(sawReacquire || o.state == State::SEARCH);
    TEST_ASSERT_TRUE(sawLost || o.state == State::SEARCH);
}

void test_item_failed_after_retries(void) {
    Brain b;
    b.reset();
    BrainInput in{};
    in.calib = defaultCalib();
    in.now_ms = 5000;
    in.distance_cm = 80;
    in.detections_age_ms = 0;
    b.testForceVerify(in.now_ms, cfg::MAX_RETRIES - 1);
    in.detections = oneDet(0.5f, 0.85f, 0.95f, in.now_ms);
    auto o = b.step(in);
    TEST_ASSERT_TRUE(hasEvent(o, EventType::item_failed) || o.session.failed >= 1);
}

void test_max_items_done(void) {
    Brain b;
    b.reset();
    BrainInput in{};
    in.calib = defaultCalib();
    in.now_ms = 0;
    in.commands.start = true;
    in.commands.start_max_items = 1;
    b.step(in);
    in.commands = {};
    in.distance_cm = 80;
    runUntilCollected(b, in);
    bool done = false;
    for (int i = 0; i < 30; i++) {
        auto o = stepMs(b, in, 50);
        if (o.state == State::DONE || hasEvent(o, EventType::session_done)) done = true;
    }
    TEST_ASSERT_TRUE(done);
}

void test_search_full_rotation_forward(void) {
    Brain b;
    b.reset();
    BrainInput in{};
    in.calib = defaultCalib();
    in.distance_cm = 50;
    in.now_ms = 0;
    in.commands.start = true;
    b.step(in);
    in.commands = {};
    in.detections = {};
    in.detections.count = 0;
    bool forward = false;
    for (int i = 0; i < 100; i++) {
        auto o = stepMs(b, in, 350);
        if (o.motor.left > 0 && o.motor.right > 0) forward = true;
    }
    TEST_ASSERT_TRUE(forward);
}

static void startSearch(Brain& b, BrainInput& in) {
    b.reset();
    in = {};
    in.calib = defaultCalib();
    in.now_ms = 10;
    in.commands.start = true;
    b.step(in);
    in.commands = {};
}

static State stateAfterEstop(Brain& b, BrainInput& in) {
    in.commands.estop = true;
    auto o = b.step(in);
    in.commands = {};
    return o.state;
}

void test_estop_from_active_states(void) {
    Brain b;
    BrainInput in{};
    startSearch(b, in);
    TEST_ASSERT_EQUAL((int)State::ESTOP, (int)stateAfterEstop(b, in));

    startSearch(b, in);
    in.detections = oneDet(0.5f, 0.5f, 0.9f, in.now_ms);
    in.detections_age_ms = 0;
    b.step(in);
    TEST_ASSERT_EQUAL((int)State::ESTOP, (int)stateAfterEstop(b, in));

    b.reset();
    in = {};
    in.calib = defaultCalib();
    in.commands.set_mode = true;
    in.commands.mode_target = Mode::Manual;
    b.step(in);
    TEST_ASSERT_EQUAL((int)State::ESTOP, (int)stateAfterEstop(b, in));
}

void test_stop_from_active_states(void) {
    Brain b;
    BrainInput in{};
    startSearch(b, in);
    in.commands.stop = true;
    auto o = b.step(in);
    TEST_ASSERT_EQUAL((int)State::IDLE, (int)o.state);

    startSearch(b, in);
    in.detections = oneDet(0.5f, 0.5f, 0.9f, in.now_ms);
    b.step(in);
    in.commands.stop = true;
    o = b.step(in);
    TEST_ASSERT_EQUAL((int)State::IDLE, (int)o.state);
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_estop_idle);
    RUN_TEST(test_stop);
    RUN_TEST(test_approach_steer_sign);
    RUN_TEST(test_obstacle_avoid);
    RUN_TEST(test_session_time_done);
    RUN_TEST(test_camera_unavailable);
    RUN_TEST(test_manual_expired);
    RUN_TEST(test_scoop_cycle_collected);
    RUN_TEST(test_target_lost_reacquire_search);
    RUN_TEST(test_item_failed_after_retries);
    RUN_TEST(test_max_items_done);
    RUN_TEST(test_search_full_rotation_forward);
    RUN_TEST(test_estop_from_active_states);
    RUN_TEST(test_stop_from_active_states);
    return UNITY_END();
}
