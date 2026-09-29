# Wiring

See `firmware/include/config.h` and master prompt Section 3.

## Pin map (XIAO ESP32S3 Sense)

| Pin | GPIO | Function |
|-----|------|----------|
| D0 | 1 | Motor A PWM |
| D1 | 2 | AIN1 |
| D3 | 4 | AIN2 |
| D4 | 5 | Motor B PWM |
| D5 | 6 | BIN1 |
| D8 | 7 | BIN2 |
| D9 | 8 | Servo |
| D10 | 9 | Ultrasonic TRIG |
| D7 | 44 | Ultrasonic ECHO (divider) |
| D2 | 3 | Optional battery sense (100 kΩ / 33 kΩ divider to ADC) |
| D6 | 43 | Optional front bumper (`BUMPER_ENABLED`; 1 kΩ series + switch to GND) |
| LED | 21 | Status (active LOW) |

## Power

- Use a **2S Li-ion pack with a protection (BMS) board** between the cells and the robot harness.
- Battery → BMS → switch → TB6612 VM, 5 V buck (XIAO + HC-SR04), 6 V buck (servo).
- Enable `BATTERY_MONITOR_ENABLED` in `config.h` when the divider on D2 is fitted.
- Common ground everywhere.
- Set bucks with a multimeter before connecting loads.
- Do not power servo from the XIAO 5 V pin.

## Safety

- ECHO divider: 1 kΩ from ECHO to D7, 2 kΩ from D7 to GND.
- Power switch OFF when USB-C is used for flashing.
