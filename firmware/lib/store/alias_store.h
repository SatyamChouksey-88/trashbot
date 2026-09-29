#pragma once
#include <stddef.h>

void aliasStoreBegin();
bool aliasStoreWriteJson(const char* json, size_t len);
bool aliasStoreReadJson(char* out, size_t out_cap, size_t* out_len);
void aliasStoreResetFile();
