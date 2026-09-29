#include "motors.h"
#include "config.h"
#include "motor_math.h"
#include <Arduino.h>
#include <esp_timer.h>

static volatile uint32_t s_lease_ms = 0;
static volatile bool s_lease_expired = false;
static esp_timer_handle_t s_lease_timer = nullptr;

static void setSide(int in1, int in2, int pwmPin, int ch, int pct) {
    pct = clampPct(pct);
    if (pct == 0) {
        digitalWrite(in1, HIGH);
        digitalWrite(in2, HIGH);
        ledcWrite(ch, 0);
        return;
    }
    bool fwd = pct > 0;
    digitalWrite(in1, fwd ? HIGH : LOW);
    digitalWrite(in2, fwd ? LOW : HIGH);
    uint32_t duty = pctToDuty(pct, cfg::MOTOR_PWM_BITS, 100);
    ledcWrite(ch, duty);
}

static void stopMotorsHw() {
    setSide(cfg::PIN_AIN1, cfg::PIN_AIN2, cfg::PIN_PWMA, cfg::LEDC_CH_MOTOR_A, 0);
    setSide(cfg::PIN_BIN1, cfg::PIN_BIN2, cfg::PIN_PWMB, cfg::LEDC_CH_MOTOR_B, 0);
}

static void leaseTimerCb(void*) {
    uint32_t now = millis();
    if (s_lease_ms == 0 || now - s_lease_ms > cfg::MOTOR_LEASE_MS) {
        s_lease_expired = true;
        stopMotorsHw();
    }
}

void motorsBegin() {
    pinMode(cfg::PIN_AIN1, OUTPUT);
    pinMode(cfg::PIN_AIN2, OUTPUT);
    pinMode(cfg::PIN_BIN1, OUTPUT);
    pinMode(cfg::PIN_BIN2, OUTPUT);
    ledcSetup(cfg::LEDC_CH_MOTOR_A, cfg::MOTOR_PWM_HZ, cfg::MOTOR_PWM_BITS);
    ledcSetup(cfg::LEDC_CH_MOTOR_B, cfg::MOTOR_PWM_HZ, cfg::MOTOR_PWM_BITS);
    ledcAttachPin(cfg::PIN_PWMA, cfg::LEDC_CH_MOTOR_A);
    ledcAttachPin(cfg::PIN_PWMB, cfg::LEDC_CH_MOTOR_B);
    stopMotorsHw();
    esp_timer_create_args_t args{};
    args.callback = leaseTimerCb;
    args.name = "motor_lease";
    esp_timer_create(&args, &s_lease_timer);
    esp_timer_start_periodic(s_lease_timer, 50000);
    motorsRenewLease();
}

void motorsRenewLease() {
    s_lease_ms = millis();
    s_lease_expired = false;
}

bool motorsLeaseOk() { return !s_lease_expired; }

void motorsApply(MotorCmd cmd, int maxDutyPct) {
    if (s_lease_expired) {
        stopMotorsHw();
        return;
    }
    int l = cmd.left, r = cmd.right;
    if (cfg::MOTOR_LEFT_INVERT) l = -l;
    if (cfg::MOTOR_RIGHT_INVERT) r = -r;
    cmd = applyCap({l, r}, maxDutyPct);
    setSide(cfg::PIN_AIN1, cfg::PIN_AIN2, cfg::PIN_PWMA, cfg::LEDC_CH_MOTOR_A, cmd.left);
    setSide(cfg::PIN_BIN1, cfg::PIN_BIN2, cfg::PIN_PWMB, cfg::LEDC_CH_MOTOR_B, cmd.right);
}
