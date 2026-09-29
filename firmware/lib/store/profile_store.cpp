#include "profile_store.h"
#include "brain.h"
#include "calib.h"
#include "config.h"
#include <Arduino.h>
#include <Preferences.h>
#include <cstdio>
#include <cstring>

static Preferences prefs;

void profileStoreBegin() { prefs.begin("trashbot", false); }

static String keyFor(const char* slot, const char* field) {
    char buf[32];
    snprintf(buf, sizeof(buf), "p_%s_%s", slot, field);
    return String(buf);
}

static bool validSlot(const char* slot) {
    return slot && (strcmp(slot, "tile") == 0 || strcmp(slot, "carpet") == 0 || strcmp(slot, "custom") == 0);
}

const char* profileActiveSlot() {
    static char slot[12] = "tile";
    String s = prefs.getString("profile_active", "tile");
    strncpy(slot, s.c_str(), sizeof(slot) - 1);
    return slot;
}

ProfileTunables profileReadSlot(const char* slot) {
    ProfileTunables t{};
    if (!validSlot(slot)) return t;
    t.zone_xmin = prefs.getFloat(keyFor(slot, "zxmin").c_str(), cfg::SCOOP_ZONE_X_MIN);
    t.zone_xmax = prefs.getFloat(keyFor(slot, "zxmax").c_str(), cfg::SCOOP_ZONE_X_MAX);
    t.zone_ymin = prefs.getFloat(keyFor(slot, "zymin").c_str(), cfg::SCOOP_ZONE_Y_MIN);
    t.servo_down = prefs.getInt(keyFor(slot, "sd").c_str(), cfg::SERVO_DOWN_DEG);
    t.servo_carry = prefs.getInt(keyFor(slot, "sc").c_str(), cfg::SERVO_CARRY_DEG);
    t.servo_tip = prefs.getInt(keyFor(slot, "st").c_str(), cfg::SERVO_TIP_DEG);
    t.turn_dps = prefs.getFloat(keyFor(slot, "tdps").c_str(), cfg::TURN_DEG_PER_S_AT_TURN_SPEED);
    t.fwd_cps = prefs.getFloat(keyFor(slot, "fcps").c_str(), cfg::FWD_CM_PER_S_AT_DRIVE_SPEED);
    t.self_echo_cm = prefs.getInt(keyFor(slot, "echo").c_str(), cfg::SCOOP_SELF_ECHO_CM);
    t.max_duty = prefs.getInt(keyFor(slot, "duty").c_str(), cfg::MOTOR_MAX_DUTY_PCT);
    t.detection_min_score = prefs.getFloat(keyFor(slot, "dmin").c_str(), cfg::DETECTION_MIN_SCORE);
    t.obstacle_stop_cm = prefs.getInt(keyFor(slot, "obs").c_str(), cfg::OBSTACLE_STOP_CM);
    return profileClamp(t, cfg::OBSTACLE_STOP_CM_MIN, cfg::MOTOR_MAX_DUTY_MAX);
}

bool profileSaveSlot(const char* slot, const ProfileTunables& t) {
    if (!validSlot(slot)) return false;
    ProfileTunables c = profileClamp(t, cfg::OBSTACLE_STOP_CM_MIN, cfg::MOTOR_MAX_DUTY_MAX);
    prefs.putFloat(keyFor(slot, "zxmin").c_str(), c.zone_xmin);
    prefs.putFloat(keyFor(slot, "zxmax").c_str(), c.zone_xmax);
    prefs.putFloat(keyFor(slot, "zymin").c_str(), c.zone_ymin);
    prefs.putInt(keyFor(slot, "sd").c_str(), c.servo_down);
    prefs.putInt(keyFor(slot, "sc").c_str(), c.servo_carry);
    prefs.putInt(keyFor(slot, "st").c_str(), c.servo_tip);
    prefs.putFloat(keyFor(slot, "tdps").c_str(), c.turn_dps);
    prefs.putFloat(keyFor(slot, "fcps").c_str(), c.fwd_cps);
    prefs.putInt(keyFor(slot, "echo").c_str(), c.self_echo_cm);
    prefs.putInt(keyFor(slot, "duty").c_str(), c.max_duty);
    prefs.putFloat(keyFor(slot, "dmin").c_str(), c.detection_min_score);
    prefs.putInt(keyFor(slot, "obs").c_str(), c.obstacle_stop_cm);
    return true;
}

void profileApplyToCalib(const ProfileTunables& t) {
    calibSaveFloat("zone_xmin", t.zone_xmin);
    calibSaveFloat("zone_xmax", t.zone_xmax);
    calibSaveFloat("zone_ymin", t.zone_ymin);
    calibSaveInt("servo_down", t.servo_down);
    calibSaveInt("servo_carry", t.servo_carry);
    calibSaveInt("servo_tip", t.servo_tip);
    calibSaveFloat("turn_dps", t.turn_dps);
    calibSaveFloat("fwd_cps", t.fwd_cps);
    calibSaveInt("self_echo_cm", t.self_echo_cm);
    calibSaveInt("max_duty", t.max_duty);
}

bool profileLoadSlot(const char* slot) {
    if (!validSlot(slot)) return false;
    prefs.putString("profile_active", slot);
    ProfileTunables t = profileReadSlot(slot);
    profileApplyToCalib(t);
    return true;
}

bool profileSaveActiveToSlot(const char* slot) {
    ProfileTunables t = profileReadSlot(profileActiveSlot());
    BrainCalib c = calibLoad();
    t.zone_xmin = c.zone_xmin;
    t.zone_xmax = c.zone_xmax;
    t.zone_ymin = c.zone_ymin;
    t.servo_down = c.servo_down;
    t.servo_carry = c.servo_carry;
    t.servo_tip = c.servo_tip;
    t.turn_dps = c.turn_dps;
    t.fwd_cps = c.fwd_cps;
    t.self_echo_cm = c.self_echo_cm;
    t.max_duty = c.max_duty;
    return profileSaveSlot(slot, t);
}
