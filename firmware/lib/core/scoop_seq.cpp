#include "scoop_seq.h"
#include "config.h"

void ScoopSequencer::reset(int downDeg, int carryDeg, int tipDeg, int creepDurationMs) {
    phase = ScoopPhase::Down;
    downDeg_ = downDeg;
    carryDeg_ = carryDeg;
    tipDeg_ = tipDeg;
    targetServoDeg = downDeg;
    phaseStartMs = 0;
    creepEndMs = creepDurationMs;
    started = false;
}

static int rateLimitServo(int current, int target, uint32_t dt_ms) {
    int maxStep = (cfg::SERVO_MAX_DEG_PER_S * (int)dt_ms) / 1000;
    if (maxStep < 1) maxStep = 1;
    if (target > current + maxStep) return current + maxStep;
    if (target < current - maxStep) return current - maxStep;
    return target;
}

bool ScoopSequencer::step(uint32_t now, int& servoDegOut, bool& creepActive) {
    creepActive = false;
    if (!started) {
        started = true;
        phaseStartMs = now;
    }
    uint32_t dt = 20;
    servoDegOut = rateLimitServo(servoDegOut, targetServoDeg, dt);

    switch (phase) {
    case ScoopPhase::Down:
        if (servoDegOut == targetServoDeg) {
            phase = ScoopPhase::Creep;
            phaseStartMs = now;
            creepActive = true;
        }
        break;
    case ScoopPhase::Creep:
        creepActive = true;
        if (now - phaseStartMs >= creepEndMs) {
            phase = ScoopPhase::Tip;
            targetServoDeg = tipDeg_;
        }
        break;
    case ScoopPhase::Tip:
        if (servoDegOut == targetServoDeg) {
            phase = ScoopPhase::Hold;
            phaseStartMs = now;
        }
        break;
    case ScoopPhase::Hold:
        if (now - phaseStartMs >= cfg::TIP_HOLD_MS) {
            phase = ScoopPhase::Carry;
            targetServoDeg = carryDeg_;
        }
        break;
    case ScoopPhase::Carry:
        if (servoDegOut == targetServoDeg) {
            phase = ScoopPhase::Done;
            return true;
        }
        break;
    case ScoopPhase::Done:
        return true;
    }
    return false;
}
