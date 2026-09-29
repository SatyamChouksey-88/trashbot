#pragma once
#include <stdbool.h>

struct BringupSettings {
    bool motor_left_invert = false;
    bool motor_right_invert = false;
    bool motor_swap_sides = false;
    bool camera_vflip = false;
    bool camera_hmirror = false;
    bool bringup_done = false;
};

void bringupBegin();
BringupSettings bringupLoad();
bool bringupSave(const BringupSettings& s);
bool bringupSetDone(bool done);
bool calibMinimumPresent();
