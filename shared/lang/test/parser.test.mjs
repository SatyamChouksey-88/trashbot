// Golden tests: every phrase in golden.json must parse exactly as written there.
// Run: node --test test/parser.test.mjs   (from shared/lang)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCommandStrict, EXAMPLES, toApiCalls, describeSteps } from '../trashbot-lang.mjs';

const golden = JSON.parse(readFileSync(new URL('./golden.json', import.meta.url), 'utf8'));

const subset = (actual, expected, where) => {
  for (const [k, v] of Object.entries(expected)) {
    assert.deepEqual(actual?.[k], v, `${where}: param ${k}`);
  }
};

test(`golden cases (${golden.length})`, async (t) => {
  for (const g of golden) {
    await t.test(JSON.stringify(g.in), () => {
      const r = parseCommandStrict(g.in, g.opts || {});
      const ctx = `${JSON.stringify(g.in)} → ${r.kind} ${JSON.stringify(r.steps.length ? r.steps : r.suggestions)}`;
      assert.equal(r.kind, g.kind, ctx);
      if (g.intents) assert.deepEqual(r.steps.map((s) => s.intent), g.intents, ctx);
      if (g.params) g.params.forEach((p, i) => subset(r.steps[i]?.params, p, ctx));
      if (g.sugg) assert.deepEqual(r.suggestions.map((o) => o.map((s) => s.intent)), g.sugg, ctx);
      if (g.lang) assert.equal(r.lang, g.lang, `${ctx} lang`);
      if (g.notes) for (const n of g.notes) assert.ok(r.notes.includes(n), `${ctx} missing note ${n} (has ${r.notes})`);
      if (g.reply) assert.equal(r.reply.key, g.reply, `${ctx} reply`);
      if (g.unknown) assert.deepEqual(r.unknownWords, g.unknown, `${ctx} unknownWords`);
      assert.equal(typeof r.replyText, 'string');
      assert.ok(r.replyText.length > 0, `${ctx} empty replyText`);
      assert.ok(!/\{\w+\}/.test(r.replyText), `${ctx} unfilled placeholder in "${r.replyText}"`);
    });
  }
});

test('every documented example parses to its intent', () => {
  for (const ex of EXAMPLES) {
    for (const lang of ['hi', 'en']) {
      for (const phrase of ex[lang]) {
        if (ex.intent === 'REPEAT') {
          const r = parseCommandStrict(phrase, { lastSteps: [{ intent: 'PHOTO', params: {} }] });
          assert.equal(r.kind, 'command', `${phrase} → ${r.kind}`);
          assert.ok(r.notes.includes('repeat'), `${phrase} should repeat the last command`);
          continue;
        }
        const r = parseCommandStrict(phrase);
        assert.equal(r.kind, 'command', `${phrase} → ${r.kind}`);
        assert.ok(r.steps.some((s) => s.intent === ex.intent), `${phrase} → ${r.steps.map((s) => s.intent)} (want ${ex.intent})`);
      }
    }
  }
});

test('API adapter maps steps to the v2/v3 robot API', () => {
  const P = (text) => parseCommandStrict(text).steps;
  assert.deepEqual(toApiCalls(P('20 cm aage')[0]), [{ method: 'POST', path: '/api/move', body: { distance_cm: 20, speed: 40 } }]);
  assert.deepEqual(toApiCalls(P('10 cm peeche')[0]), [{ method: 'POST', path: '/api/move', body: { distance_cm: -10, speed: 40 } }]);
  assert.deepEqual(toApiCalls(P('90 left')[0]), [{ method: 'POST', path: '/api/turn', body: { degrees: 90, speed: 40 } }]);
  assert.deepEqual(toApiCalls(P('90 left')[0], { turnLeftSign: -1 }), [{ method: 'POST', path: '/api/turn', body: { degrees: -90, speed: 40 } }]);
  assert.deepEqual(toApiCalls(P('90 right')[0]), [{ method: 'POST', path: '/api/turn', body: { degrees: -90, speed: 40 } }]);
  assert.deepEqual(toApiCalls(P('ruko')[0]), [{ method: 'POST', path: '/api/stop' }]);
  assert.deepEqual(toApiCalls(P('emergency')[0]), [{ method: 'POST', path: '/api/estop' }]);
  assert.deepEqual(toApiCalls(P('3 kachre uthao')[0]), [{ method: 'POST', path: '/api/clean', body: { max_items: 3, max_time_s: 180, label: 'bolo' } }]);
  assert.deepEqual(toApiCalls(P('scoop neeche')[0]), [{ method: 'POST', path: '/api/scoop', body: { action: 'down' } }]);
  assert.deepEqual(toApiCalls(P('photo lo')[0]), [{ method: 'GET', path: '/api/photo' }]);
  assert.deepEqual(toApiCalls(P('battery')[0]), [{ method: 'GET', path: '/api/status' }]);
  assert.deepEqual(toApiCalls(P('ye kachra nahi hai')[1]), [{ method: 'POST', path: '/api/mistakes/flag', body: { note: 'user: not trash (bolo)' } }]);
  assert.deepEqual(toApiCalls(P('help')[0]), []);
  assert.deepEqual(toApiCalls({ intent: 'MOVE', params: { direction: 'forward', distance_cm: 5000 } }), [{ method: 'POST', path: '/api/move', body: { distance_cm: 50, speed: 40 } }]);
  assert.deepEqual(toApiCalls({ intent: 'NUKE' }), []);
});

test('replies exist in both languages', () => {
  const r1 = parseCommandStrict('20 cm aage phir left ghumo');
  assert.equal(describeSteps(r1.steps, 'hi'), '20 cm aage, phir 45° left ghumo');
  assert.equal(describeSteps(r1.steps, 'en'), 'forward 20 cm, then turn left 45°');
  assert.equal(parseCommandStrict('ruko').replyText, 'Ruk gaya.');
  assert.equal(parseCommandStrict('ruko', { lang: 'en' }).replyText, 'Stopping.');
});

test('descriptions round-trip: describeSteps(x) parses back to x (used for learned phrases)', () => {
  const S = (intent, params = {}) => ({ intent, params });
  const samples = [
    S('MOVE', { direction: 'forward', distance_cm: 10, speed: 40 }), S('MOVE', { direction: 'forward', distance_cm: 50, speed: 25 }),
    S('MOVE', { direction: 'back', distance_cm: 20, speed: 60 }), S('MOVE', { direction: 'back', distance_cm: 5, speed: 40 }),
    S('TURN', { direction: 'left', degrees: 45, speed: 40 }), S('TURN', { direction: 'right', degrees: 90, speed: 25 }),
    S('TURN', { direction: 'right', degrees: 180, speed: 40 }), S('TURN', { direction: 'left', degrees: 180, speed: 60 }),
    S('SCOOP', { action: 'down' }), S('SCOOP', { action: 'carry' }), S('SCOOP', { action: 'tip' }), S('SCOOP', { action: 'cycle' }),
    S('CLEAN', { max_items: 5, max_time_s: 180 }), S('CLEAN', { max_items: 12, max_time_s: 600 }), S('CLEAN', { max_items: 1, max_time_s: 60 }),
    S('PHOTO'), S('STATUS'), S('BATTERY'), S('HEALTH'), S('REPORT'), S('MISTAKES'),
  ];
  for (const lang of ['hi', 'en']) {
    for (const s of samples) {
      const text = describeSteps([s], lang);
      const r = parseCommandStrict(text);
      assert.equal(r.kind, 'command', `${lang}: "${text}" → ${r.kind} ${JSON.stringify(r.suggestions)}`);
      assert.deepEqual(r.steps, [s], `${lang}: "${text}"`);
    }
  }
});
