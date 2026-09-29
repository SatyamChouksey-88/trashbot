#include "post_core.h"

PostResult evaluatePost(const PostInputs& in) {
    PostResult r{};
    r.psram_ok = in.psram_ok;
    r.nvs_ok = in.nvs_ok;
    r.camera_ok = in.camera_ok;
    r.detector_ok = in.detector_ok;
    r.ultrasonic_ok = in.ultrasonic_valid_samples >= 3 || in.ultrasonic_no_echo_declared;
    r.servo_ok = in.servo_ok;
    r.wifi_ok = in.wifi_ok;
    r.ok = r.psram_ok && r.nvs_ok && r.camera_ok && r.detector_ok && r.ultrasonic_ok && r.servo_ok && r.wifi_ok;
    return r;
}
