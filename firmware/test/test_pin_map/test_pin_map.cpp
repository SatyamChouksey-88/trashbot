#include <unity.h>
#include "config.h"

static void assert_all_pins_unique(void) {
    const int pins[] = {
        cfg::PIN_PWMA,
        cfg::PIN_AIN1,
        cfg::PIN_AIN2,
        cfg::PIN_PWMB,
        cfg::PIN_BIN1,
        cfg::PIN_BIN2,
        cfg::PIN_SERVO,
        cfg::PIN_US_TRIG,
        cfg::PIN_US_ECHO,
        cfg::PIN_BATTERY_ADC,
        cfg::PIN_STATUS_LED,
        cfg::PIN_BUMPER,
    };
    const int n = (int)(sizeof(pins) / sizeof(pins[0]));
    for (int i = 0; i < n; i++) {
        for (int j = i + 1; j < n; j++) {
            TEST_ASSERT_NOT_EQUAL(pins[i], pins[j]);
        }
    }
}

void test_pin_map_all_gpio_unique(void) {
    assert_all_pins_unique();
}

void test_bumper_gpio43_not_ultrasonic(void) {
    TEST_ASSERT_EQUAL(43, cfg::PIN_BUMPER);
    TEST_ASSERT_EQUAL(44, cfg::PIN_US_ECHO);
    TEST_ASSERT_NOT_EQUAL(cfg::PIN_BUMPER, cfg::PIN_US_ECHO);
    TEST_ASSERT_NOT_EQUAL(cfg::PIN_BUMPER, cfg::PIN_US_TRIG);
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_pin_map_all_gpio_unique);
    RUN_TEST(test_bumper_gpio43_not_ultrasonic);
    return UNITY_END();
}
