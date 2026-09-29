#pragma once
#include <WebServer.h>

void registerAliasesRoutes(WebServer& server, bool (*checkToken)(WebServer&));
