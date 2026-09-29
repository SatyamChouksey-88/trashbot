#pragma once
#include "post_core.h"
#include <stdint.h>

struct PostReport {
    PostResult result{};
    char reset_reason[16] = "unknown";
    uint32_t finished_ms = 0;
};

PostReport runBootPost(bool camera_ok);
const PostReport* postLastReport();
