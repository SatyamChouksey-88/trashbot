#include <unity.h>
#include "brain.h"
#include "config.h"

static BrainCalib defaultCalib() {
    return {cfg::SCOOP_ZONE_X_MIN, cfg::SCOOP_ZONE_X_MAX, cfg::SCOOP_ZONE_Y_MIN,
            cfg::SERVO_DOWN_DEG, cfg::SERVO_CARRY_DEG, cfg::SERVO_TIP_DEG,
            cfg::TURN_DEG_PER_S_AT_TURN_SPEED, cfg::FWD_CM_PER_S_AT_DRIVE_SPEED,
            cfg::SCOOP_SELF_ECHO_CM, cfg::MOTOR_MAX_DUTY_PCT};
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
    in.commands.start = true;
    b.step(in);
    in.commands.start = false;
    in.commands.stop = true;
    auto o = b.step(in);
    TEST_ASSERT_EQUAL((int)State::IDLE, (int)o.state);
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_estop_idle);
    RUN_TEST(test_stop);
    return UNITY_END();
}
