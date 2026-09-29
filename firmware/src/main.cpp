#include "battery.h"
#include "brain.h"
#include "calib.h"
#include "camera.h"
#include "config.h"
#include "detector_fake.h"
#include "http_api.h"
#include "motors.h"
#include "safety_logic.h"
#include "servo.h"
#include "shared_state.h"
#include "status_led.h"
#include "ultrasonic.h"
#include "wifi_setup.h"
#include <WebServer.h>
#include <esp_task_wdt.h>

static WebServer server(cfg::HTTP_PORT);
static Brain brain;
static FakeDetector detector;
static MotorCmd lastMotor{0, 0};
static TaskHandle_t webTaskHandle;

static void controlTask(void*) {
    TickType_t last = xTaskGetTickCount();
    for (;;) {
        vTaskDelayUntil(&last, pdMS_TO_TICKS(20));
        uint32_t now = millis();
        ultrasonicTrigger();
        int dist = ultrasonicReadCm();

        RobotCommand cmd{};
        while (xQueueReceive(commandQueue(), &cmd, 0) == pdTRUE) {
            BrainInput in{};
            in.now_ms = now;
            in.calib = calibLoad();
            in.distance_cm = dist;
            switch (cmd.type) {
            case CmdType::Stop:
                in.commands.stop = true;
                break;
            case CmdType::Drive:
                in.commands.set_mode = true;
                in.commands.mode_target = Mode::Manual;
                in.commands.manual_drive = true;
                in.commands.manual_left = cmd.left;
                in.commands.manual_right = cmd.right;
                in.commands.manual_duration_ms = cmd.duration_ms;
                break;
            case CmdType::Clean:
                in.commands.start = true;
                in.commands.start_max_items = cmd.max_items;
                in.commands.start_max_time_s = cmd.max_time_s;
                break;
            default:
                break;
            }
            auto out = brain.step(in);
            (void)out;
        }

        sharedStateLock();
        auto& st = sharedStatus();
        st.distance_cm = dist;
        BrainInput bin{};
        bin.now_ms = now;
        bin.calib = calibLoad();
        bin.distance_cm = dist;
        bin.detections = st.detections;
        bin.detections_age_ms = st.detections_age_ms;
        bin.servo_deg = st.scoop_deg;
        bin.camera_ok = strcmp(st.camera, "error") != 0;
        auto bout = brain.step(bin);

        SafetyInputs safety{};
        safety.distance_cm = dist;
        safety.scoopDown = bout.servo_deg <= bin.calib.servo_down + 5;
        safety.estop = st.estop;
        safety.lowBattery = false;
        safety.obstacleStopCm = cfg::OBSTACLE_STOP_CM;
        safety.scoopSelfEchoCm = bin.calib.self_echo_cm;
        safety.maxDutyPct = bin.calib.max_duty;
        safety.rampPctPerS = cfg::MOTOR_RAMP_PCT_PER_S;
        safety.dt_ms = 20;
        MotorCmd filtered = filterMotor(bout.motor, lastMotor, safety);
        lastMotor = filtered;
        motorsApply(filtered, bin.calib.max_duty);
        servoWriteDeg(bout.servo_deg);
        st.mode = bout.mode;
        st.state = bout.state;
        st.session = bout.session;
        st.scoop_deg = bout.servo_deg;
        statusLedSetMode(bout.mode, bout.state);
        sharedStateUnlock();
    }
}

static void visionTask(void*) {
    for (;;) {
        Detections d{};
        uint32_t vms = 0;
        if (cameraProcessFrame(detector, d, vms)) {
            sharedStateLock();
            sharedStatus().detections = d;
            sharedStatus().detections_age_ms = 0;
            sharedStatus().vision_ms = vms;
            sharedStateUnlock();
        }
        vTaskDelay(1);
    }
}

static void webTask(void*) {
    for (;;) {
        httpApiHandle(server);
        vTaskDelay(pdMS_TO_TICKS(2));
    }
}

static void ledTask(void*) {
    for (;;) {
        statusLedTick(millis());
        vTaskDelay(pdMS_TO_TICKS(50));
    }
}

void setup() {
    Serial.begin(115200);
    sharedStateBegin();
    calibBegin();
    motorsBegin();
    servoBegin();
    ultrasonicBegin();
    statusLedBegin();
    detector.begin();
    char sensor[16] = "error";
    if (cameraBegin(sensor, sizeof(sensor))) {
        sharedStateLock();
        strncpy(sharedStatus().camera, sensor, sizeof(sharedStatus().camera));
        sharedStateUnlock();
    }
    char ip[32];
    wifiSetupBegin(ip, sizeof(ip));
    httpApiBegin(server);
    xTaskCreatePinnedToCore(controlTask, "control", 8192, nullptr, 3, nullptr, 1);
    xTaskCreatePinnedToCore(visionTask, "vision", 8192, nullptr, 1, nullptr, 1);
    xTaskCreatePinnedToCore(webTask, "web", 8192, nullptr, 1, &webTaskHandle, 0);
    xTaskCreatePinnedToCore(ledTask, "led", 2048, nullptr, 1, nullptr, 0);
}

void loop() { vTaskDelete(NULL); }
