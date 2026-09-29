#include <unity.h>
#include "brain.h"
#include "config.h"
#include "recovery.h"

static BrainCalib calib() {
    return {cfg::SCOOP_ZONE_X_MIN, cfg::SCOOP_ZONE_X_MAX, cfg::SCOOP_ZONE_Y_MIN,
            cfg::SERVO_DOWN_DEG, cfg::SERVO_CARRY_DEG, cfg::SERVO_TIP_DEG,
            cfg::TURN_DEG_PER_S_AT_TURN_SPEED, cfg::FWD_CM_PER_S_AT_DRIVE_SPEED,
            cfg::SCOOP_SELF_ECHO_CM, cfg::MOTOR_MAX_DUTY_PCT};
}

void test_recovery_obstacle_ladder(void) {
    RecoveryManager rm;
    rm.resetSession();
    TEST_ASSERT_TRUE(rm.start(RecoveryReason::Obstacle, 1000));
    auto m0 = rm.stepMove(calib());
    TEST_ASSERT_TRUE(m0.duration_ms > 0);
    TEST_ASSERT_EQUAL((int)RecoveryAdvance::Continue, (int)rm.onStepDone(1100));
}

void test_recovery_target_lost_skip(void) {
    RecoveryManager rm;
    rm.resetSession();
    TEST_ASSERT_TRUE(rm.start(RecoveryReason::TargetLost, 0));
    rm.onStepDone(100);
    rm.onStepDone(200);
    TEST_ASSERT_EQUAL((int)RecoveryAdvance::SkipItem, (int)rm.onStepDone(300));
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_recovery_obstacle_ladder);
    RUN_TEST(test_recovery_target_lost_skip);
    return UNITY_END();
}
