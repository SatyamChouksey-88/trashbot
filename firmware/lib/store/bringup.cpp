#include "bringup.h"
#include "config.h"
#include <Arduino.h>
#include <Preferences.h>

static Preferences prefs;

void bringupBegin() { prefs.begin("trashbot", false); }

BringupSettings bringupLoad() {
    BringupSettings s{};
    s.motor_left_invert = prefs.getBool("motor_left_inv", cfg::MOTOR_LEFT_INVERT);
    s.motor_right_invert = prefs.getBool("motor_right_inv", cfg::MOTOR_RIGHT_INVERT);
    s.motor_swap_sides = prefs.getBool("motor_swap", false);
    s.camera_vflip = prefs.getBool("cam_vflip", cfg::CAMERA_VFLIP);
    s.camera_hmirror = prefs.getBool("cam_hmirror", cfg::CAMERA_HMIRROR);
    s.bringup_done = prefs.getBool("bringup_done", false);
    return s;
}

bool bringupSave(const BringupSettings& s) {
    prefs.putBool("motor_left_inv", s.motor_left_invert);
    prefs.putBool("motor_right_inv", s.motor_right_invert);
    prefs.putBool("motor_swap", s.motor_swap_sides);
    prefs.putBool("cam_vflip", s.camera_vflip);
    prefs.putBool("cam_hmirror", s.camera_hmirror);
    prefs.putBool("bringup_done", s.bringup_done);
    return true;
}

bool bringupSetDone(bool done) {
    prefs.putBool("bringup_done", done);
    return true;
}

bool calibMinimumPresent() {
    return prefs.isKey("zone_xmin") && prefs.isKey("servo_down") && prefs.isKey("servo_carry");
}
