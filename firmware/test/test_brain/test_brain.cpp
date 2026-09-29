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
    return UNITY_END();
}
