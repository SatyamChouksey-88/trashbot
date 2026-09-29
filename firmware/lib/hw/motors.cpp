#include "motors.h"
#include "config.h"
#include "motor_math.h"
#include <Arduino.h>

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

void motorsBegin() {
    pinMode(cfg::PIN_AIN1, OUTPUT);
    pinMode(cfg::PIN_AIN2, OUTPUT);
    pinMode(cfg::PIN_BIN1, OUTPUT);
    pinMode(cfg::PIN_BIN2, OUTPUT);
    ledcSetup(cfg::LEDC_CH_MOTOR_A, cfg::MOTOR_PWM_HZ, cfg::MOTOR_PWM_BITS);
    ledcSetup(cfg::LEDC_CH_MOTOR_B, cfg::MOTOR_PWM_HZ, cfg::MOTOR_PWM_BITS);
    ledcAttachPin(cfg::PIN_PWMA, cfg::LEDC_CH_MOTOR_A);
    ledcAttachPin(cfg::PIN_PWMB, cfg::LEDC_CH_MOTOR_B);
    setSide(cfg::PIN_AIN1, cfg::PIN_AIN2, cfg::PIN_PWMA, cfg::LEDC_CH_MOTOR_A, 0);
    setSide(cfg::PIN_BIN1, cfg::PIN_BIN2, cfg::PIN_PWMB, cfg::LEDC_CH_MOTOR_B, 0);
}

void motorsApply(MotorCmd cmd, int maxDutyPct) {
    int l = cmd.left, r = cmd.right;
    if (cfg::MOTOR_LEFT_INVERT) l = -l;
    if (cfg::MOTOR_RIGHT_INVERT) r = -r;
    cmd = applyCap({l, r}, maxDutyPct);
    setSide(cfg::PIN_AIN1, cfg::PIN_AIN2, cfg::PIN_PWMA, cfg::LEDC_CH_MOTOR_A, cmd.left);
    setSide(cfg::PIN_BIN1, cfg::PIN_BIN2, cfg::PIN_PWMB, cfg::LEDC_CH_MOTOR_B, cmd.right);
}
