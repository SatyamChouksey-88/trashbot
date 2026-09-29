// Browser test for the Bolo box against the fake robot (dev-server.mjs).
// Needs playwright-core + a Chromium. Skips cleanly if they are missing (e.g. on the office laptop).
//   npm i -D playwright-core   (then)   node --test shared/lang/web/test/bolo-ui.e2e.mjs
// Env: PW_CHROMIUM=<path to chrome executable> if Playwright can't find its own browser.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = 8800 + Math.floor(Math.random() * 100);
const BASE = `http://127.0.0.1:${PORT}`;
let pw = null;
try { pw = await import('playwright-core'); } catch { /* optional */ }

let server;
let browser;
let page;
const consoleErrors = [];

before(async () => {
  if (!pw) return;
  server = spawn(process.execPath, [resolve(here, '../dev-server.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'pipe' });
  await new Promise((ok, bad) => {
    server.stdout.on('data', (d) => String(d).includes('Bolo dev page') && ok());
    server.on('exit', (c) => bad(new Error(`dev server exited ${c}`)));
    setTimeout(() => bad(new Error('dev server timeout')), 8000);
  });
  browser = await pw.chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
  page = await browser.newPage({ viewport: { width: 360, height: 740 } });
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  await page.goto(BASE);
  await page.waitForSelector('.tb-bolo input');
});

after(async () => {
  if (browser) await browser.close();
  if (server) server.kill();
});

const calls = async () => (await fetch(`${BASE}/__calls`)).json();
const lastCall = async (path) => (await calls()).filter((c) => c.path.startsWith(path)).at(-1);
async function say(text) {
  const before = (await calls()).length;
  await page.fill('.tb-bolo input', text);
  await page.press('.tb-bolo input', 'Enter');
  await page.waitForTimeout(250);
  return before;
}
const reply = () => page.textContent('.tb-bolo [data-r="reply"]');
const chips = () => page.$$eval('.tb-bolo [data-r="chips"] button', (b) => b.map((x) => x.textContent));
const skip = (t) => { if (!pw) t.skip('playwright-core not installed'); return !pw; };

test('Hinglish move → /api/move', async (t) => {
  if (skip(t)) return;
  await say('20 cm aage chalo');
  assert.deepEqual((await lastCall('/api/move')).body, { distance_cm: 20, speed: 40 });
  assert.match(await reply(), /20 cm aage/);
});

test('stop word → /api/stop first', async (t) => {
  if (skip(t)) return;
  const n = await say('ruko');
  const c = (await calls()).slice(n);
  assert.equal(c[0].path, '/api/stop');
  assert.equal(await reply(), 'Ruk gaya.');
  await say('रुको');
  assert.equal((await calls()).at(-1).path, '/api/stop');
});

test('clarify chips → tap → /api/turn', async (t) => {
  if (skip(t)) return;
  await say('ghumo');
  const c = await chips();
  assert.equal(c.length, 3);
  await page.click('.tb-bolo [data-r="chips"] button >> nth=1');
  await page.waitForTimeout(250);
  assert.deepEqual((await lastCall('/api/turn')).body, { degrees: -45, speed: 40 });
});

test('confirm with a place name, then "haan" → /api/clean', async (t) => {
  if (skip(t)) return;
  await say('sofa ke paas saaf karo');
  assert.match(await reply(), /jagah/);
  assert.equal((await chips())[0], '✓ Haan');
  await say('haan');
  assert.deepEqual((await lastCall('/api/clean')).body, { max_items: 5, max_time_s: 180, label: 'bolo' });
  await say('ruko');
});

test('learns a new phrase after confirm-to-learn', async (t) => {
  if (skip(t)) return;
  await say('chotu kaam pe lag jao');
  await page.click('.tb-bolo [data-r="chips"] button >> nth=0'); // "10 cm aage"
  await page.waitForTimeout(300);
  const offer = await chips();
  assert.match(offer[0], /yaad rakho/);
  const m = (await calls()).length;
  await page.click('.tb-bolo [data-r="chips"] button >> nth=0');
  await page.waitForTimeout(300);
  assert.ok((await calls()).slice(m).some((x) => x.method === 'POST' && x.path === '/api/aliases'), 'alias saved');
  const n = await say('chotu kaam pe lag jao');
  const c = (await calls()).slice(n).filter((x) => x.path === '/api/move');
  assert.equal(c.length, 1, 'learned phrase runs directly');
  await page.click('.tb-bolo summary');
  assert.match(await page.textContent('.tb-bolo [data-r="aliases"]'), /chotu/);
});

test('sequence runs in order; STOP cancels the rest', async (t) => {
  if (skip(t)) return;
  let n = await say('10 cm aage phir left ghumo');
  await page.waitForTimeout(1500);
  let c = (await calls()).slice(n).map((x) => x.path);
  assert.deepEqual(c, ['/api/move', '/api/turn']);
  n = await say('50 cm aage phir 90 left');
  await page.click('.tb-bolo [data-r="stop"]');
  await page.waitForTimeout(3800);
  c = (await calls()).slice(n).map((x) => x.path);
  assert.ok(c.includes('/api/stop'));
  assert.ok(!c.includes('/api/turn'), `turn must be cancelled, got ${c}`);
});

test('info: battery, photo, report; language switch', async (t) => {
  if (skip(t)) return;
  await say('battery kitni hai');
  assert.match(await reply(), /7\.62 V/);
  await say('photo lo');
  await page.waitForTimeout(300);
  assert.ok(await page.isVisible('.tb-bolo img.photo'));
  await say('hisaab batao');
  assert.match(await reply(), /TB-1-1/);
  await say('english me bolo');
  assert.equal(await page.getAttribute('.tb-bolo [data-lang="en"]', 'aria-pressed'), 'true');
  await say('ruko');
  assert.equal(await reply(), 'Stopping.');
  await page.click('.tb-bolo [data-lang="auto"]');
});

test('estop blocks motion with a clear message', async (t) => {
  if (skip(t)) return;
  await say('emergency');
  assert.equal((await calls()).at(-1).path, '/api/estop');
  await say('20 cm aage');
  assert.match(await reply(), /Emergency stop laga hai|Emergency stop is active/);
  await say('estop reset');
  await say('haan');
  assert.equal((await calls()).at(-1).path, '/api/estop/reset');
});

test('phone width: no horizontal scroll, no console errors', async (t) => {
  if (skip(t)) return;
  const w = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  assert.ok(w[0] <= w[1], `horizontal scroll ${w}`);
  // Network logs for expected 4xx answers (e.g. the 409 in the estop test) are not JS errors.
  assert.deepEqual(consoleErrors.filter((e) => !/favicon|Failed to load resource/i.test(e)), []);
});
