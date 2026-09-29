#include "alias_rules.h"
#include <cstring>

static bool utf8_no_controls(const char* s, int max_len) {
    if (!s || !s[0]) return false;
    int len = (int)strlen(s);
    if (len > max_len) return false;
    for (int i = 0; i < len; i++) {
        unsigned char c = (unsigned char)s[i];
        if (c < 0x20 && c != '\t') return false;
    }
    return true;
}

static bool intent_ok(const char* intent) {
    static const char* k[] = {"CLEAN", "MOVE", "TURN", "SCOOP", "PHOTO", "STATUS", "HEALTH", "BATTERY", "REPORT",
                              "MISTAKES", "HELP"};
    for (const char* x : k) {
        if (strcmp(intent, x) == 0) return true;
    }
    return false;
}

static AliasReason validate_step(const AliasStep& s) {
    if (!intent_ok(s.intent)) return AliasReason::BadIntent;
    if (strcmp(s.intent, "MOVE") == 0) {
        bool fwd = strcmp(s.params.direction, "forward") == 0;
        bool back = strcmp(s.params.direction, "back") == 0;
        if (!fwd && !back) return AliasReason::BadParam;
        int d = s.params.distance_cm;
        int sp = s.params.speed;
        if (d < 1 || sp < 10 || sp > 80) return AliasReason::BadParam;
        if (fwd && d > 50) return AliasReason::BadParam;
        if (back && d > 20) return AliasReason::BadParam;
        return AliasReason::Ok;
    }
    if (strcmp(s.intent, "TURN") == 0) {
        if (strcmp(s.params.direction, "left") != 0 && strcmp(s.params.direction, "right") != 0)
            return AliasReason::BadParam;
        if (s.params.degrees < 1 || s.params.degrees > 180) return AliasReason::BadParam;
        if (s.params.speed < 10 || s.params.speed > 80) return AliasReason::BadParam;
        return AliasReason::Ok;
    }
    if (strcmp(s.intent, "SCOOP") == 0) {
        if (strcmp(s.params.action, "down") != 0 && strcmp(s.params.action, "carry") != 0 &&
            strcmp(s.params.action, "tip") != 0 && strcmp(s.params.action, "cycle") != 0)
            return AliasReason::BadParam;
        return AliasReason::Ok;
    }
    if (strcmp(s.intent, "CLEAN") == 0) {
        if (s.params.max_items < 1 || s.params.max_items > 20) return AliasReason::BadParam;
        if (s.params.max_time_s < 10 || s.params.max_time_s > 600) return AliasReason::BadParam;
        return AliasReason::Ok;
    }
    return AliasReason::Ok;
}

AliasReason validateAliasEntry(const AliasEntry& e) {
    if (!utf8_no_controls(e.phrase, 160)) return AliasReason::PhraseEmpty;
    if (e.step_count < 1 || e.step_count > 3) return AliasReason::TooManySteps;
    for (int i = 0; i < e.step_count; i++) {
        AliasReason r = validate_step(e.steps[i]);
        if (r != AliasReason::Ok) return r;
    }
    return AliasReason::Ok;
}

const char* aliasReasonToString(AliasReason r) {
    switch (r) {
    case AliasReason::Ok: return "ok";
    case AliasReason::PhraseEmpty: return "phrase_empty";
    case AliasReason::PhraseTooLong: return "phrase_too_long";
    case AliasReason::BadIntent: return "bad_intent";
    case AliasReason::BadParam: return "bad_param";
    case AliasReason::TooManySteps: return "too_many_steps";
    }
    return "bad_param";
}
