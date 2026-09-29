# TrashBot — upgrade backlog (after v4)

Ideas for later, ordered by value for money. **Nothing here is built in v4.** Satyam picks one; then it gets its own prompt and gate.

**Rules for every upgrade**
- One upgrade at a time, behind a config flag (default off), following the v3 Feature Template: core logic + tests, a simulation scenario, reason codes, docs.
- Safety is never loosened. Stop must never depend on WiFi, voice, the laptop or the cloud.
- `tools/release_check.py` must say GO before flashing.
- Prices are rough India estimates and vary by seller.

## A. Free — software only

| # | Upgrade | What you get | Effort | Limits / notes |
|---|---|---|---|---|
| A1 | **Bin-full counter** ("dabba bhar gaya") | Counts items since the bin was last emptied; at N (e.g. 15) the mission ends with reason `bin_full` and the phone says so. `dabba khali kar diya` resets it. | S | An estimate (counts items, not volume). Firmware: NVS counter + reason code. |
| A2 | **Mission summary card** | After each mission: uthaye / fail / chhode + the last mistake photo, in Hinglish or English. | S | Uses the v3 mission history and mistake ring. |
| A3 | **"Desi kachra" dataset** | Add typical Indian litter to the dataset: chips packets, chai cups, biscuit wrappers, bottle caps, tissue, toffee wrappers. Better detection at home. | M (photos) | Keep the v3 model regression gate (F1 and false-trash rate must not get worse). |
| A4 | **Telegram bot** — status, photo, stop only | `/status`, `/photo`, `/ruko` from anywhere. | M | Home WiFi + internet; token in `secrets.h`. **No remote driving** on purpose: you can't see the room. |
| A5 | **Scheduled cleaning** | "Roz shaam 7 baje saaf karo" from Settings. | M | Needs NTP time (home WiFi). Runs only if health OK, bring-up done, pre-flight passes; the phone gets a notice. Think about kids and pets first. |
| A6 | **Visual go-to (beta)** | "sofa ki taraf jao" via the agent looking at photos step by step. | XS | Already described in `docs/reference/OPERATOR.md`; slow and approximate; `full` mode only. |
| A7 | **More languages** | Marathi / Bengali / Tamil words in the lexicon. | S per language | Same safety tests; add golden cases per language. |

## B. Cheap hardware

| # | Upgrade | Approx. cost | What you get | Pins / notes |
|---|---|---|---|---|
| B1 | **Rubber lip on the scoop edge** | ₹0–30 (old cycle tube) | Flat paper and wrappers slide in instead of being pushed away. Often the biggest single scoop improvement. | Mechanical only. Re-run scoop calibration; recipe learning adapts. |
| B2 | **Front white LED** | ₹50–150 | Much better detection in dim rooms. | No GPIO needed: wire it to 5 V after the power switch. Check for glare on shiny tiles. |
| B3 | **I2C sensor bus**: VL53L1X ToF distance + MPU6050 gyro on the two ultrasonic pins (D10/D7) | ₹600–1,100 | Accurate turns (gyro), **lift/tilt detection → motors off** (safety), better stuck detection, narrow-beam distance. | Replaces the HC-SR04. Needs I2C bus recovery. ToF can struggle on black or glass surfaces. Big change → its own gate. |
| B4 | **Wheel encoders** | ₹150–300 | Real distance travelled; "wapas aao" to the start point. | Needs 2 more pins → only after B3's pin re-plan or with an I/O expander. |
| B5 | **Buzzer** | ₹15–30 | Beep before moving and on stop. | Needs a pin (after B3 or an expander). |
| B6 | **2S BMS + USB-C charger board** | ₹200–400 | Safer charging without removing cells. | Already recommended in v3. |

## C. Bigger / later

| # | Upgrade | Notes |
|---|---|---|
| C1 | **On-device wake word + a few Hinglish keywords** ("TrashBot", "ruko", "saaf karo") | Edge Impulse keyword spotting trained on your own voice. Needs the ESP-IDF multi-impulse approach (Tiny-Prism-Labs/ESP32-S3_MultiImpulse) → a firmware migration. The STOP button stays the real stop. |
| C2 | **Small gripper arm** for bottles and cans | The scoop can't lift tall items. Roughly ₹800–1,500 in servos and parts. |
| C3 | **Mapping** (LiDAR + a companion computer) for "kitchen me jao" | Several thousand rupees, and a much bigger software change. |
| C4 | **Alexa / Google Home** start/stop (e.g. via Sinric Pro) | Cloud + home WiFi; same safety caveats as A4/A5. |
| C5 | **Catch mode** | See `docs/project/FUTURE_CATCH_MODE.md`. |
| C6 | **OTA updates** | Out of scope until the robot is stable (v3 decision). USB flashing only. |

## Suggested order

1. **B1 + B2** — about ₹100, the biggest real-world gain.
2. **A1 + A2** — free, makes daily use nicer.
3. **A3** — better model, protected by the regression gate.
4. **B3** — as its own gate (G12).
5. Then the C items.
