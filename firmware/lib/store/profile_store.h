#pragma once
#include "profile_core.h"

void profileStoreBegin();
const char* profileActiveSlot();
bool profileLoadSlot(const char* slot);
bool profileSaveSlot(const char* slot, const ProfileTunables& t);
bool profileSaveActiveToSlot(const char* slot);
ProfileTunables profileReadSlot(const char* slot);
void profileApplyToCalib(const ProfileTunables& t);
