#pragma once
#include <cstddef>
#include <stdint.h>

bool cameraBegin(char* sensorNameOut, int nameLen);
bool cameraCaptureJpeg(uint8_t** buf, size_t* len);
bool cameraProcessFrame(class Detector& det, struct Detections& out, uint32_t& visionMs);
void cameraApplyOrientation(bool vflip, bool hmirror);
