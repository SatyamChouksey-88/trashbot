#include "shared_state.h"
#include "config.h"
#include <Arduino.h>
#include <cstring>

static SemaphoreHandle_t mtx;
static RobotStatus status;
static EventRing events(cfg::EVENT_RING_SIZE);
static QueueHandle_t cmdQ;
static uint8_t photoBuf[40960];
static size_t photoLen = 0;

void sharedStateBegin() {
    mtx = xSemaphoreCreateMutex();
    cmdQ = xQueueCreate(8, sizeof(RobotCommand));
}

void sharedStateLock() { xSemaphoreTake(mtx, portMAX_DELAY); }
void sharedStateUnlock() { xSemaphoreGive(mtx); }
RobotStatus& sharedStatus() { return status; }
EventRing& sharedEvents() { return events; }
QueueHandle_t commandQueue() { return cmdQ; }

void sharedSetPhoto(const uint8_t* data, size_t len) {
    if (!data || len > sizeof(photoBuf)) return;
    memcpy(photoBuf, data, len);
    photoLen = len;
    status.photo = photoBuf;
    status.photo_len = len;
}
