#pragma once
#include "health_core.h"
#include "shared_state.h"
#include <WebServer.h>

void sendStatusJson(WebServer& server);
void sendHealthJson(WebServer& server);
HealthInputs buildHealthInputs();
const char* stateToString(State s);
const char* eventTypeToString(EventType t);
