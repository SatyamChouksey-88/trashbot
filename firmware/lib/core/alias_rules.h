#pragma once
#include <stdint.h>

enum class AliasReason : uint8_t {
    Ok = 0,
    PhraseEmpty,
    PhraseTooLong,
    BadIntent,
    BadParam,
    TooManySteps,
};

struct AliasStepParams {
    char direction[8]{};
    char action[8]{};
    int distance_cm = 0;
    int degrees = 0;
    int speed = 0;
    int max_items = 0;
    int max_time_s = 0;
};

struct AliasStep {
    char intent[12]{};
    AliasStepParams params{};
};

struct AliasEntry {
    char phrase[161]{};
    AliasStep steps[3]{};
    int step_count = 0;
};

AliasReason validateAliasEntry(const AliasEntry& e);
const char* aliasReasonToString(AliasReason r);
