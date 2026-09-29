#include "reason_text.h"
#include <cstdio>
#include <cstring>

void eventReasonText(const Event& e, char* out, int out_len) {
    if (!out || out_len < 2) return;
    out[0] = 0;
    if (e.reason[0]) {
        strncpy(out, e.reason, out_len - 1);
        out[out_len - 1] = 0;
        return;
    }
    switch (e.type) {
    case EventType::target_found:
        snprintf(out, out_len, "target score=%ld", (long)e.a);
        break;
    case EventType::obstacle:
        snprintf(out, out_len, "obstacle %ld cm", (long)e.a);
        break;
    case EventType::recovery_started:
        snprintf(out, out_len, "recovery reason=%ld step=%ld", (long)e.a, (long)e.b);
        break;
    case EventType::safe_pause:
        snprintf(out, out_len, "safe_pause trigger=%ld", (long)e.a);
        break;
    case EventType::session_done:
        snprintf(out, out_len, "mission end");
        break;
    default:
        snprintf(out, out_len, "event %d", (int)e.type);
        break;
    }
}
