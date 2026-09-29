#include "camera.h"
#include "config.h"
#include "detector.h"
#include "image_ops.h"
#include "shared_state.h"
#include "types.h"
#include <esp_camera.h>
#include <img_converters.h>
#include <Arduino.h>
#include <cstring>

static bool ok = false;

bool cameraBegin(char* sensorNameOut, int nameLen) {
    camera_config_t config{};
    config.ledc_channel = LEDC_CHANNEL_7;
    config.ledc_timer = LEDC_TIMER_3;
    config.pin_d0 = 15;
    config.pin_d1 = 17;
    config.pin_d2 = 18;
    config.pin_d3 = 16;
    config.pin_d4 = 14;
    config.pin_d5 = 12;
    config.pin_d6 = 11;
    config.pin_d7 = 48;
    config.pin_xclk = 10;
    config.pin_pclk = 13;
    config.pin_vsync = 38;
    config.pin_href = 47;
    config.pin_sscb_sda = 40;
    config.pin_sscb_scl = 39;
    config.pin_pwdn = -1;
    config.pin_reset = -1;
    config.xclk_freq_hz = 20000000;
    config.pixel_format = PIXFORMAT_JPEG;
    config.frame_size = FRAMESIZE_QVGA;
    config.jpeg_quality = cfg::CAMERA_JPEG_QUALITY;
    config.fb_count = 2;
    config.fb_location = CAMERA_FB_IN_PSRAM;
    config.grab_mode = CAMERA_GRAB_LATEST;
    if (esp_camera_init(&config) != ESP_OK) return false;
    sensor_t* s = esp_camera_sensor_get();
    if (s) {
        s->set_vflip(s, cfg::CAMERA_VFLIP ? 1 : 0);
        s->set_hmirror(s, cfg::CAMERA_HMIRROR ? 1 : 0);
        if (sensorNameOut && nameLen > 0) {
            strncpy(sensorNameOut, s->id.PID == OV3660_PID ? "OV3660" : "OV2640", nameLen - 1);
            sensorNameOut[nameLen - 1] = 0;
        }
    }
    ok = true;
    return true;
}

void cameraApplyOrientation(bool vflip, bool hmirror) {
    sensor_t* s = esp_camera_sensor_get();
    if (s) {
        s->set_vflip(s, vflip ? 1 : 0);
        s->set_hmirror(s, hmirror ? 1 : 0);
    }
}

bool cameraCaptureJpeg(uint8_t** buf, size_t* len) {
    if (!ok) return false;
    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) return false;
    *buf = fb->buf;
    *len = fb->len;
    return true;
}

void cameraReturnFb() { esp_camera_fb_return(nullptr); }

bool cameraProcessFrame(Detector& det, Detections& out, uint32_t& visionMs) {
    if (!ok) return false;
    uint32_t t0 = millis();
    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) return false;
    sharedSetPhoto(fb->buf, fb->len);
    uint8_t* rgb = (uint8_t*)ps_malloc(cfg::CROP_PX * cfg::CROP_PX * 3);
    if (!rgb) {
        esp_camera_fb_return(fb);
        return false;
    }
    if (!fmt2rgb888(fb->buf, fb->len, fb->format, rgb)) {
        free(rgb);
        esp_camera_fb_return(fb);
        return false;
    }
    uint8_t crop[cfg::CROP_PX * cfg::CROP_PX * 3];
    uint8_t small[cfg::MODEL_INPUT_PX * cfg::MODEL_INPUT_PX * 3];
    centreCropRGB888(rgb, 320, 240, cfg::CROP_PX, crop);
    resizeBilinearRGB888(crop, cfg::CROP_PX, cfg::CROP_PX, small, cfg::MODEL_INPUT_PX, cfg::MODEL_INPUT_PX);
    det.detect(small, out);
    visionMs = millis() - t0;
    free(rgb);
    esp_camera_fb_return(fb);
    return true;
}
