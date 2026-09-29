#pragma once
#include "brain.h"
#include "event_ring.h"
#include "types.h"
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>

enum class CmdType : uint8_t {
    Stop,
    Estop,
    EstopReset,
    SetMode,
    Drive,
    Move,
    Turn,
    Scoop,
    Clean,
    Start
};

struct RobotCommand {
    CmdType type;
    Mode mode = Mode::Idle;
    int left = 0, right = 0;
    uint32_t duration_ms = 300;
    int move_cm = 0, move_speed = 45;
    int turn_deg = 0, turn_speed = 45;
    char scoop_action[8]{};
    int max_items = 10, max_time_s = 300;
    char label[32]{};
};

struct RobotStatus {
    char fw[16] = "0.1.0";
    Mode mode = Mode::Idle;
    State state = State::IDLE;
    SessionInfo session{};
    int distance_cm = 400;
    Detections detections{};
    uint32_t detections_age_ms = 0;
    uint32_t vision_ms = 0;
    char detector[16] = "fake";
    bool model_loaded = false;
    char camera[16] = "error";
    int scoop_deg = 100;
    int servo_down_calib = 20;
    bool estop = false;
    char last_error[64]{};
    char session_label[32]{};
    float battery_v = -1.0f;
    float motion_score = 0;
    uint32_t heartbeat_vision_ms = 0;
    uint32_t heartbeat_web_ms = 0;
    uint32_t heartbeat_sound_ms = 0;
    uint32_t heartbeat_control_ms = 0;
    bool health_critical = false;
    char health_overall[12] = "OK";
    bool use_fake_detector = true;
    uint8_t* photo = nullptr;
    size_t photo_len = 0;
};

void sharedStateBegin();
void sharedStateLock();
void sharedStateUnlock();
RobotStatus& sharedStatus();
EventRing& sharedEvents();
QueueHandle_t commandQueue();
void sharedSetPhoto(const uint8_t* data, size_t len);
