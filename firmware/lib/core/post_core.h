#pragma once
#include <stdint.h>

struct PostInputs {
    bool psram_ok = false;
    bool nvs_ok = false;
    bool camera_ok = false;
    bool detector_ok = false;
    int ultrasonic_valid_samples = 0;
    bool ultrasonic_no_echo_declared = false;
    bool servo_ok = true;
    bool wifi_ok = false;
};

struct PostResult {
    bool ok = false;
    bool psram_ok = false;
    bool nvs_ok = false;
    bool camera_ok = false;
    bool detector_ok = false;
    bool ultrasonic_ok = false;
    bool servo_ok = false;
    bool wifi_ok = false;
};

PostResult evaluatePost(const PostInputs& in);
