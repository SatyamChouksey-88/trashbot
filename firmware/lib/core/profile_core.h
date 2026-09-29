#pragma once

struct ProfileTunables {
    float zone_xmin = 0.35f;
    float zone_xmax = 0.65f;
    float zone_ymin = 0.80f;
    int servo_down = 20;
    int servo_carry = 100;
    int servo_tip = 165;
    float turn_dps = 120.f;
    float fwd_cps = 25.f;
    int self_echo_cm = 12;
    int max_duty = 70;
    float detection_min_score = 0.60f;
    int obstacle_stop_cm = 15;
};

ProfileTunables profileClamp(const ProfileTunables& in, int obstacle_min_cm, int max_duty_max);
