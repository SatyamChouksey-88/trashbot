#include "sound_trigger.h"
#include "config.h"
#include <Arduino.h>
#include <driver/i2s.h>

// Onboard PDM mic (Seeed XIAO ESP32S3 Sense): CLK GPIO 42, DATA GPIO 41
static constexpr i2s_port_t I2S_PORT = I2S_NUM_0;
static constexpr int PDM_CLK_PIN = 42;
static constexpr int PDM_DATA_PIN = 41;
static bool ready = false;
static uint32_t lastTriggerMs = 0;

void soundTriggerBegin() {
    if (!cfg::SOUND_TRIGGER_ENABLED) return;
    i2s_config_t i2s_cfg = {};
    i2s_cfg.mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX | I2S_MODE_PDM);
    i2s_cfg.sample_rate = 16000;
    i2s_cfg.bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT;
    i2s_cfg.channel_format = I2S_CHANNEL_FMT_ONLY_LEFT;
    i2s_cfg.communication_format = I2S_COMM_FORMAT_STAND_I2S;
    i2s_cfg.intr_alloc_flags = ESP_INTR_FLAG_LEVEL1;
    i2s_cfg.dma_buf_count = 4;
    i2s_cfg.dma_buf_len = 256;
    i2s_cfg.use_apll = false;
    i2s_cfg.tx_desc_auto_clear = false;
    i2s_cfg.fixed_mclk = 0;

    if (i2s_driver_install(I2S_PORT, &i2s_cfg, 0, nullptr) != ESP_OK) return;

    i2s_pin_config_t pin_cfg = {};
    pin_cfg.bck_io_num = I2S_PIN_NO_CHANGE;
    pin_cfg.ws_io_num = PDM_CLK_PIN;
    pin_cfg.data_out_num = I2S_PIN_NO_CHANGE;
    pin_cfg.data_in_num = PDM_DATA_PIN;
    if (i2s_set_pin(I2S_PORT, &pin_cfg) != ESP_OK) return;
    ready = true;
}

bool soundTriggerPoll(uint32_t now) {
    if (!ready || !cfg::SOUND_TRIGGER_ENABLED) return false;
    if (now - lastTriggerMs < cfg::SOUND_TRIGGER_COOLDOWN_MS) return false;

    int16_t buf[320];
    size_t bytesRead = 0;
    if (i2s_read(I2S_PORT, buf, sizeof(buf), &bytesRead, pdMS_TO_TICKS(10)) != ESP_OK) return false;
    int samples = (int)(bytesRead / sizeof(int16_t));
    int peak = 0;
    for (int i = 0; i < samples; i++) {
        int v = buf[i] < 0 ? -buf[i] : buf[i];
        if (v > peak) peak = v;
    }
    if (peak >= cfg::SOUND_TRIGGER_LEVEL) {
        lastTriggerMs = now;
        return true;
    }
    return false;
}
