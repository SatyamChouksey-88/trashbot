#pragma once
#include <stdint.h>

struct Detection {
    float x, y, w, h, score;
};

struct Detections {
    Detection items[8];
    int count;
    uint32_t t_ms;
};

struct MotorCmd {
    int left;
    int right;
};

enum class Mode : uint8_t { Idle, Manual, Auto };

enum class State : uint8_t {
    IDLE,
    MANUAL,
    SEARCH,
    APPROACH,
    REACQUIRE,
    ALIGN,
    SCOOP,
    TIP,
    VERIFY,
    BACKUP,
    AVOID,
    RECOVERY,
    SAFE_PAUSE,
    DONE,
    ESTOP
};

enum class EventType : uint8_t {
    boot,
    wifi_ready,
    camera_error,
    model_missing,
    mode_changed,
    session_start,
    target_found,
    target_lost,
    obstacle,
    scoop_start,
    item_collected,
    item_failed,
    item_skipped,
    session_done,
    estop,
    estop_reset,
    manual_expired,
    sound_trigger,
    low_battery,
    vision_unavailable,
    calib_saved,
    motor_lease_expired,
    task_timeout,
    stuck_detected,
    recovery_started,
    recovery_success,
    recovery_failed,
    safe_pause,
    invariant_violation
};

struct Event {
    uint32_t seq;
    uint32_t t_ms;
    EventType type;
    int32_t a;
    int32_t b;
};
