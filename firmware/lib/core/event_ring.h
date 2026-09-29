#pragma once
#include "types.h"

class EventRing {
public:
    explicit EventRing(int capacity);
    void push(EventType type, uint32_t t_ms, int32_t a = 0, int32_t b = 0);
    int since(uint32_t seq, Event* out, int maxOut) const;
    uint32_t lastSeq() const { return seq_; }

private:
    Event* buf_;
    int cap_;
    int head_ = 0;
    int count_ = 0;
    uint32_t seq_ = 0;
};
