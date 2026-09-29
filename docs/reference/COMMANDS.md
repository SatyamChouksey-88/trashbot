# TrashBot commands — Hinglish + English ("Bolo")

> Generated from `shared/lang/trashbot-lang.mjs` (v1.0.0) by `node shared/lang/tools/gen-commands-doc.mjs`. Don't edit by hand.

## Where you give commands

| Where | How | Needs |
|---|---|---|
| **Phone → robot page → "Bolo" box** | Type, or tap the mic on your phone keyboard (Gboard voice typing) and speak. Hinglish, English and Devanagari (रुको) all work. | Phone on the robot's WiFi (or the same home WiFi) |
| **Cursor chat (the agent)** | Type in Hinglish or English. Start an operator chat with `/trashbot` (or attach the `trashbot-operator` rule). | Laptop and robot on the same WiFi |
| **Big STOP button** on the robot page | One tap. The fastest stop. | — |
| **Clap** | One clap starts cleaning when the robot is idle. Never rely on a clap to stop. | Clap-to-start enabled |
| **Power switch** | The real emergency stop. | — |

Chat is **not** an emergency stop: an AI reply takes seconds. For an instant stop use the STOP button or the power switch.

## Safety rules (always on)

1. **Stop words always win** — `ruko`, `ruk jao`, `bas`, `band karo`, `stop`, `wait`, `hold on`, `रुको` … even inside a question ("why did you stop" also stops).
2. **"mat / nahi / don't" + any action → it stops**, it never moves ("aage mat jao" = stop).
3. **Typos only get a "Did you mean …?"** — a misspelled command never moves the robot. A misspelled *stop* still stops.
4. **It asks first** when a motion command has unknown words, is a question, names a place, or has two numbers.
5. **Unclear → choices** ("ghumo" → left or right?).
6. **Limits per command:** forward 50 cm · back 20 cm (no rear sensor) · turn 180° · 20 items · 10 min. Firmware limits still apply on top.
7. **Learned phrases can't contain safety words** and can never override them.

Short version: *Galat samjha toh ruk jayega. Kabhi galat chalega nahi.*

## Commands

| What it does | Hinglish | English |
|---|---|---|
| **STOP** — Stops the motors now. Always wins, in any sentence.<br>Motor turant band. Kisi bhi sentence me ho, ye jeetega. | `ruko` · `ruk jao` · `bas karo` · `band karo` · `रुको` | `stop` · `wait` · `hold on` |
| **ESTOP** — Emergency stop (latched). Reset only from the phone app.<br>Emergency stop (lock). Reset sirf phone app se. | `emergency` · `bachao` | `emergency stop` · `e-stop` |
| **CLEAN** — Starts autonomous cleaning (default 5 items, 3 min).<br>Khud safai shuru (default 5 kachre, 3 min). | `kachra saaf karo` · `safai shuru karo` · `3 kachre uthao` · `2 minute saaf karo` · `कचरा साफ करो` | `clean the room` · `pick up the trash` · `clean 3 items` |
| **MOVE** — Drives straight (default 10 cm).<br>Seedha chalna (default 10 cm). | `20 cm aage chalo` · `thoda peeche` · `dheere aage jao` · `आगे 20 सेमी` | `forward 20 cm` · `go back a little` · `move ahead slowly` |
| **TURN** — Turns on the spot (default 45°).<br>Jagah pe ghoomna (default 45°). | `90 degree left ghumo` · `thoda right mudo` · `palat jao` | `turn left 90` · `turn right a bit` · `u-turn` |
| **SCOOP** — Moves the scoop: down / up / tip into the bin / test.<br>Scoop: neeche / upar / dabbe me palatna / test. | `scoop neeche karo` · `scoop upar karo` · `scoop khali karo` | `scoop down` · `lift the scoop` · `dump the scoop` |
| **PHOTO** — Takes a photo and shows what it detects.<br>Photo leke detections dikhata hai. | `photo lo` · `kya dikh raha hai` | `take a photo` · `what do you see` |
| **STATUS** — State, mode and distance ahead.<br>Haal, mode aur aage kitni jagah. | `kya haal hai` · `status batao` | `status` · `what are you doing` |
| **BATTERY** — Battery voltage (if the monitor is wired).<br>Battery voltage (agar monitor laga hai). | `battery kitni hai` | `battery level` |
| **REPORT** — Current or last mission: collected / failed / skipped.<br>Abhi ka ya pichla mission: uthaye / fail / chhode. | `kitna kachra uthaya` · `hisaab batao` | `report` · `how many did you collect` |
| **MISTAKES** — Recent mistakes it saved (for learning).<br>Saved galtiyan (seekhne ke liye). | `kya galti hui` · `kyun ruka` | `what went wrong` · `show mistakes` |
| **HEALTH** — Health check (camera, sensors, WiFi, …).<br>Health check (camera, sensors, WiFi, …). | `tabiyat kaisi hai` · `koi dikkat hai` | `health check` · `any problems` |
| **MARK_KEEP** — “Not trash” — stops and saves the frame as a mistake.<br>“Kachra nahi” — rukta hai aur frame galti me save. | `ye kachra nahi hai` · `ye mera hai` · `isko mat uthao` | `this is not trash` · `that is mine` · `don't pick this up` |
| **MARK_TRASH** — “That is trash” — saves it as missed trash.<br>“Ye kachra hai” — missed kachra me save. | `ye kachra hai` · `ye bhi kachra hai` | `this is trash` |
| **HELP** — Shows these commands.<br>Ye commands dikhata hai. | `madad` · `madad chahiye` | `help` · `commands` |
| **LANG** — Switches the reply language.<br>Reply ki language badalta hai. | `hinglish me bolo` | `reply in english` |
| **REPEAT** — Repeats the last command.<br>Pichla command dobara. | `dobara` · `phir se` | `again` · `repeat` |

## Numbers, units and amounts

- Distance: `20 cm`, `20cm`, `आगे २० सेमी`, `aadha meter` (50 cm), `2 step` (20 cm), `1 foot`, `10 inch`.
- Turns: `90`, `90 degree`, `90°`, `aadha chakkar` (180°), `palat jao` / `u-turn` (180°).
- Amounts: `thoda` / `zara` / `a bit` (move 5 cm, turn 20°) · `zyada` / `bahut` (move 25 cm, turn 90°) · `pura` (turn 90°, or 180° without a side).
- Speed: `dheere` / `aaram se` / `slowly` (25%) · `tez` / `jaldi` / `fast` (60%) · normal 40%.
- Defaults: move 10 cm · turn 45° · clean 5 items / 3 min.
- Cleaning limits: `3 kachre uthao`, `2 minute saaf karo`.

## Chains (max 3 steps)

`20 cm aage phir left ghumo phir photo lo` · `forward 20 cm then turn left`

Only move, turn, scoop, photo, status and battery can be chained. If any part is unclear, **nothing** runs.

## Confirmations

When it asks *"Kya main ye karun …?"*, answer `haan` / `ok` / `theek hai`, give the option number (`1`, `2`, `doosra`), or tap the choice. `nahi` / `rehne do` cancels. A question expires after 20 s. With nothing pending, `nahi` / `cancel` means stop.

## Teaching it new phrases (it remembers)

If it didn't understand and you pick a suggestion, it offers: *"Agli baar ke liye '<phrase>' yaad rakhun?"* → say `haan`. From then on that phrase works directly. Max 50 phrases, 40 characters each, no safety words. Manage them on the robot page: Settings → Learned phrases.

## Corrections (it learns from these)

- `ye kachra nahi hai` · `ye mera hai` · `isko mat uthao` · `this is not trash` → it **stops** and saves the camera frame as a mistake for the next model retraining.
- `ye kachra hai` · `this is trash` → saved as "missed trash".

## Language

Replies follow your words: any Hinglish or Devanagari word → Hinglish reply; plain English → English reply; neutral words (stop, left, photo, 20 cm) keep the last language. Force it with `english me bolo` / `hinglish me bolo`, or on the robot page: Settings → Language.

## What it can't do yet

- Go to places by name ("kitchen me jao") — there is no map. It says so instead of guessing.
- Scheduled cleaning ("kal saaf karna") — it asks, because "kal" isn't understood.
- Count repeats ("2 baar aage") — it does the move once and tells you.
