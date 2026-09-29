#include "event_ring.h"

EventRing::EventRing(int capacity) : cap_(capacity) {
    buf_ = new Event[cap_];
}

void EventRing::push(EventType type, uint32_t t_ms, int32_t a, int32_t b) {
    seq_++;
    Event e{seq_, t_ms, type, a, b};
    buf_[head_] = e;
    head_ = (head_ + 1) % cap_;
    if (count_ < cap_) count_++;
}

int EventRing::since(uint32_t seq, Event* out, int maxOut) const {
    int n = 0;
    for (int i = 0; i < count_ && n < maxOut; i++) {
        int idx = (head_ - count_ + i + cap_) % cap_;
        if (buf_[idx].seq > seq) out[n++] = buf_[idx];
    }
    return n;
}
