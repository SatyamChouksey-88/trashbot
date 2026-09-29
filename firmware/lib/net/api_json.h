#pragma once
#include "shared_state.h"
#include <WebServer.h>

void sendStatusJson(WebServer& server);
const char* stateToString(State s);
const char* eventTypeToString(EventType t);
