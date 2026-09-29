# TrashBot — Upgrade Prompt v4 for Cursor (Agent mode): "Bolo" — Hinglish + English commands

**Extends v2 + v3. Same zero-questions rules. Office-laptop safe. Most of the code is delivered pre-built and pre-tested.**

This file arrived in a package together with ready code. Execute Section 12 phase by phase. Add "v4 active" at the top of the progress log in `docs/PLAN.md` first.

---

## 0. Rules (in addition to v2 §0, v3 §0 and the office-laptop rules)

1. **Never ask me anything while building.** Never wait for approval, never end a message with a question. Undecided details: use the v2 priority order (safety → fits the hardware → simplest → cheapest → easiest to test) and record them in `docs/DECISIONS.md`.
   The **operator** role in `docs/OPERATOR.md` is different: it's how the AI behaves when I *operate the robot* in a chat, and it does ask when a robot command is unclear. It never applies to you while you build.
2. **Delivered files are pre-tested — integrate, don't rewrite.** The files listed in Section 2 passed 359 automated tests, a TypeScript/vitest/esbuild integration check and 9 browser tests before delivery. Don't port, copy or re-implement them (e.g. no TypeScript copy of the parser). You may fix a real bug only by first adding a failing test (a golden case in `shared/lang/test/golden.json` or a unit test), then the fix; record it in `DECISIONS.md`. **Never delete or weaken a golden case, a safety property (S1–S7) or a limit.**
3. **Office laptop:** keep `TRASHBOT_NO_NATIVE=1`. Build **no** native executables here. Everything new in v4 runs with `node`, `npm`, `python` and PlatformIO's firmware build. The new C++ core tests run in GitHub Actions only.
4. **v3 first.** If v3 phases (A–I) aren't finished yet, finish them first, then start v4. Phase J (package check-in) may run any time.
5. **Design rule — firmware speaks JSON, the edges speak languages.** The parser runs on the phone and on the laptop, never on the ESP32. Firmware only serves two static JS files and stores learned phrases as validated data. Every motion from a text command is a normal `/api/*` call, so firmware safety still decides. Record this in `DECISIONS.md`.
6. Git: local commits only, repo-local identity (v2 FAQ). Never push.

---

## 1. What v4 adds

**How I will give commands**

| Where | How | Path |
|---|---|---|
| Phone → robot page → **Bolo box** | Type, or tap the phone keyboard's mic (Gboard voice typing). Hinglish, English and Devanagari. | `/bolo-ui.mjs` + `/lang.mjs` in the browser → the same `/api/*` calls the buttons use |
| **Cursor chat** | Type in Hinglish or English. `/trashbot` starts an operator chat. | MCP tool `run_command` → `shared/lang/executor.mjs` → robot API |
| Big **STOP** button | One tap | `/api/stop` |
| Clap | Start only | unchanged |
| Power switch | Real emergency stop | — |

**Safety rules of the language layer** (all tested, see `shared/lang/README.md`):

- **S1** A stop word anywhere → STOP first.
- **S2** Negation + an action → STOP, never motion.
- **S3** Typos only suggest.
- **S4** Unknown words, a question, a place name or two numbers → ask first.
- **S5** Ambiguous → choices.
- **S6** Clamped numbers: forward 50 cm, back 20 cm, 180°, 20 items, 600 s.
- **S7** Learned phrases can't contain or override safety words.

**Self-improvement (with permission):**
- When I use a phrase it didn't know and then pick the right option, it offers *"Agli baar ke liye '<phrase>' yaad rakhun?"*. On yes, it stores the phrase on the robot. That phrase then works on the phone and in Cursor.
- Corrections like "ye kachra nahi hai" stop the robot and flag the frame for retraining (v3 mistake ring).

---

## 2. Package contents (already in the repo after extraction)

| Path | What | Your action |
|---|---|---|
| `shared/lang/trashbot-lang.mjs` + `.d.mts` | Parser, lexicon, limits, replies (en + Hinglish), API adapter | Import only |
| `shared/lang/executor.mjs` + `.d.mts` | Agent executor: modes, stop-first, pending questions, learned phrases | Import only |
| `shared/lang/web/bolo-ui.mjs` | Phone "Bolo" box (vanilla JS, no CDN) | Serve + mount |
| `shared/lang/web/dev-server.mjs` | Try Bolo with a fake robot (`npm run dev` in `shared/lang`) | Keep; document |
| `shared/lang/test/*` | Golden (325 phrases), property/fuzz, lexicon lint, executor tests | Keep green |
| `shared/lang/web/test/bolo-ui.e2e.mjs` | Browser test vs the fake robot (skips without playwright-core) | Port scenarios to `e2e/` (Phase N) |
| `shared/lang/tools/gen-commands-doc.mjs`, `tools/fuzz.mjs` | Cheat-sheet generator, heavy fuzz runner | Use in release_check |
| `tools/embed_lang.py` + `tools/tests/test_embed_lang.py` | Generates `firmware/lib/net/web_lang.h` from the two JS files; `--check` mode | Run + add to release_check |
| `docs/COMMANDS.md` | Bilingual command cheat sheet (generated) | Link from README |
| `docs/OPERATOR.md` | Operator rules for Cursor chats | Link from AGENTS.md / AGENT.md |
| `docs/UPGRADES.md` | Upgrade backlog (not built in v4) | Link from README |
| `.cursor/commands/trashbot.md`, `ruko.md`, `saaf-karo.md` | Slash commands `/trashbot`, `/ruko`, `/saaf-karo` | Keep |
| `.cursor/rules/trashbot-operator.mdc` | "Apply intelligently" rule for robot chats | Keep |
| `docs/MASTER_PROMPT_V4.md` | This file | — |

---

## 3. Firmware changes (small)

### 3.1 Serve the two JS files
- Run `python tools/embed_lang.py`. It writes `firmware/lib/net/web_lang.h` with `WEB_LANG_MJS` and `WEB_BOLO_UI_MJS`: raw string literals in flash, about 100 KB, UTF-8 intact. It compiled without warnings under g++ `-std=gnu++17 -Wall -Wextra`.
- **Commit the generated header,** so the PlatformIO build needs no Python or Node. `python tools/embed_lang.py --check` guards freshness in `release_check.py` and CI.
- Routes in `http_api.cpp`, not under `/api`, so no token is needed (like `/`):

  ```cpp
  #include "web_lang.h"
  server.on("/lang.mjs", HTTP_GET, [] {
    server.sendHeader("Cache-Control", "no-cache");
    server.send_P(200, "text/javascript; charset=utf-8", WEB_LANG_MJS);
  });
  server.on("/bolo-ui.mjs", HTTP_GET, [] {
    server.sendHeader("Cache-Control", "no-cache");
    server.send_P(200, "text/javascript; charset=utf-8", WEB_BOLO_UI_MJS);
  });
  ```

  `send_P` streams from flash; don't build a `String` from these arrays.

### 3.2 Mount the Bolo box in `web_index.h`
At the **top of `<body>`**, above the existing tabs, always visible:
```html
<div id="bolo"></div>
<script type="module">
  import * as L from '/lang.mjs';
  import { mountBolo } from '/bolo-ui.mjs';
  mountBolo(document.getElementById('bolo'), { L });
</script>
```
- Keep every existing tab and button.
- Label the page's main STOP button `■ RUKO · STOP` and the Auto tab's Start button `Saaf karo · Clean`.
- If the page already stores the API token (e.g. from a settings field), also write it to `localStorage['tb_token']`, so Bolo sends the same `X-TrashBot-Token` header.
- Don't add an in-page microphone button. Browser speech recognition needs HTTPS and internet, and the robot serves plain HTTP on its own WiFi. The phone keyboard's mic works instead. Record this in `DECISIONS.md`.

### 3.3 `/api/status` — additive fields (no `api_version` bump)
- `turn_left_sign`: `+1` if a positive `degrees` in `/api/turn` turns the robot **left** (counter-clockwise seen from above), else `-1`.
  - **Derive it from the code, don't guess:** read `core/timed_move::turnDegrees`. Positive degrees with `left < 0, right > 0` means left, so +1.
  - Put it in `config.h` as `TURN_LEFT_SIGN` with a comment.
  - Add a core unit test that asserts the relation, so a future change can't silently flip it.
  - If the robot turns the wrong way on hardware, that's a motor inversion/swap: fix it in the bring-up wizard (v3 §5.2), not here.
- `features: ["bolo", "aliases"]`.

### 3.4 Learned phrases store (Feature Template, v3 §2)
Data only: the firmware never interprets phrases. Flag `ALIASES_ENABLED = true` in `config.h`. It moves nothing, so default on is fine; record why.

- **`lib/core/alias_rules.{h,cpp}`** (pure C++). `AliasCheck validateAliasEntry(const AliasEntry&)` checks:
  - phrase: 1–160 bytes of UTF-8, no control characters;
  - 1–3 steps;
  - `intent` is one of `CLEAN MOVE TURN SCOOP PHOTO STATUS HEALTH BATTERY REPORT MISTAKES HELP`;
  - `MOVE`: `direction` ∈ {forward, back}, `distance_cm` 1–50 (forward) or 1–20 (back), `speed` 10–80;
  - `TURN`: `direction` ∈ {left, right}, `degrees` 1–180, `speed` 10–80;
  - `SCOOP`: `action` ∈ {down, carry, tip, cycle};
  - `CLEAN`: `max_items` 1–20, `max_time_s` 10–600.

  It returns a reason code (`ok`, `phrase_empty`, `phrase_too_long`, `bad_intent`, `bad_param`, `too_many_steps`). Write Unity tests for every branch (they run in CI).
- **`lib/store/alias_store.{h,cpp}`**:
  - LittleFS `/aliases.json`, at most 50 entries and 16 KB;
  - atomic write (write `/aliases.tmp`, then rename);
  - loaded at boot; a corrupt file → start empty and emit event `aliases_reset {reason: corrupt}`;
  - accessed behind a mutex.
- **API** (token rules like other `/api` routes):
  - `GET /api/aliases` → `{"aliases":[{"phrase","steps":[{"intent","params":{…}}]}],"max":50}`
  - `POST /api/aliases` with body `{phrase, steps}`:
    - same phrase string → replace it, otherwise append;
    - `200 {"ok":true,"replaced":bool,"count":n}`;
    - `400 {"error":"<reason>"}` when invalid;
    - `409 {"error":"full"}` when full.
  - `DELETE /api/aliases?phrase=<url-encoded>` → `{"ok":true,"removed":bool}`
  - `POST /api/aliases/reset` → `{"ok":true}`
- Events with reason codes: `alias_saved`, `alias_removed`, `aliases_reset`.
- Body size limit: 2 KB. Invalid JSON → 400.
- The phone and the agent re-validate every stored phrase on load (`sanitizeStep`). A bad entry can never exceed limits.

### 3.5 Mock robot parity (`agent/mock-robot/server.ts`)
- Serve `/lang.mjs` and `/bolo-ui.mjs` straight from `shared/lang/` (no copies).
- Implement the aliases API exactly like 3.4 (in memory).
- Add `turn_left_sign` (+1) and `features` to status.
- Extend the contract tests.
- `shared/lang/web/dev-server.mjs` is a separate, tiny preview. Keep both.

---

## 4. Agent changes (MCP server)

### 4.1 Import the shared code (tested setup: `tsc` strict 0 errors, vitest OK, esbuild bundle OK)
`agent/src/bolo.ts`, exactly:
```ts
// Single import point for the shared Bolo code (paths live here only).
export * from '../../shared/lang/trashbot-lang.mjs';
export { createExecutor, MODES } from '../../shared/lang/executor.mjs';
export type { Executor, Http, HttpResult, Mode, RunResult } from '../../shared/lang/executor.mjs';
```
- TypeScript (NodeNext) resolves the `.d.mts` files.
- Don't enable `allowJs`. `dist/` keeps its layout, and at runtime `dist/bolo.js` resolves `../../shared/lang/...` from `agent/dist/`.
- The esbuild `.mcpb` bundle inlines the files. Extend `verify:mcpb` to call `run_command` once against the mock.

### 4.2 HTTP adapter
`agent/src/boloHttp.ts`, exactly:
```ts
import type { Http, HttpResult } from './bolo.js';
// Adapter: robot HTTP for the executor (timeouts: 5 s, photo 8 s; token header if set).
export function makeHttp(baseUrl: string, token?: string): Http {
  return async (method, path, body): Promise<HttpResult> => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), path.startsWith('/api/photo') ? 8000 : 5000);
    try {
      const headers: Record<string, string> = {};
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (token) headers['X-TrashBot-Token'] = token;
      const res = await fetch(baseUrl.replace(/\/$/, '') + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl.signal });
      const ct = res.headers.get('content-type') ?? '';
      const data = ct.includes('json') ? await res.json().catch(() => null) : ct.startsWith('image/') ? new Uint8Array(await res.arrayBuffer()) : null;
      return { ok: res.ok, status: res.status, data };
    } catch {
      return { ok: false, status: 'offline', data: null };
    } finally {
      clearTimeout(timer);
    }
  };
}
```
If `robotClient.ts` already has equivalent code, you may wrap it instead, but keep this `Http` shape and behaviour.

### 4.3 One executor per server process
```ts
const executor = createExecutor({
  http: makeHttp(env.TRASHBOT_URL, env.TRASHBOT_TOKEN),
  mode: env.TRASHBOT_MODE,   // read_only | dry_run | full (default dry_run)
  lang: env.TRASHBOT_LANG,   // auto | en | hi (default auto)
});
```
Pending questions and learned-phrase offers live in this instance, across tool calls.

### 4.4 New tools (register them like the existing tools, with zod schemas)

**`run_command { text: string (1–300) }`**. Description, verbatim:

> Run a TrashBot command written in plain Hinglish, English or Hindi (Devanagari) — e.g. 'kachra saaf karo', '20 cm aage chalo', '90 degree left ghumo', 'photo lo', 'battery kitni hai', 'ruko', 'clean the room', 'turn left 90 then forward 20 cm'. ALWAYS try this first with the user's exact words. It applies the robot's safety rules (stop words win, 'mat/nahi/don't' never moves, typos only suggest, unclear commands ask), respects TRASHBOT_MODE (read_only / dry_run / full) and returns a reply already in the user's language. If the result says needsAnswer, show the question and options to the user and call run_command again with their answer ('haan', 'nahi', '1', '2').

It returns MCP content:
1. `{type:'text', text: r.text}`;
2. one `{type:'image', data, mimeType}` per `r.images`;
3. `{type:'text', text: JSON.stringify({ok: r.ok, kind: r.kind, mode: r.mode, needsAnswer: r.needsAnswer, aliasOffer: r.aliasOffer, calls: r.calls})}`.

Robot errors are normal results (`isError: false`). Only exceptions are errors.

**`add_alias { phrase: string (1–40), command_text?: string }`**:
- Saves a learned phrase.
- Empty `command_text` saves the last `aliasOffer`.
- Description: "Only after the user said yes to remembering this phrase."

**`list_aliases {}`** and **`remove_alias { phrase }`**.

### 4.5 Mode fix (v3 gap)
`stop` and `estop` work in **every** mode, including `read_only`. Stopping must never be blocked. Update the mode table in `docs/AGENT.md` and the tests.

### 4.6 Existing tools: bilingual descriptions and safer schemas
Append these trigger phrases to the existing descriptions:

| Tool | Add to its description |
|---|---|
| `stop` | "Call this FIRST, before anything else, whenever the user says stop / ruko / ruk jao / bas / band karo / wait / hold on / रुको — any language or spelling. Works in every mode." |
| `estop` | "Use for emergency / bachao / e-stop / danger. Only a human can reset it, from the phone app." |
| `start_cleaning` | "User may say 'kachra saaf karo', 'safai shuru karo', 'kachra uthao', 'jhadu lagao', 'clean the room'. Prefer run_command." |
| `take_photo` | "'photo lo', 'kya dikh raha hai', 'what do you see'." |
| `get_status` | "'kya haal hai', 'status batao', 'kya chal raha hai'." |
| `get_health` | "'tabiyat kaisi hai', 'koi dikkat hai'." |
| `get_mission` / `get_events` | "'hisaab batao', 'kitna kachra uthaya', 'kya galti hui', 'kyun ruka'." |
| `record_user_correction` | "When the user says 'ye kachra nahi hai' / 'ye mera hai' / 'this is not trash' (KEEP) or 'ye kachra hai' (TRASH)." |

Schemas:
- `move`: tighten `distance_cm` to **−20..50**. That matches Bolo: there's no rear sensor. The firmware API keeps its own limits.
- `turn`: add optional `direction: 'left' | 'right'`. With `direction`, `degrees` must be 1–180 and the sign comes from `turn_left_sign`. Change the description to "Always pass direction."

### 4.7 `clean_room` prompt
Append this text, verbatim:
```
Language: the user may write in Hinglish, English or Hindi. Reply in the same style (Hinglish in Roman script), in 1–3 short lines.
Stop words (ruko, ruk jao, bas, band karo, stop, wait, रुको) → call stop first, before anything else.
For any other instruction, first try run_command with the user's exact words.
```

### 4.8 Config
`.cursor/mcp.json`: add `"TRASHBOT_LANG": "auto"` next to `TRASHBOT_MODE` (keep `dry_run`). `manifest.json`: add a `lang` user-config option too.

### 4.9 Agent tests (vitest, run locally)
- `run_command` against the mock in each mode: `read_only` refuses motion, `dry_run` makes no motion call, `full` calls `/api/move {20,40}` for "20 cm aage".
- "ruko" in `read_only` → `/api/stop`.
- "ghumo" → needsAnswer → "2" → turn right with the sign from status.
- Alias flow: "chotu kaam pe lag jao" → "1" → aliasOffer → `add_alias` → the next run executes directly.
- **Parity test:** for 30 golden phrases (motion + info), the calls the agent makes to the mock equal `toApiCalls(...)` for the parsed steps. Phone and agent must behave identically.
- `turn` with `direction` uses `turn_left_sign`; `move` rejects 30 cm back.

---

## 5. Cursor operator setup
- `AGENTS.md`: add "Operating the robot from chat: see `docs/OPERATOR.md` (operator role ≠ build role; while building, never ask)."
- `docs/AGENT.md`: new section "Talking to TrashBot in Hinglish / English". Cover:
  - `/trashbot`, `/ruko`, `/saaf-karo`, and `@trashbot-operator`;
  - modes;
  - Cursor's tool-approval prompts stay on for motion. If Cursor offers "always allow" for single tools, it's fine for `stop`, `estop`, `get_status`, `take_photo` only;
  - some Cursor versions don't show MCP images in the chat, but the model still receives them — open the robot page to see the photo yourself;
  - chat is not an emergency stop.

---

## 6. Docs
- `README.md`: a "Bolo — Hinglish + English commands" section with 5 examples, a link to `docs/COMMANDS.md`, the dev preview (`cd shared/lang && npm run dev`), and a link to `docs/UPGRADES.md`.
- `docs/DECISIONS.md`:
  - JS-at-the-edges;
  - no in-page mic (HTTPS + internet) → keyboard mic;
  - stop words win even inside questions (fail-safe; "why did you stop" also stops);
  - `TURN_LEFT_SIGN`;
  - aliases are data-only;
  - `move` schema tightened;
  - stop allowed in `read_only`.
- `docs/API.md`: `/lang.mjs`, `/bolo-ui.mjs`, `/api/aliases*`, the new status fields.
- `docs/TESTING.md`: G11 rows. `docs/USER_STEPS.md`: G11 steps. `CHANGELOG.md`: v4. `docs/PLAN.md`: G11.
- `docs/COMMANDS.md` stays generated. After any lexicon change, run `node shared/lang/tools/gen-commands-doc.mjs`.

---

## 7. Tests, CI, release
- **Local (office laptop):**
  - `cd shared/lang && npm test` (359 tests, ~10 s);
  - `python -m pytest tools -q` (includes `test_embed_lang.py`);
  - agent `npm test`;
  - firmware `python -m platformio run -d firmware -e xiao`;
  - `node shared/lang/tools/gen-commands-doc.mjs --check`;
  - `python tools/embed_lang.py --check`.
- **`tools/release_check.py`:** add each of the above as a step. Also add `npm run test:fuzz` in `shared/lang`, and e2e Bolo if Playwright browsers are available (skip with a clear message otherwise). Output stays GO / NO-GO.
- **CI:**
  - a `shared-lang` job (Node 20: `npm test`, `npm run test:fuzz`, `docs:check`);
  - core Unity tests including `alias_rules` and the turn-sign test;
  - `embed_lang.py --check`;
  - the Bolo e2e (Playwright Chromium) against the mock.
- **E2E:** port the 9 scenarios of `shared/lang/web/test/bolo-ui.e2e.mjs` into `e2e/bolo.spec.ts`, against the mock robot. Tag the wheels-in-the-air-safe ones `@hil`: stop, Devanagari stop, photo, battery, 10 cm move, estop + reset.

---

## 8. Gate G11 — Bolo

| | Pass criteria |
|---|---|
| **Software (you)** | All tests above green; `release_check.py` → GO; the parity test passes; `verify:mcpb` runs `run_command` against the mock. |
| **Hardware (me)** | The checklist below, in `docs/TESTING.md`. |

**G11 hardware checklist** (wheels in the air first, then on the floor):
1. Phone: start "50 cm aage", then type "ruko" → it stops within about 0.5 s.
2. "aage mat jao" → never moves.
3. "20 cm aage" → about 20 cm (±3 cm after calibration). "90 left" → turns **left** about 90°.
4. Gboard voice "kachra saaf karo" → cleaning starts; voice "ruko" → stops.
5. Devanagari keyboard "रुको" → stops.
6. "ghumo" → chips; tap right → turns right.
7. Teach "chotu kaam pe lag jao" → pick → "yaad rakho" → works next time. Delete it in Settings.
8. "ye kachra nahi hai" while it approaches → stops; the frame shows in Mistakes.
9. Cursor `/trashbot`:
   - "battery kitni hai" → answer;
   - in `dry_run`, "kachra saaf karo" → DRY RUN text and the robot doesn't move;
   - in `read_only`, "ruko" → the robot stops.
10. English: "turn left 90 then forward 20 cm" → both steps; reply in English.
11. Reboot the robot → learned phrases are still there.

---

## 9. MUST NOT (v4)
- Put an LLM, a language parser or a lexicon in the firmware.
- Port or duplicate the parser; weaken S1–S7; delete golden cases; raise `LIMITS`.
- Let the agent reset the emergency stop, change `TRASHBOT_MODE`, or save a learned phrase without a "yes".
- Add CDN scripts, an in-page mic/Web Speech recognition, or native executables built on the office laptop.
- Break existing tabs, buttons, API routes or tests.
- Implement anything from `docs/UPGRADES.md`.
- Push to any remote.

---

## 10. Definition of done (v4)
- [ ] Every v2 and v3 definition-of-done item is still true.
- [ ] `shared/lang` 359 tests pass; heavy fuzz passes; `COMMANDS.md` and `web_lang.h` are fresh.
- [ ] Firmware builds (`xiao`); `/lang.mjs` and `/bolo-ui.mjs` are served; the Bolo box is on top of the page; the status has `turn_left_sign` + `features`; the aliases API works on the mock.
- [ ] The agent has `run_command`, `add_alias`, `list_aliases`, `remove_alias`; stop works in `read_only`; the parity test passes; `verify:mcpb` passes.
- [ ] The operator files are linked from AGENTS.md / AGENT.md; README has the Bolo section; the docs are updated.
- [ ] `release_check.py` → GO. `git status` clean, one commit per phase.

---

## 11. Final report
Use the v2 Section 16 format, and add:
- test counts (`shared/lang`, agent, pytest, e2e);
- the value of `TURN_LEFT_SIGN` and how you derived it;
- the new endpoints;
- anything left for me, in order. The G11 hardware checklist goes first.

---

## 12. Phases (commit after each)

**J. Package check-in**
- If the package files are inside a single subfolder (e.g. `TrashBot_v4_Bolo/`), move its contents to the repo root. It only contains new paths; if a file already exists, keep the existing one, save the new one as `<name>.v4new`, and record it in `DECISIONS.md`. Then remove the empty folder.
- Run `cd shared/lang && npm test` (expect 359 pass) and `python -m pytest tools/tests/test_embed_lang.py -q`.
- Commit "feat(bolo): add pre-tested shared language layer".

**K. Firmware + mock**
- Section 3: embed + routes, Bolo mount, status fields + `TURN_LEFT_SIGN` test, alias rules/store/API + Unity tests (CI), mock parity.
- Build `xiao`.

**L. Agent**
- Section 4: `bolo.ts`, `boloHttp.ts`, executor, the new tools, the mode fix, descriptions and schemas, `clean_room`, config, tests, `verify:mcpb`.

**M. Operator + docs**
- Sections 5 and 6.

**N. Tests, CI, release**
- Section 7: `e2e/bolo.spec.ts`, CI jobs, `release_check.py` → GO, then the final report (Section 11).
