#include "battery.h"
#include "bringup.h"
#include "bumper.h"
#include "post_report.h"
#include "brain.h"
#include "calib.h"
#include "camera.h"
#include "config.h"
#include "detector.h"
#include "detector_fake.h"
#include "event_ring.h"
#include "http_api.h"
#include "motors.h"
#include "safety_logic.h"
#include "servo.h"
#include "shared_state.h"
#include "sound_trigger.h"
#include "status_led.h"
#include "ultrasonic.h"
#include "wifi_setup.h"
#include "invariant_monitor.h"
#include "mission_core.h"
#include "mission_store.h"
#include "profile_store.h"
#include "stuck_detect.h"
#include "learning_store.h"
#include "recipe_bandit.h"
#include <WebServer.h>
#include <esp_task_wdt.h>

static WebServer server(cfg::HTTP_PORT);
static Brain brain;
static FakeDetector fakeDetector;
static Detector* activeDetector = &fakeDetector;
static MotorCmd lastMotor{0, 0};
static uint32_t lastDetectionMs = 0;
static StuckState stuckState{};
static bool leaseExpiredReported = false;
static int pending_recipe_ = -1;

static void applyBrainEvents(const BrainOutput& bout, uint32_t now) {
    for (int i = 0; i < bout.event_count; i++) {
        const Event& e = bout.events[i];
        uint32_t t = e.t_ms ? e.t_ms : now;
        const char* rs = e.reason[0] ? e.reason : nullptr;
        sharedEvents().push(e.type, t, e.a, e.b, rs);
        switch (e.type) {
        case EventType::session_start:
            missionOnStart("", bout.session.max_items, "clean", now);
            break;
        case EventType::recovery_started:
            missionOnRecovery();
            break;
        case EventType::session_done:
            missionOnSessionStats(bout.session.collected, bout.session.failed, bout.session.skipped);
            missionOnEnd(terminationFromStrings(rs ? rs : "completed"), now);
            break;
        case EventType::estop:
            missionOnEnd(TerminationReason::Estop, now);
            break;
        case EventType::vision_unavailable:
            missionOnEnd(TerminationReason::VisionUnavailable, now);
            break;
        case EventType::scoop_start:
            if (cfg::LEARNING_ENABLED) {
                int idx = banditSelectRecipe(learningBandit(), now, cfg::BANDIT_EXPLORE);
                learningSetActiveRecipe(idx);
                pending_recipe_ = idx;
            }
            break;
        case EventType::item_collected:
            if (cfg::LEARNING_ENABLED && pending_recipe_ >= 0) {
                banditRecordOutcome(learningBandit(), pending_recipe_, true);
                sharedEvents().push(EventType::learning_update, now, pending_recipe_, 1, "success");
                pending_recipe_ = -1;
            }
            break;
        case EventType::item_failed:
            if (cfg::LEARNING_ENABLED && pending_recipe_ >= 0) {
                banditRecordOutcome(learningBandit(), pending_recipe_, false);
                sharedEvents().push(EventType::learning_update, now, pending_recipe_, 0, "fail");
                pending_recipe_ = -1;
            }
            break;
        default:
            break;
        }
        if (bout.session.active)
            missionOnSessionStats(bout.session.collected, bout.session.failed, bout.session.skipped);
    }
}

static BrainCommands commandToBrain(const RobotCommand& cmd) {
    BrainCommands bc{};
    switch (cmd.type) {
    case CmdType::Stop:
        bc.stop = true;
        break;
    case CmdType::Estop:
        bc.estop = true;
        break;
    case CmdType::EstopReset:
        bc.estop_reset = true;
        break;
    case CmdType::SetMode:
        bc.set_mode = true;
        bc.mode_target = cmd.mode;
        break;
    case CmdType::Drive:
        bc.set_mode = true;
        bc.mode_target = Mode::Manual;
        bc.manual_drive = true;
        bc.manual_left = cmd.left;
        bc.manual_right = cmd.right;
        bc.manual_duration_ms = cmd.duration_ms;
        break;
    case CmdType::Move:
        bc.set_mode = true;
        bc.mode_target = Mode::Manual;
        bc.move_cmd = true;
        bc.move_cm = cmd.move_cm;
        bc.move_speed = cmd.move_speed;
        break;
    case CmdType::Turn:
        bc.set_mode = true;
        bc.mode_target = Mode::Manual;
        bc.turn_cmd = true;
        bc.turn_deg = cmd.turn_deg;
        bc.turn_speed = cmd.turn_speed;
        break;
    case CmdType::Scoop:
        bc.scoop_cmd = true;
        bc.scoop_action = cmd.scoop_action;
        break;
    case CmdType::Clean:
        bc.start = true;
        bc.start_max_items = cmd.max_items;
        bc.start_max_time_s = cmd.max_time_s;
        bc.start_label = cmd.label;
        break;
    default:
        break;
    }
    return bc;
}

static void controlTask(void*) {
    esp_task_wdt_add(nullptr);
    TickType_t last = xTaskGetTickCount();
    for (;;) {
        esp_task_wdt_reset();
        vTaskDelayUntil(&last, pdMS_TO_TICKS(20));
        uint32_t now = millis();
        motorsRenewLease();
        ultrasonicTrigger();
        int dist = ultrasonicReadCm();
        if (bumperPressed()) dist = 0;

        BrainCommands merged{};
        RobotCommand cmd{};
        while (xQueueReceive(commandQueue(), &cmd, 0) == pdTRUE) {
            BrainCommands bc = commandToBrain(cmd);
            if (bc.stop) {
                merged.stop = true;
                sharedStateLock();
                bool active = sharedStatus().session.active;
                sharedStateUnlock();
                if (active) missionOnEnd(TerminationReason::Stopped, millis());
            }
            if (bc.estop) merged.estop = true;
            if (bc.estop_reset) merged.estop_reset = true;
            if (bc.set_mode) {
                merged.set_mode = true;
                merged.mode_target = bc.mode_target;
            }
            if (bc.manual_drive) {
                merged.manual_drive = true;
                merged.manual_left = bc.manual_left;
                merged.manual_right = bc.manual_right;
                merged.manual_duration_ms = bc.manual_duration_ms;
            }
            if (bc.move_cmd) {
                merged.move_cmd = true;
                merged.move_cm = bc.move_cm;
                merged.move_speed = bc.move_speed;
            }
            if (bc.turn_cmd) {
                merged.turn_cmd = true;
                merged.turn_deg = bc.turn_deg;
                merged.turn_speed = bc.turn_speed;
            }
            if (bc.scoop_cmd) {
                merged.scoop_cmd = true;
                merged.scoop_action = bc.scoop_action;
            }
            if (bc.start) {
                merged.start = true;
                merged.start_max_items = bc.start_max_items;
                merged.start_max_time_s = bc.start_max_time_s;
                merged.start_label = bc.start_label;
            }
            if (cmd.type == CmdType::Estop) {
                sharedStateLock();
                sharedStatus().estop = true;
                sharedStateUnlock();
            }
            if (cmd.type == CmdType::EstopReset) {
                sharedStateLock();
                sharedStatus().estop = false;
                sharedStateUnlock();
            }
        }

        sharedStateLock();
        auto& st = sharedStatus();
        st.distance_cm = dist;
        if (lastDetectionMs != 0 && st.detections.t_ms == lastDetectionMs) st.detections_age_ms += 20;
        else {
            st.detections_age_ms = 0;
            lastDetectionMs = st.detections.t_ms;
        }
        if (cfg::BATTERY_MONITOR_ENABLED) st.battery_v = batteryReadVolts();

        BrainInput bin{};
        bin.now_ms = now;
        bin.calib = calibLoad();
        st.servo_down_calib = bin.calib.servo_down;
        bin.distance_cm = dist;
        bin.detections = st.detections;
        bin.detections_age_ms = st.detections_age_ms;
        bin.servo_deg = st.scoop_deg;
        bin.camera_ok = strcmp(st.camera, "error") != 0;
        bin.stuck_detected = stuckDetectTriggered(stuckState, now);
        bin.bumper_hit = bumperPressed();
        bin.motion_score = st.motion_score;
        bin.chip_temp_c = temperatureRead();
        bool vision_hb_ok =
            st.heartbeat_vision_ms != 0 && now - st.heartbeat_vision_ms < cfg::VISION_HEARTBEAT_MS;
        bin.health_critical = st.estop || !motorsLeaseOk() || !vision_hb_ok ||
                              (cfg::BATTERY_MONITOR_ENABLED && st.battery_v > 0 && st.battery_v < cfg::BATTERY_STOP_V);
        st.health_critical = bin.health_critical;
        strncpy(st.health_overall, bin.health_critical ? "CRITICAL" : "OK", sizeof(st.health_overall) - 1);
        bin.commands = merged;
        auto bout = brain.step(bin);
        applyBrainEvents(bout, now);

        SafetyInputs safety{};
        safety.distance_cm = dist;
        safety.scoopDown = bout.servo_deg <= bin.calib.servo_down + 5;
        safety.estop = st.estop;
        safety.lowBattery = cfg::BATTERY_MONITOR_ENABLED && st.battery_v > 0 && st.battery_v < cfg::BATTERY_STOP_V;
        safety.obstacleStopCm = cfg::OBSTACLE_STOP_CM;
        safety.scoopSelfEchoCm = bin.calib.self_echo_cm;
        safety.maxDutyPct = bin.calib.max_duty;
        safety.rampPctPerS = cfg::MOTOR_RAMP_PCT_PER_S;
        safety.dt_ms = 20;
        safety.bumperPressed = bumperPressed();
        MotorCmd filtered = filterMotor(bout.motor, lastMotor, safety);
        stuckDetectUpdate(stuckState, now, filtered.left, filtered.right, st.motion_score, dist, dist < cfg::US_NO_ECHO_CM);
        InvariantInputs inv{};
        inv.requested = bout.motor;
        inv.filtered = filtered;
        inv.estop = st.estop;
        inv.distance_cm = dist;
        inv.obstacle_stop_cm = cfg::OBSTACLE_STOP_CM;
        inv.max_duty_pct = bin.calib.max_duty;
        inv.state = bout.state;
        inv.manual_expired = bout.state != State::MANUAL;
        InvariantId trip = checkInvariants(inv);
        if (trip != InvariantId::None) {
            filtered = {0, 0};
            st.estop = true;
            sharedEvents().push(EventType::invariant_violation, now, (int)trip);
        }
        lastMotor = filtered;
        motorsApply(filtered, bin.calib.max_duty);
        if (!motorsLeaseOk() && !leaseExpiredReported) {
            sharedEvents().push(EventType::motor_lease_expired, now);
            leaseExpiredReported = true;
        }
        servoWriteDeg(bout.servo_deg);
        st.mode = bout.mode;
        st.state = bout.state;
        st.session = bout.session;
        st.scoop_deg = bout.servo_deg;
        if (merged.start && merged.start_label) {
            strncpy(st.session_label, merged.start_label, sizeof(st.session_label) - 1);
            missionSetLabel(merged.start_label);
        }
        strncpy(st.detector, activeDetector->name(), sizeof(st.detector) - 1);
        st.model_loaded = activeDetector->modelLoaded();
        st.heartbeat_control_ms = now;
        if (st.heartbeat_vision_ms != 0 && now - st.heartbeat_vision_ms > cfg::VISION_HEARTBEAT_MS) {
            sharedEvents().push(EventType::task_timeout, now, 1);
        }
        statusLedSetMode(bout.mode, bout.state);
        sharedStateUnlock();
    }
}

static void visionTask(void*) {
    esp_task_wdt_add(nullptr);
    for (;;) {
        esp_task_wdt_reset();
        Detections d{};
        uint32_t vms = 0;
        if (cameraProcessFrame(*activeDetector, d, vms)) {
            sharedStateLock();
            sharedStatus().detections = d;
            sharedStatus().detections_age_ms = 0;
            sharedStatus().vision_ms = vms;
            sharedStatus().heartbeat_vision_ms = millis();
            lastDetectionMs = d.t_ms;
            sharedStateUnlock();
        }
        vTaskDelay(1);
    }
}

static void webTask(void*) {
    for (;;) {
        httpApiHandle(server);
        sharedStateLock();
        sharedStatus().heartbeat_web_ms = millis();
        sharedStateUnlock();
        vTaskDelay(pdMS_TO_TICKS(2));
    }
}

static void ledTask(void*) {
    for (;;) {
        statusLedTick(millis());
        vTaskDelay(pdMS_TO_TICKS(50));
    }
}

static void soundTask(void*) {
    for (;;) {
        vTaskDelay(pdMS_TO_TICKS(20));
        if (!cfg::SOUND_TRIGGER_ENABLED) continue;
        sharedStateLock();
        bool idle = sharedStatus().mode == Mode::Idle && sharedStatus().state == State::IDLE;
        sharedStateUnlock();
        if (!idle) continue;
        sharedStateLock();
        sharedStatus().heartbeat_sound_ms = millis();
        sharedStateUnlock();
        if (soundTriggerPoll(millis())) {
            RobotCommand c{CmdType::Clean};
            c.max_items = cfg::SESSION_MAX_ITEMS_DEFAULT;
            c.max_time_s = cfg::SESSION_MAX_S_DEFAULT;
            strncpy(c.label, "clap", sizeof(c.label) - 1);
            xQueueSend(commandQueue(), &c, 0);
            sharedEvents().push(EventType::sound_trigger, millis());
        }
    }
}

void setup() {
    Serial.begin(115200);
    sharedStateBegin();
    calibBegin();
    bringupBegin();
    missionStoreBegin();
    profileStoreBegin();
    profileLoadSlot(profileActiveSlot());
    motorsBegin();
    servoBegin();
    ultrasonicBegin();
    bumperInit();
    statusLedBegin();
    soundTriggerBegin();
    fakeDetector.begin();
    char sensor[16] = "error";
    bool camOk = cameraBegin(sensor, sizeof(sensor));
    BringupSettings bu = bringupLoad();
    cameraApplyOrientation(bu.camera_vflip, bu.camera_hmirror);
    sharedStateLock();
    if (camOk) strncpy(sharedStatus().camera, sensor, sizeof(sharedStatus().camera) - 1);
    strncpy(sharedStatus().fw, FW_VERSION, sizeof(sharedStatus().fw) - 1);
    sharedStateUnlock();
    char ip[32];
    wifiSetupBegin(ip, sizeof(ip));
    PostReport post = runBootPost(camOk);
    sharedStateLock();
    sharedStatus().post_ok = post.result.ok;
    sharedStatus().bringup_done = bu.bringup_done;
    sharedStateUnlock();
    Serial.printf("POST %s reset=%s cam=%d us=%d wifi=%d\n", post.result.ok ? "OK" : "FAIL", post.reset_reason,
                  post.result.camera_ok, post.result.ultrasonic_ok, post.result.wifi_ok);
    httpApiBegin(server);
    sharedEvents().push(EventType::boot, millis());
    sharedEvents().push(EventType::wifi_ready, millis());
    if (!camOk) sharedEvents().push(EventType::camera_error, millis());
    xTaskCreatePinnedToCore(controlTask, "control", 8192, nullptr, 3, nullptr, 1);
    xTaskCreatePinnedToCore(visionTask, "vision", 8192, nullptr, 1, nullptr, 1);
    xTaskCreatePinnedToCore(webTask, "web", 8192, nullptr, 1, nullptr, 0);
    xTaskCreatePinnedToCore(ledTask, "led", 2048, nullptr, 1, nullptr, 0);
    xTaskCreatePinnedToCore(soundTask, "sound", 4096, nullptr, 1, nullptr, 0);
}

void loop() { vTaskDelete(NULL); }
