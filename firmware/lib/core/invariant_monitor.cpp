#include "invariant_monitor.h"

InvariantId checkInvariants(const InvariantInputs& in) {
    const MotorCmd& m = in.filtered;
    if (in.estop && (m.left != 0 || m.right != 0)) return InvariantId::EstopNonZero;
    auto aabs = [](int v) { return v < 0 ? -v : v; };
    if (aabs(m.left) > in.max_duty_pct || aabs(m.right) > in.max_duty_pct) return InvariantId::MotorOverCap;
    if (in.distance_cm < in.obstacle_stop_cm && (m.left > 0 || m.right > 0)) return InvariantId::ForwardNearObstacle;
    if (in.manual_expired && in.state == State::MANUAL && (m.left != 0 || m.right != 0))
        return InvariantId::ManualExpired;
    if ((in.state == State::IDLE || in.state == State::DONE || in.state == State::ESTOP ||
         in.state == State::SAFE_PAUSE) &&
        (m.left != 0 || m.right != 0))
        return InvariantId::StateRequiresZero;
    return InvariantId::None;
}
