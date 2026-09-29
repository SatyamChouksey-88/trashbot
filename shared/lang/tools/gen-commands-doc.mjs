#!/usr/bin/env node
// Generates docs/reference/COMMANDS.md (the bilingual command cheat sheet) from trashbot-lang.mjs.
// Usage (from the repo root):
//   node shared/lang/tools/gen-commands-doc.mjs           write docs/reference/COMMANDS.md
//   node shared/lang/tools/gen-commands-doc.mjs --check   exit 1 if docs/reference/COMMANDS.md is stale
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { EXAMPLES, LIMITS, LANG_VERSION } from '../trashbot-lang.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_OUT = resolve(here, '../../../docs/reference/COMMANDS.md');

const DESC = {
  STOP: ['Stops the motors now. Always wins, in any sentence.', 'Motor turant band. Kisi bhi sentence me ho, ye jeetega.'],
  ESTOP: ['Emergency stop (latched). Reset only from the phone app.', 'Emergency stop (lock). Reset sirf phone app se.'],
  CLEAN: ['Starts autonomous cleaning (default 5 items, 3 min).', 'Khud safai shuru (default 5 kachre, 3 min).'],
  MOVE: ['Drives straight (default 10 cm).', 'Seedha chalna (default 10 cm).'],
  TURN: ['Turns on the spot (default 45°).', 'Jagah pe ghoomna (default 45°).'],
  SCOOP: ['Moves the scoop: down / up / tip into the bin / test.', 'Scoop: neeche / upar / dabbe me palatna / test.'],
  PHOTO: ['Takes a photo and shows what it detects.', 'Photo leke detections dikhata hai.'],
  STATUS: ['State, mode and distance ahead.', 'Haal, mode aur aage kitni jagah.'],
  BATTERY: ['Battery voltage (if the monitor is wired).', 'Battery voltage (agar monitor laga hai).'],
  REPORT: ['Current or last mission: collected / failed / skipped.', 'Abhi ka ya pichla mission: uthaye / fail / chhode.'],
  MISTAKES: ['Recent mistakes it saved (for learning).', 'Saved galtiyan (seekhne ke liye).'],
  HEALTH: ['Health check (camera, sensors, WiFi, …).', 'Health check (camera, sensors, WiFi, …).'],
  MARK_KEEP: ['“Not trash” — stops and saves the frame as a mistake.', '“Kachra nahi” — rukta hai aur frame galti me save.'],
  MARK_TRASH: ['“That is trash” — saves it as missed trash.', '“Ye kachra hai” — missed kachra me save.'],
  HELP: ['Shows these commands.', 'Ye commands dikhata hai.'],
  LANG: ['Switches the reply language.', 'Reply ki language badalta hai.'],
  REPEAT: ['Repeats the last command.', 'Pichla command dobara.'],
};

const code = (arr) => arr.map((x) => '`' + x + '`').join(' · ');

export function renderCommandsDoc() {
  const L = LIMITS;
  const rows = EXAMPLES.map((ex) => `| **${ex.intent}** — ${DESC[ex.intent][0]}<br>${DESC[ex.intent][1]} | ${code(ex.hi)} | ${code(ex.en)} |`);
  return `# TrashBot commands — Hinglish + English ("Bolo")

> Generated from \`shared/lang/trashbot-lang.mjs\` (v${LANG_VERSION}) by \`node shared/lang/tools/gen-commands-doc.mjs\`. Don't edit by hand.

## Where you give commands

| Where | How | Needs |
|---|---|---|
| **Phone → robot page → "Bolo" box** | Type, or tap the mic on your phone keyboard (Gboard voice typing) and speak. Hinglish, English and Devanagari (रुको) all work. | Phone on the robot's WiFi (or the same home WiFi) |
| **Cursor chat (the agent)** | Type in Hinglish or English. Start an operator chat with \`/trashbot\` (or attach the \`trashbot-operator\` rule). | Laptop and robot on the same WiFi |
| **Big STOP button** on the robot page | One tap. The fastest stop. | — |
| **Clap** | One clap starts cleaning when the robot is idle. Never rely on a clap to stop. | Clap-to-start enabled |
| **Power switch** | The real emergency stop. | — |

Chat is **not** an emergency stop: an AI reply takes seconds. For an instant stop use the STOP button or the power switch.

## Safety rules (always on)

1. **Stop words always win** — \`ruko\`, \`ruk jao\`, \`bas\`, \`band karo\`, \`stop\`, \`wait\`, \`hold on\`, \`रुको\` … even inside a question ("why did you stop" also stops).
2. **"mat / nahi / don't" + any action → it stops**, it never moves ("aage mat jao" = stop).
3. **Typos only get a "Did you mean …?"** — a misspelled command never moves the robot. A misspelled *stop* still stops.
4. **It asks first** when a motion command has unknown words, is a question, names a place, or has two numbers.
5. **Unclear → choices** ("ghumo" → left or right?).
6. **Limits per command:** forward ${L.move.maxForwardCm} cm · back ${L.move.maxBackCm} cm (no rear sensor) · turn ${L.turn.maxDeg}° · ${L.clean.maxItems} items · ${L.clean.maxTimeS / 60} min. Firmware limits still apply on top.
7. **Learned phrases can't contain safety words** and can never override them.

Short version: *Galat samjha toh ruk jayega. Kabhi galat chalega nahi.*

## Commands

| What it does | Hinglish | English |
|---|---|---|
${rows.join('\n')}

## Numbers, units and amounts

- Distance: \`20 cm\`, \`20cm\`, \`आगे २० सेमी\`, \`aadha meter\` (50 cm), \`2 step\` (20 cm), \`1 foot\`, \`10 inch\`.
- Turns: \`90\`, \`90 degree\`, \`90°\`, \`aadha chakkar\` (180°), \`palat jao\` / \`u-turn\` (180°).
- Amounts: \`thoda\` / \`zara\` / \`a bit\` (move ${L.move.smallCm} cm, turn ${L.turn.smallDeg}°) · \`zyada\` / \`bahut\` (move ${L.move.largeCm} cm, turn ${L.turn.largeDeg}°) · \`pura\` (turn 90°, or 180° without a side).
- Speed: \`dheere\` / \`aaram se\` / \`slowly\` (${L.speed.slow}%) · \`tez\` / \`jaldi\` / \`fast\` (${L.speed.fast}%) · normal ${L.speed.normal}%.
- Defaults: move ${L.move.defaultCm} cm · turn ${L.turn.defaultDeg}° · clean ${L.clean.defaultItems} items / ${L.clean.defaultTimeS / 60} min.
- Cleaning limits: \`3 kachre uthao\`, \`2 minute saaf karo\`.

## Chains (max ${L.sequenceMaxSteps} steps)

\`20 cm aage phir left ghumo phir photo lo\` · \`forward 20 cm then turn left\`

Only move, turn, scoop, photo, status and battery can be chained. If any part is unclear, **nothing** runs.

## Confirmations

When it asks *"Kya main ye karun …?"*, answer \`haan\` / \`ok\` / \`theek hai\`, give the option number (\`1\`, \`2\`, \`doosra\`), or tap the choice. \`nahi\` / \`rehne do\` cancels. A question expires after ${L.pendingTtlMs / 1000} s. With nothing pending, \`nahi\` / \`cancel\` means stop.

## Teaching it new phrases (it remembers)

If it didn't understand and you pick a suggestion, it offers: *"Agli baar ke liye '<phrase>' yaad rakhun?"* → say \`haan\`. From then on that phrase works directly. Max ${L.alias.maxCount} phrases, ${L.alias.maxPhraseChars} characters each, no safety words. Manage them on the robot page: Settings → Learned phrases.

## Corrections (it learns from these)

- \`ye kachra nahi hai\` · \`ye mera hai\` · \`isko mat uthao\` · \`this is not trash\` → it **stops** and saves the camera frame as a mistake for the next model retraining.
- \`ye kachra hai\` · \`this is trash\` → saved as "missed trash".

## Language

Replies follow your words: any Hinglish or Devanagari word → Hinglish reply; plain English → English reply; neutral words (stop, left, photo, 20 cm) keep the last language. Force it with \`english me bolo\` / \`hinglish me bolo\`, or on the robot page: Settings → Language.

## What it can't do yet

- Go to places by name ("kitchen me jao") — there is no map. It says so instead of guessing.
- Scheduled cleaning ("kal saaf karna") — it asks, because "kal" isn't understood.
- Count repeats ("2 baar aage") — it does the move once and tells you.
`;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const check = process.argv.includes('--check');
  const out = process.argv.slice(2).find((a) => !a.startsWith('--')) || DEFAULT_OUT;
  const text = renderCommandsDoc();
  if (check) {
    const cur = existsSync(out) ? readFileSync(out, 'utf8') : '';
    if (cur !== text) {
      console.error(`${out} is out of date. Run: node shared/lang/tools/gen-commands-doc.mjs`);
      process.exit(1);
    }
    console.log('COMMANDS.md is up to date');
  } else {
    writeFileSync(out, text);
    console.log(`wrote ${out}`);
  }
}
