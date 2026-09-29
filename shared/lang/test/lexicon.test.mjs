// Lint tests for the lexicon, the reply catalogue and the generated docs.
// Run: node --test test/lexicon.test.mjs   (from shared/lang)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { LEXICON, LEXICON_ERRORS, I18N, EXAMPLES, INTENTS, tokenize } from '../trashbot-lang.mjs';
import { renderCommandsDoc, DEFAULT_OUT } from '../tools/gen-commands-doc.mjs';

const sk = (c) => new Set([...LEXICON[c].en, ...LEXICON[c].hi].map((w) => tokenize(w)[0]));
const inter = (a, b) => [...sk(a)].filter((x) => sk(b).has(x));
const ACTION = ['cleanWord', 'trashNoun', 'pickupVerb', 'start', 'forward', 'back', 'left', 'right', 'uturn', 'turnVerb',
  'moveVerb', 'wapas', 'scoopNoun', 'tipWord', 'scoopDown', 'scoopUp', 'scoopTip'];

test('every lexicon entry is exactly one token', () => {
  assert.deepEqual(LEXICON_ERRORS, []);
});

test('safety words never overlap with action / yes / filler words', () => {
  for (const a of ['stop', 'estop', 'basAlone', 'negation']) {
    for (const b of [...ACTION, 'yes', 'filler', 'imperative']) {
      assert.deepEqual(inter(a, b), [], `${a} ∩ ${b}`);
    }
  }
  for (const b of [...ACTION, 'filler']) assert.deepEqual(inter('separator', b), [], `separator ∩ ${b}`);
  for (const b of ACTION) assert.deepEqual(inter('yes', b), [], `yes ∩ ${b}`);
  assert.deepEqual(inter('negation', 'yes'), []);
  assert.deepEqual(inter('softNa', 'filler'), []);
});

test('opposite words never overlap', () => {
  const pairs = [['forward', 'back'], ['left', 'right'], ['forward', 'left'], ['forward', 'right'], ['back', 'left'],
    ['back', 'right'], ['speedSlow', 'speedFast'], ['qtySmall', 'qtyLarge'], ['scoopDown', 'scoopUp'], ['langEn', 'langHi']];
  for (const [a, b] of pairs) assert.deepEqual(inter(a, b), [], `${a} ∩ ${b}`);
  for (const b of ['forward', 'back', 'left', 'right', 'moveVerb', 'turnVerb']) assert.deepEqual(inter('cleanWord', b), [], `cleanWord ∩ ${b}`);
  for (const b of ACTION) assert.deepEqual(inter('locationNoun', b), [], `locationNoun ∩ ${b}`);
});

test('reply catalogue: both languages, same placeholders', () => {
  const ph = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const [key, e] of Object.entries(I18N)) {
    assert.ok(e.en && e.en.trim(), `${key}.en empty`);
    assert.ok(e.hi && e.hi.trim(), `${key}.hi empty`);
    assert.deepEqual(ph(e.en), ph(e.hi), `${key}: placeholders differ`);
  }
});

test('every reply key used in the source exists in the catalogue', () => {
  const src = readFileSync(new URL('../trashbot-lang.mjs', import.meta.url), 'utf8');
  const used = new Set([
    ...[...src.matchAll(/replyKey: '(\w+)'/g)].map((m) => m[1]),
    ...[...src.matchAll(/\bt\('(\w+)'/g)].map((m) => m[1]),
  ]);
  for (const k of used) assert.ok(k in I18N, `missing reply key ${k}`);
});

test('examples use real intents', () => {
  for (const ex of EXAMPLES) {
    assert.ok(INTENTS.includes(ex.intent), ex.intent);
    assert.ok(ex.hi.length && ex.en.length, `${ex.intent} needs Hinglish and English examples`);
  }
});

test('docs/reference/COMMANDS.md matches the generator (if present)', (t) => {
  if (!existsSync(DEFAULT_OUT)) return t.skip('docs/reference/COMMANDS.md not found (run the generator)');
  assert.equal(readFileSync(DEFAULT_OUT, 'utf8'), renderCommandsDoc(), 'run: node shared/lang/tools/gen-commands-doc.mjs');
});
