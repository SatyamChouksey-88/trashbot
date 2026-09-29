#pragma once
#include <stdint.h>
// Single source of truth. All values are defaults; calibration in NVS overrides the marked ones.
namespace cfg {
// Pins (Section 3.2)
constexpr int PIN_PWMA = 1, PIN_AIN1 = 2, PIN_AIN2 = 4;
constexpr int PIN_PWMB = 5, PIN_BIN1 = 6, PIN_BIN2 = 7;
constexpr int PIN_SERVO = 8, PIN_US_TRIG = 9, PIN_US_ECHO = 44;
constexpr int PIN_BATTERY_ADC = 3, PIN_STATUS_LED = 21;
constexpr int PIN_BUMPER = 6; // GPIO43 — boot log pin; use 1 kΩ series to GND if wired
// LEDC
constexpr int LEDC_CH_MOTOR_A = 0, LEDC_CH_MOTOR_B = 1, LEDC_CH_SERVO = 2; // camera uses ch7 + timer 3
constexpr uint32_t MOTOR_PWM_HZ = 20000; constexpr uint8_t MOTOR_PWM_BITS = 10;
constexpr uint32_t SERVO_PWM_HZ = 50;    constexpr uint8_t SERVO_PWM_BITS = 14;
// Motors
constexpr int  MOTOR_MAX_DUTY_PCT = 70;        // [calib] TT motors ~6 V on an 8.4 V pack
constexpr int  MOTOR_RAMP_PCT_PER_S = 250;
constexpr bool MOTOR_LEFT_INVERT = false, MOTOR_RIGHT_INVERT = false;
constexpr int  DRIVE_SPEED_PCT = 45, TURN_SPEED_PCT = 45, CREEP_SPEED_PCT = 30;
// Manual control (dead-man)
constexpr uint32_t MANUAL_CMD_DEFAULT_MS = 300, MANUAL_CMD_MAX_MS = 1000;
// Servo / scoop
constexpr int SERVO_MIN_US = 500, SERVO_MAX_US = 2500;
constexpr int SERVO_MIN_DEG = 5, SERVO_MAX_DEG = 175;
constexpr int SERVO_DOWN_DEG = 20, SERVO_CARRY_DEG = 100, SERVO_TIP_DEG = 165;   // [calib]
constexpr int SERVO_MAX_DEG_PER_S = 120;
constexpr uint32_t TIP_HOLD_MS = 600;
// Ultrasonic and safety
constexpr uint32_t US_PERIOD_MS = 66, US_TIMEOUT_US = 25000;
constexpr int US_NO_ECHO_CM = 400;
constexpr int OBSTACLE_STOP_CM = 15;
constexpr int SCOOP_SELF_ECHO_CM = 12;          // [calib] readings <= this + 3 are ignored while scoop is DOWN
constexpr uint32_t SESSION_MAX_S_DEFAULT = 300;
constexpr int SESSION_MAX_ITEMS_DEFAULT = 10;
// Vision
constexpr float DETECTION_MIN_SCORE = 0.60f;
constexpr uint32_t DETECTION_MAX_AGE_MS = 600;
constexpr int TARGET_LOST_FRAMES = 5;
constexpr float SCOOP_ZONE_X_MIN = 0.35f, SCOOP_ZONE_X_MAX = 0.65f, SCOOP_ZONE_Y_MIN = 0.80f; // [calib]
constexpr int ALIGN_STABLE_FRAMES = 3;
constexpr float STEER_KP_PCT = 90.0f;           // turn % per unit of x offset from 0.5
constexpr float STEER_DEADBAND = 0.06f;
constexpr float APPROACH_Y_FAST = 0.30f, APPROACH_Y_SLOW = 0.80f; // speed ramps DRIVE → CREEP between these
// Search and recovery
constexpr int SEARCH_STEP_DEG = 30; constexpr uint32_t SEARCH_PAUSE_MS = 300;
constexpr int SEARCH_FORWARD_CM = 45, AVOID_TURN_DEG = 90;
constexpr int REACQUIRE_SWEEP_DEG = 20; constexpr uint32_t REACQUIRE_MS = 1500;
constexpr int FAIL_TURN_AWAY_DEG = 45;
// Scoop routine
constexpr int SCOOP_CREEP_CM = 12, RETRY_BACKUP_CM = 10, MAX_RETRIES = 3;
constexpr uint32_t VERIFY_WAIT_MS = 500;
// Open-loop motion estimates [calib]
constexpr float TURN_DEG_PER_S_AT_TURN_SPEED = 120.0f;
constexpr float FWD_CM_PER_S_AT_DRIVE_SPEED = 25.0f;
// Camera and model
constexpr bool CAMERA_VFLIP = false, CAMERA_HMIRROR = false;
constexpr int CAMERA_JPEG_QUALITY = 12;         // QVGA 320x240 capture
constexpr int CROP_PX = 240, MODEL_INPUT_PX = 96; // centre crop 240x240 -> 96x96
// Network
constexpr const char* AP_SSID_PREFIX = "TrashBot-";
constexpr const char* AP_PASSWORD = "trashbot123";
constexpr const char* MDNS_NAME = "trashbot";
constexpr uint32_t STA_CONNECT_TIMEOUT_MS = 15000;
constexpr int HTTP_PORT = 80;
// Clap to start
constexpr bool SOUND_TRIGGER_ENABLED = true;
constexpr int SOUND_TRIGGER_LEVEL = 12000;      // peak |sample| in a 20 ms window
constexpr uint32_t SOUND_TRIGGER_COOLDOWN_MS = 3000;
// Front bumper microswitch (optional)
constexpr bool BUMPER_ENABLED = false;
// Battery (optional)
constexpr bool BATTERY_MONITOR_ENABLED = false;
constexpr float BATTERY_DIVIDER_RATIO = (100.0f + 33.0f) / 33.0f;
constexpr float BATTERY_STOP_V = 6.6f;
// Logging
constexpr int EVENT_RING_SIZE = 256;
} // namespace cfg

#define TRASHBOT_EI_HEADER <TrashBot_inferencing.h>
