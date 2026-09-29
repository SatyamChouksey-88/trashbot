#include "servo.h"
#include "config.h"
#include <Arduino.h>

static int degToUs(int deg) {
    if (deg < cfg::SERVO_MIN_DEG) deg = cfg::SERVO_MIN_DEG;
    if (deg > cfg::SERVO_MAX_DEG) deg = cfg::SERVO_MAX_DEG;
    return cfg::SERVO_MIN_US + (deg - cfg::SERVO_MIN_DEG) * (cfg::SERVO_MAX_US - cfg::SERVO_MIN_US) /
                                 (cfg::SERVO_MAX_DEG - cfg::SERVO_MIN_DEG);
}

void servoBegin() {
    ledcSetup(cfg::LEDC_CH_SERVO, cfg::SERVO_PWM_HZ, cfg::SERVO_PWM_BITS);
    ledcAttachPin(cfg::PIN_SERVO, cfg::LEDC_CH_SERVO);
}

void servoWriteDeg(int deg) {
    int us = degToUs(deg);
    uint32_t maxDuty = (1u << cfg::SERVO_PWM_BITS) - 1;
    uint32_t duty = (uint32_t)us * maxDuty / 20000u;
    ledcWrite(cfg::LEDC_CH_SERVO, duty);
}
