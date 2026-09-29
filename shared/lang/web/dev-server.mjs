#!/usr/bin/env node
/*
 * Try the "Bolo" box on the laptop — no robot, no install, no build.
 *   node shared/lang/web/dev-server.mjs          → open http://localhost:8790
 * It serves the real /lang.mjs + /bolo-ui.mjs and a small fake robot API that just records
 * what the robot WOULD do. Nothing moves. Node's built-in http only (office-laptop safe).
 * Options: PORT=8790, FAKE_BUSY=1 (robot answers 409 "busy cleaning" to motion).
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const LANG = resolve(here, '../trashbot-lang.mjs');
const UI = resolve(here, 'bolo-ui.mjs');
const PORT = Number(process.env.PORT || 8790);

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>TrashBot · Bolo (dev)</title>
<style>body{margin:0;padding:12px;background:#f4f6f5;font-family:system-ui,sans-serif}
@media (prefers-color-scheme:dark){body{background:#0e1011;color:#eee}}
#log{max-width:560px;margin:8px auto;font:12px/1.4 ui-monospace,monospace;white-space:pre-wrap;color:#667}</style></head>
<body><div id="bolo"></div><div id="log">Fake robot calls appear here.</div>
<script type="module">
import * as L from '/lang.mjs';
import { mountBolo } from '/bolo-ui.mjs';
window.bolo = mountBolo(document.getElementById('bolo'), { L });
setInterval(async () => {
  const r = await fetch('/__calls').then((x) => x.json()).catch(() => []);
  document.getElementById('log').textContent = r.slice(-12).map((c) => c.method + ' ' + c.path + (c.body ? ' ' + JSON.stringify(c.body) : '')).join('\\n') || 'Fake robot calls appear here.';
}, 700);
</script></body></html>`;

// 1×1 grey JPEG
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');

const calls = [];
const robot = { mode: 'idle', state: 'IDLE', estop: false, aliases: [], collected: 0, flags: 0 };

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
const inRange = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;

createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let raw = '';
  req.on('data', (c) => { raw += c; if (raw.length > 8192) req.destroy(); });
  req.on('end', () => {
    let body;
    try { body = raw ? JSON.parse(raw) : undefined; } catch { return json(res, 400, { error: 'bad json' }); }
    const p = url.pathname;
    if (p === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(PAGE); }
    if (p === '/lang.mjs' || p === '/bolo-ui.mjs') {
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' });
      return res.end(readFileSync(p === '/lang.mjs' ? LANG : UI));
    }
    if (p === '/__calls') return json(res, 200, calls);
    if (!p.startsWith('/api/')) { res.writeHead(404); return res.end(); }
    calls.push({ method: req.method, path: p + url.search, body });
    const motion = ['/api/move', '/api/turn', '/api/scoop', '/api/clean'].includes(p);
    if (motion && robot.estop) return json(res, 409, { error: 'estop active' });
    if (motion && process.env.FAKE_BUSY) return json(res, 409, { error: 'busy: auto mode' });
    switch (`${req.method} ${p}`) {
      case 'GET /api/status':
        return json(res, 200, { fw: 'dev', api_version: 2, mode: robot.mode, state: robot.state, distance_cm: 63, battery_v: 7.62,
          estop: robot.estop, detections: [{ x: 0.5, y: 0.6, w: 0.1, h: 0.1, score: 0.82 }], turn_left_sign: 1 });
      case 'GET /api/health': return json(res, 200, { overall: 'OK', checks: [] });
      case 'GET /api/photo': res.writeHead(200, { 'Content-Type': 'image/jpeg' }); return res.end(JPEG);
      case 'POST /api/stop': robot.mode = 'idle'; robot.state = 'IDLE'; return json(res, 200, { ok: true });
      case 'POST /api/estop': robot.estop = true; robot.state = 'ESTOP'; return json(res, 200, { ok: true });
      case 'POST /api/estop/reset': robot.estop = false; robot.state = 'IDLE'; return json(res, 200, { ok: true });
      case 'POST /api/move':
        if (!body || !inRange(body.distance_cm, -100, 100) || !inRange(body.speed, 10, 80)) return json(res, 400, { error: 'bad move' });
        return json(res, 200, { ok: true, duration_ms: Math.round(Math.abs(body.distance_cm) * 60) });
      case 'POST /api/turn':
        if (!body || !inRange(body.degrees, -180, 180) || !inRange(body.speed, 10, 80)) return json(res, 400, { error: 'bad turn' });
        return json(res, 200, { ok: true, duration_ms: Math.round(Math.abs(body.degrees) * 8) });
      case 'POST /api/scoop':
        if (!body || !['down', 'carry', 'tip', 'cycle'].includes(body.action)) return json(res, 400, { error: 'bad scoop' });
        return json(res, 200, { ok: true });
      case 'POST /api/clean':
        if (!body || !inRange(body.max_items, 1, 20) || !inRange(body.max_time_s, 10, 600)) return json(res, 400, { error: 'bad clean' });
        robot.mode = 'auto'; robot.state = 'SEARCH';
        return json(res, 200, { ok: true });
      case 'GET /api/mission/current': return json(res, 200, { mission_id: 'TB-1-1', items_collected: 2, items_failed: 1, items_skipped: 0 });
      case 'GET /api/mission/history': return json(res, 200, { missions: [] });
      case 'GET /api/mistakes': return json(res, 200, { mistakes: Array.from({ length: robot.flags }, (_, i) => ({ id: i })) });
      case 'POST /api/mistakes/flag': robot.flags++; return json(res, 200, { ok: true });
      case 'GET /api/aliases': return json(res, 200, { aliases: robot.aliases, max: 50 });
      case 'POST /api/aliases': {
        if (!body || typeof body.phrase !== 'string' || !Array.isArray(body.steps) || body.steps.length < 1 || body.steps.length > 3) {
          return json(res, 400, { error: 'bad alias' });
        }
        const i = robot.aliases.findIndex((a) => a.phrase === body.phrase);
        if (i < 0 && robot.aliases.length >= 50) return json(res, 409, { error: 'full' });
        if (i >= 0) robot.aliases[i] = body; else robot.aliases.push(body);
        return json(res, 200, { ok: true, replaced: i >= 0, count: robot.aliases.length });
      }
      case 'DELETE /api/aliases': {
        const before = robot.aliases.length;
        robot.aliases = robot.aliases.filter((a) => a.phrase !== url.searchParams.get('phrase'));
        return json(res, 200, { ok: true, removed: robot.aliases.length < before });
      }
      case 'POST /api/aliases/reset': robot.aliases = []; return json(res, 200, { ok: true });
      default: return json(res, 404, { error: 'not found' });
    }
  });
}).listen(PORT, () => console.log(`Bolo dev page: http://localhost:${PORT}  (fake robot — nothing moves)`));
