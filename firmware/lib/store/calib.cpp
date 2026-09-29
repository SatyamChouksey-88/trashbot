#include "calib.h"
#include "config.h"
#include <Arduino.h>
#include <Preferences.h>

static Preferences prefs;
static SemaphoreHandle_t mtx;

void calibBegin() {
    mtx = xSemaphoreCreateMutex();
    prefs.begin("trashbot", false);
}

BrainCalib calibLoad() {
    BrainCalib c{cfg::SCOOP_ZONE_X_MIN, cfg::SCOOP_ZONE_X_MAX, cfg::SCOOP_ZONE_Y_MIN,
                 cfg::SERVO_DOWN_DEG, cfg::SERVO_CARRY_DEG, cfg::SERVO_TIP_DEG,
                 cfg::TURN_DEG_PER_S_AT_TURN_SPEED, cfg::FWD_CM_PER_S_AT_DRIVE_SPEED,
                 cfg::SCOOP_SELF_ECHO_CM, cfg::MOTOR_MAX_DUTY_PCT};
    if (prefs.isKey("zone_xmin")) c.zone_xmin = prefs.getFloat("zone_xmin", c.zone_xmin);
    if (prefs.isKey("zone_xmax")) c.zone_xmax = prefs.getFloat("zone_xmax", c.zone_xmax);
    if (prefs.isKey("zone_ymin")) c.zone_ymin = prefs.getFloat("zone_ymin", c.zone_ymin);
    if (prefs.isKey("servo_down")) c.servo_down = prefs.getInt("servo_down", c.servo_down);
    if (prefs.isKey("servo_carry")) c.servo_carry = prefs.getInt("servo_carry", c.servo_carry);
    if (prefs.isKey("servo_tip")) c.servo_tip = prefs.getInt("servo_tip", c.servo_tip);
    if (prefs.isKey("turn_dps")) c.turn_dps = prefs.getFloat("turn_dps", c.turn_dps);
    if (prefs.isKey("fwd_cps")) c.fwd_cps = prefs.getFloat("fwd_cps", c.fwd_cps);
    if (prefs.isKey("self_echo_cm")) c.self_echo_cm = prefs.getInt("self_echo_cm", c.self_echo_cm);
    if (prefs.isKey("max_duty")) c.max_duty = prefs.getInt("max_duty", c.max_duty);
    return c;
}

bool calibSaveKey(const char* key, float value) {
    xSemaphoreTake(mtx, portMAX_DELAY);
    prefs.putFloat(key, value);
    xSemaphoreGive(mtx);
    return true;
}
