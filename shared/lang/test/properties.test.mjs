// Property (fuzz) tests for the safety rules S1–S7. Seeded and deterministic.
// More cases: TB_FUZZ_N=50000   Other seeds: TB_FUZZ_SEED=1,2,3…
// Run: node --test test/properties.test.mjs   (from shared/lang)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCommandStrict, validateAlias, toApiCalls, sanitizeStep, tokenize, LEXICON, LIMITS, MOTION_INTENTS, INTENTS,
} from '../trashbot-lang.mjs';

const N = Number(process.env.TB_FUZZ_N || 10000);
const MOTION = new Set(MOTION_INTENTS);
const KINDS = new Set(['command', 'confirm', 'clarify', 'unknown', 'empty', 'cancelled', 'info']);

const SEED = Number(process.env.TB_FUZZ_SEED || 0);
function rng(seed) { // mulberry32
  let a = (seed + SEED * 7919) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const words = (concepts) => concepts.flatMap((c) => [...LEXICON[c].en, ...LEXICON[c].hi]);
const skels = (concepts) => new Set(words(concepts).map((w) => tokenize(w)[0]));

const ALL_WORDS = Object.keys(LEXICON).flatMap((c) => [...LEXICON[c].en, ...LEXICON[c].hi]);
const JUNK = ['xyz', 'blah', 'qwerty', 'lol', 'asdf', 'kal', 'parso', 'kitchen', 'sofa', 'chotu', 'bhoot', 'zzz', '😀', '🤖', '?', '!',
  '...', ',', '-', '°', 'cm', '12.5', '0', '-5', '999999', '1e9', 'NaN', 'undefined', '<script>', "'", '"', '\\', '२०', 'ॐ', '​'];
const NUMS = ['1', '5', '10', '20', '45', '90', '180', '200', '360', '1000'];
const STOP_WORDS = words(['stop']);
const NEG_WORDS = words(['negation']);
const MOTION_TRIGGERS = skels(['cleanWord', 'trashNoun', 'pickupVerb', 'start', 'forward', 'back', 'left', 'right', 'uturn',
  'turnVerb', 'moveVerb', 'wapas', 'scoopNoun', 'tipWord', 'unitRound']);
const ESTOP_OR_RESET = skels(['estop', 'reset']);

function randomText(r, maxLen = 8) {
  const n = 1 + Math.floor(r() * maxLen);
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = r();
    out.push(x < 0.6 ? pick(r, ALL_WORDS) : x < 0.8 ? pick(r, JUNK) : pick(r, NUMS));
  }
  return out.join(r() < 0.2 ? '  ' : ' ');
}

function checkBounds(step, where) {
  const p = step.params;
  assert.ok(INTENTS.includes(step.intent), `${where}: bad intent ${step.intent}`);
  if (step.intent === 'MOVE') {
    const max = p.direction === 'forward' ? LIMITS.move.maxForwardCm : LIMITS.move.maxBackCm;
    assert.ok(['forward', 'back'].includes(p.direction), where);
    assert.ok(Number.isInteger(p.distance_cm) && p.distance_cm >= 1 && p.distance_cm <= max, `${where}: distance ${p.distance_cm}`);
  }
  if (step.intent === 'TURN') {
    assert.ok(['left', 'right'].includes(p.direction), where);
    assert.ok(Number.isInteger(p.degrees) && p.degrees >= 1 && p.degrees <= LIMITS.turn.maxDeg, `${where}: degrees ${p.degrees}`);
  }
  if (step.intent === 'MOVE' || step.intent === 'TURN') {
    assert.ok(p.speed >= LIMITS.speed.min && p.speed <= LIMITS.speed.max, `${where}: speed ${p.speed}`);
  }
  if (step.intent === 'CLEAN') {
    assert.ok(p.max_items >= 1 && p.max_items <= LIMITS.clean.maxItems, `${where}: items ${p.max_items}`);
    assert.ok(p.max_time_s >= LIMITS.clean.minTimeS && p.max_time_s <= LIMITS.clean.maxTimeS, `${where}: time ${p.max_time_s}`);
  }
  if (step.intent === 'SCOOP') assert.ok(['down', 'carry', 'tip', 'cycle'].includes(p.action), where);
}

function checkShape(res, where) {
  assert.ok(KINDS.has(res.kind), `${where}: kind ${res.kind}`);
  assert.ok(Array.isArray(res.steps) && Array.isArray(res.suggestions), where);
  assert.equal(typeof res.replyText, 'string', where);
  assert.ok(res.replyText.length > 0, `${where}: empty reply`);
  assert.ok(!/\{\w+\}/.test(res.replyText), `${where}: placeholder in "${res.replyText}"`);
  if (res.kind === 'command') assert.ok(res.steps.length >= 1, where);
  else assert.equal(res.steps.length, 0, `${where}: only commands carry steps`);
  if (res.kind === 'confirm' || res.kind === 'clarify') assert.ok(res.suggestions.length >= 1, where);
  assert.ok(res.steps.length <= LIMITS.sequenceMaxSteps, `${where}: too many steps`);
  assert.equal(res.stopFirst, res.steps.length > 0 && ['STOP', 'ESTOP'].includes(res.steps[0].intent), where);
  for (const s of res.steps) checkBounds(s, where);
  for (const o of res.suggestions) for (const s of o) checkBounds(s, where);
}

test('P1 never throws, valid shape, deterministic, bounded (random text)', () => {
  const r = rng(1);
  for (let i = 0; i < N; i++) {
    const text = randomText(r);
    const a = parseCommandStrict(text, { now: 0 });
    checkShape(a, JSON.stringify(text));
    assert.deepEqual(parseCommandStrict(text, { now: 0 }), a, 'deterministic');
  }
});

test('S1 a stop word anywhere => STOP first', () => {
  const r = rng(2);
  for (let i = 0; i < N; i++) {
    const parts = randomText(r, 6).split(' ');
    parts.splice(Math.floor(r() * (parts.length + 1)), 0, pick(r, STOP_WORDS));
    const text = parts.join(' ');
    if (tokenize(text).some((t) => ESTOP_OR_RESET.has(t))) continue; // ESTOP has its own rule
    const res = parseCommandStrict(text, { now: 0, aliases: [{ phrase: text, steps: [{ intent: 'CLEAN', params: {} }] }] });
    assert.equal(res.kind, 'command', JSON.stringify(text));
    assert.equal(res.steps[0].intent, 'STOP', JSON.stringify(text));
    assert.equal(res.steps.length, 1, JSON.stringify(text));
  }
});

test('S2 negation + anything => no motion runs and none is suggested', () => {
  const r = rng(3);
  for (let i = 0; i < N; i++) {
    const parts = randomText(r, 6).split(' ');
    parts.splice(Math.floor(r() * (parts.length + 1)), 0, pick(r, NEG_WORDS));
    const text = parts.join(' ');
    const res = parseCommandStrict(text, { now: 0 });
    const where = JSON.stringify(text);
    assert.ok(!res.steps.some((s) => MOTION.has(s.intent)), `${where} ran motion: ${JSON.stringify(res.steps)}`);
    assert.ok(!res.suggestions.flat().some((s) => MOTION.has(s.intent)), `${where} suggested motion: ${JSON.stringify(res.suggestions)}`);
  }
});

test('S3 without a real motion word, nothing moves (typos only suggest)', () => {
  const r = rng(4);
  for (let i = 0; i < N; i++) {
    const text = randomText(r);
    const toks = tokenize(text);
    if (toks.some((t) => MOTION_TRIGGERS.has(t))) continue;
    const res = parseCommandStrict(text, { now: 0 });
    assert.ok(!res.steps.some((s) => MOTION.has(s.intent)), `${JSON.stringify(text)} → ${JSON.stringify(res.steps)}`);
  }
});

test('S4 motion runs only when every word is understood and it is not a question', () => {
  const r = rng(5);
  for (let i = 0; i < N; i++) {
    const text = randomText(r) + (r() < 0.1 ? '?' : '');
    const res = parseCommandStrict(text, { now: 0 });
    if (res.kind === 'command' && res.steps.some((s) => MOTION.has(s.intent))) {
      assert.equal(res.unknownWords.length, 0, `${JSON.stringify(text)} unknown ${res.unknownWords}`);
      assert.ok(!text.includes('?'), `${JSON.stringify(text)} is a question`);
    }
  }
});

test('S6 pending answers and aliases are re-sanitised (tampered values are clamped)', () => {
  const r = rng(6);
  const now = 1_000_000;
  for (let i = 0; i < 2000; i++) {
    const bad = {
      intent: pick(r, ['MOVE', 'TURN', 'CLEAN', 'SCOOP']),
      params: { direction: pick(r, ['forward', 'back', 'left', 'right', 'up']), distance_cm: r() * 1e6 - 1e3, degrees: r() * 1e5, max_items: r() * 1e4, max_time_s: r() * 1e7, speed: r() * 500, action: pick(r, ['down', 'tip', 'x']) },
    };
    const a = parseCommandStrict('haan', { now, pending: { suggestions: [[bad]], at: now - 1 } });
    checkShape(a, JSON.stringify(bad));
    const b = parseCommandStrict('chotu jaldi', { now, aliases: [{ phrase: 'chotu jaldi', steps: [bad] }] });
    checkShape(b, JSON.stringify(bad));
  }
});

test('S7 aliases can never contain safety words, and stop words still win over aliases', () => {
  const unsafe = words(['stop', 'estop', 'basAlone', 'negation', 'softNa', 'yes', 'no']);
  for (const w of unsafe) {
    const v = validateAlias({ phrase: `chotu ${w}`, steps: [{ intent: 'CLEAN', params: {} }] });
    assert.equal(v.ok, false, `alias with "${w}" was accepted`);
  }
  assert.equal(validateAlias({ phrase: 'chotu kaam pe lag jao', steps: [{ intent: 'ESTOP_RESET', params: {} }] }).ok, false);
  assert.equal(validateAlias({ phrase: 'kachra saaf karo', steps: [{ intent: 'CLEAN', params: {} }] }).reason, 'already_understood');
  const ok = validateAlias({ phrase: 'chotu kaam pe lag jao', steps: [{ intent: 'CLEAN', params: {} }] });
  assert.equal(ok.ok, true);
  const many = Array.from({ length: LIMITS.alias.maxCount }, (_, i) => ({ phrase: `chotu ${i} xyz`, steps: [] }));
  assert.equal(validateAlias({ phrase: 'naya phrase xyz', steps: [{ intent: 'PHOTO', params: {} }] }, { existing: many }).reason, 'too_many');
  assert.equal(validateAlias({ phrase: 'chotu 3 xyz', steps: [{ intent: 'PHOTO', params: {} }] }, { existing: many }).replaced, true);
});

test('API bodies always stay inside the robot API limits', () => {
  const r = rng(7);
  for (let i = 0; i < N; i++) {
    const res = parseCommandStrict(randomText(r), { now: 0 });
    for (const s of [...res.steps, ...res.suggestions.flat()]) {
      for (const call of toApiCalls(s, { turnLeftSign: r() < 0.5 ? 1 : -1 })) {
        const b = call.body || {};
        if ('distance_cm' in b) assert.ok(Math.abs(b.distance_cm) >= 1 && Math.abs(b.distance_cm) <= LIMITS.move.maxForwardCm);
        if ('degrees' in b) assert.ok(Math.abs(b.degrees) >= 1 && Math.abs(b.degrees) <= LIMITS.turn.maxDeg);
        if ('speed' in b) assert.ok(b.speed >= LIMITS.speed.min && b.speed <= LIMITS.speed.max);
        if ('max_items' in b) assert.ok(b.max_items >= 1 && b.max_items <= LIMITS.clean.maxItems);
        if ('max_time_s' in b) assert.ok(b.max_time_s >= LIMITS.clean.minTimeS && b.max_time_s <= LIMITS.clean.maxTimeS);
        if (call.body && 'distance_cm' in b && b.distance_cm < 0) assert.ok(-b.distance_cm <= LIMITS.move.maxBackCm);
      }
    }
  }
  assert.equal(sanitizeStep({ intent: 'MOVE', params: { direction: 'sideways', distance_cm: 5 } }), null);
  assert.equal(sanitizeStep({ intent: 'MOVE', params: { direction: 'forward', distance_cm: Number.NaN } }), null);
  assert.equal(sanitizeStep(null), null);
});

test('hostile input: long, binary, markup — never throws, stays fast', () => {
  const inputs = ['a'.repeat(100000), '\u0000\u0001\u0002', '<img src=x onerror=alert(1)>', '{"intent":"MOVE"}', '🤖'.repeat(500),
    'ruko '.repeat(1000), 'aage '.repeat(500), null, undefined, 42, {}, []];
  const t0 = Date.now();
  for (const x of inputs) checkShape(parseCommandStrict(x), String(x).slice(0, 20));
  const r = rng(8);
  for (let i = 0; i < 2000; i++) parseCommandStrict(randomText(r, 12));
  assert.ok(Date.now() - t0 < 5000, 'parser too slow for a phone');
});
