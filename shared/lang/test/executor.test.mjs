// Executor tests with a fake robot. Run: node --test test/executor.test.mjs   (from shared/lang)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExecutor } from '../executor.mjs';

function fakeRobot(opts = {}) {
  const calls = [];
  const aliases = [];
  let offlineLeft = opts.offlineStops || 0;
  const http = async (method, path, body) => {
    calls.push({ method, path, body });
    if (path === '/api/stop' && offlineLeft > 0) { offlineLeft--; throw new Error('ECONNREFUSED'); }
    if (opts.busy && ['/api/move', '/api/turn', '/api/clean', '/api/scoop'].includes(path)) return { ok: false, status: 409, data: { error: 'busy: auto' } };
    switch (`${method} ${path.split('?')[0]}`) {
      case 'GET /api/status': return { ok: true, status: 200, data: { state: 'IDLE', mode: 'idle', distance_cm: 80, battery_v: 7.6, detections: [{}, {}], turn_left_sign: opts.leftSign ?? 1 } };
      case 'GET /api/health': return { ok: true, status: 200, data: { overall: 'DEGRADED' } };
      case 'GET /api/photo': return { ok: true, status: 200, data: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]) };
      case 'GET /api/mission/current': return { ok: true, status: 200, data: { mission_id: 'TB-3-2', items_collected: 4, items_failed: 1, items_skipped: 0 } };
      case 'GET /api/mission/history': return { ok: true, status: 200, data: { missions: [] } };
      case 'GET /api/mistakes': return { ok: true, status: 200, data: { mistakes: [{}, {}, {}] } };
      case 'GET /api/aliases': return opts.noAliases ? { ok: false, status: 404, data: null } : { ok: true, status: 200, data: { aliases: [...aliases] } };
      case 'POST /api/aliases': aliases.push(body); return { ok: true, status: 200, data: { ok: true } };
      case 'DELETE /api/aliases': {
        const p = new URL(`http://x${path}`).searchParams.get('phrase');
        const i = aliases.findIndex((a) => a.phrase === p);
        if (i >= 0) aliases.splice(i, 1);
        return { ok: true, status: 200, data: { removed: i >= 0 } };
      }
      case 'POST /api/move': return { ok: true, status: 200, data: { ok: true, duration_ms: 1200 } };
      case 'POST /api/turn': return { ok: true, status: 200, data: { ok: true, duration_ms: 700 } };
      default: return { ok: true, status: 200, data: { ok: true } };
    }
  };
  return { http, calls, aliases };
}

const motionCalls = (calls) => calls.filter((c) => ['/api/move', '/api/turn', '/api/clean', '/api/scoop'].includes(c.path));
const make = (mode, robot, extra = {}) => {
  let clock = 1_000_000;
  const sleeps = [];
  const ex = createExecutor({ http: robot.http, mode, now: () => clock, sleep: async (ms) => { sleeps.push(ms); }, ...extra });
  return { ex, sleeps, tick: (ms) => { clock += ms; } };
};

test('stop is sent in EVERY mode (v3 read_only gap fixed)', async () => {
  for (const mode of ['read_only', 'dry_run', 'full']) {
    const robot = fakeRobot();
    const { ex } = make(mode, robot);
    const out = await ex.run('ruko');
    assert.equal(out.calls[0].path, '/api/stop', mode);
    assert.equal(out.text, 'Ruk gaya.');
    const e = await ex.run('emergency');
    assert.equal(e.calls[0].path, '/api/estop', mode);
  }
});

test('read_only refuses motion, dry_run describes it, full does it', async () => {
  let robot = fakeRobot();
  let out = await make('read_only', robot).ex.run('20 cm aage');
  assert.deepEqual(motionCalls(robot.calls), []);
  assert.equal(out.ok, false);
  assert.match(out.text, /Read-only/);

  robot = fakeRobot();
  out = await make('dry_run', robot).ex.run('20 cm aage');
  assert.deepEqual(motionCalls(robot.calls), []);
  assert.match(out.text, /DRY RUN/);
  assert.deepEqual(out.calls.filter((c) => c.dryRun).map((c) => c.body), [{ distance_cm: 20, speed: 40 }]);

  robot = fakeRobot();
  out = await make('full', robot).ex.run('20 cm aage');
  assert.deepEqual(motionCalls(robot.calls).map((c) => c.body), [{ distance_cm: 20, speed: 40 }]);
  assert.equal(out.ok, true);
});

test('info works in read_only; photo comes back as an image', async () => {
  const robot = fakeRobot();
  const { ex } = make('read_only', robot);
  assert.match((await ex.run('battery kitni hai')).text, /7\.60 V/);
  assert.match((await ex.run('health check')).text, /DEGRADED/);
  assert.match((await ex.run('hisaab batao')).text, /TB-3-2: 4 uthaye/);
  assert.match((await ex.run('kya galti hui')).text, /3 recent galtiyan/);
  const p = await ex.run('photo lo');
  assert.equal(p.images.length, 1);
  assert.equal(p.images[0].data, '/9j/2Q==');
  assert.match(p.text, /Detections: 2/);
});

test('clarify → "2" picks the second option; firmware turn sign is respected', async () => {
  for (const [leftSign, expected] of [[1, -45], [-1, 45]]) {
    const robot = fakeRobot({ leftSign });
    const { ex } = make('full', robot);
    const q = await ex.run('ghumo');
    assert.equal(q.needsAnswer, true);
    assert.match(q.text, /\(1\) 45° left ghumo {2}\(2\) 45° right ghumo/);
    await ex.run('2');
    assert.deepEqual(motionCalls(robot.calls).map((c) => c.body), [{ degrees: expected, speed: 40 }]);
  }
});

test('sequences wait for timed moves; an error aborts the rest', async () => {
  let robot = fakeRobot();
  let m = make('full', robot);
  await m.ex.run('20 cm aage phir left ghumo phir photo lo');
  assert.deepEqual(motionCalls(robot.calls).map((c) => c.path), ['/api/move', '/api/turn']);
  assert.deepEqual(m.sleeps, [1500, 1000]);

  robot = fakeRobot({ busy: true });
  m = make('full', robot);
  const out = await m.ex.run('20 cm aage phir left ghumo');
  assert.equal(out.ok, false);
  assert.match(out.text, /safai chal rahi hai/);
  assert.deepEqual(motionCalls(robot.calls).map((c) => c.path), ['/api/move']);
});

test('stop retries twice when the robot is briefly unreachable', async () => {
  const robot = fakeRobot({ offlineStops: 2 });
  const out = await make('full', robot).ex.run('ruko');
  assert.equal(robot.calls.filter((c) => c.path === '/api/stop').length, 3);
  assert.equal(out.ok, true);
});

test('corrections: saved in dry_run/full, refused in read_only', async () => {
  let robot = fakeRobot();
  await make('dry_run', robot).ex.run('ye kachra nahi hai');
  assert.deepEqual(robot.calls.filter((c) => c.method === 'POST').map((c) => c.path), ['/api/stop', '/api/mistakes/flag']);
  robot = fakeRobot();
  const out = await make('read_only', robot).ex.run('ye kachra nahi hai');
  assert.deepEqual(robot.calls.filter((c) => c.method === 'POST').map((c) => c.path), ['/api/stop']);
  assert.match(out.text, /Read-only/);
});

test('emergency-stop reset is never done by the agent', async () => {
  const robot = fakeRobot();
  const { ex } = make('full', robot);
  await ex.run('emergency reset');
  const out = await ex.run('haan');
  assert.ok(!robot.calls.some((c) => c.path === '/api/estop/reset'));
  assert.match(out.text, /phone app/);
});

test('confirm-to-learn: unknown phrase → pick → offer → add_alias → next time direct', async () => {
  const robot = fakeRobot();
  const { ex } = make('full', robot);
  const q = await ex.run('chotu kaam pe lag jao');
  assert.equal(q.needsAnswer, true);
  const done = await ex.run('1');
  assert.deepEqual(done.aliasOffer.phrase, 'chotu kaam pe lag jao');
  assert.match(done.text, /yaad rakhun/);
  const saved = await ex.addAlias('chotu kaam pe lag jao'); // saves the offered steps
  assert.equal(saved.ok, true, saved.text);
  assert.equal(robot.aliases.length, 1);
  const before = motionCalls(robot.calls).length;
  const again = await ex.run('chotu kaam pe lag jao');
  assert.equal(again.kind, 'command');
  assert.equal(motionCalls(robot.calls).length, before + 1);
  // explicit command text also works, and replaces the same phrase
  assert.equal((await ex.addAlias('chotu kaam pe lag jao bhai', '20 cm peeche')).ok, true);
  assert.equal(robot.aliases.length, 1);
  assert.deepEqual(robot.aliases[0].steps, [{ intent: 'MOVE', params: { direction: 'back', distance_cm: 20, speed: 40 } }]);
});

test('add_alias refuses safety words, known phrases and bad commands; handles old firmware', async () => {
  const robot = fakeRobot();
  const { ex } = make('full', robot);
  assert.equal((await ex.addAlias('chotu ruko', '20 cm aage')).reason, 'contains_safety_word');
  assert.equal((await ex.addAlias('kachra saaf karo', '20 cm aage')).reason, 'already_understood');
  assert.equal((await ex.addAlias('chotu jhoom', 'blah blah')).reason, 'bad_steps');
  assert.equal(robot.aliases.length, 0);
  const old = make('full', fakeRobot({ noAliases: true })).ex;
  assert.equal((await old.addAlias('chotu jhoom', '20 cm aage')).reason, 'unsupported');
  assert.equal((await make('read_only', fakeRobot()).ex.addAlias('chotu jhoom', '20 cm aage')).reason, 'read_only');
});

test('pending questions expire; language can be switched per session', async () => {
  const robot = fakeRobot();
  const m = make('full', robot);
  await m.ex.run('ghumo');
  m.tick(25_000);
  const late = await m.ex.run('haan');
  assert.match(late.text, /purana ho gaya/);
  assert.deepEqual(motionCalls(robot.calls), []);
  await m.ex.run('english me bolo');
  assert.equal((await m.ex.run('ruko')).text, 'Stopping.');
  const forced = make('full', fakeRobot(), { lang: 'en' }).ex;
  assert.equal((await forced.run('ruko')).text, 'Stopping.');
});

test('robot offline gives a friendly message and never throws', async () => {
  const ex = createExecutor({ http: async () => { throw new Error('down'); }, mode: 'full', sleep: async () => {} });
  const out = await ex.run('20 cm aage');
  assert.equal(out.ok, false);
  assert.match(out.text, /connection nahi hai/);
  const s = await ex.run('stop');
  assert.equal(s.ok, false);
  assert.match(s.text, /connection nahi hai/);
});

test('older firmware (404) gets a clear "not supported" message', async () => {
  const ex = createExecutor({ http: async () => ({ ok: false, status: 404, data: null }), mode: 'full', sleep: async () => {} });
  assert.match((await ex.run('kya galti hui')).text, /feature abhi nahi hai/);
});
