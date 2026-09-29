import http from "node:http";
import { PLACEHOLDER_JPEG_B64 } from "./placeholder.js";
import { loadWebIndex } from "./webIndex.js";
import { statusSchema, logSchema } from "../src/contract.js";

const WEB_INDEX = loadWebIndex();
const calibLog: Array<{ key: string; body: unknown }> = [];

const PORT = Number(process.env.MOCK_PORT ?? 8787);
const TOKEN = process.env.MOCK_TOKEN ?? "";
const FAIL_EVERY = Number(process.env.MOCK_FAIL_EVERY ?? 0);

type Mode = "idle" | "manual" | "auto";
let mode: Mode = "idle";
let state = "IDLE";
let estop = false;
let bringupDone = true;
let seq = 0;
let collected = 0;
let failed = 0;
let sessionTimer: ReturnType<typeof setInterval> | null = null;
let itemIndex = 0;

const events: Array<{ seq: number; t_ms: number; type: string; a: number; b: number }> = [];

function push(type: string, a = 0, b = 0) {
  events.push({ seq: ++seq, t_ms: Date.now(), type, a, b });
}

function json(res: http.ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function auth(req: http.IncomingMessage, res: http.ServerResponse) {
  if (!TOKEN) return true;
  if (req.headers["x-trashbot-token"] === TOKEN) return true;
  json(res, 401, { error: "unauthorized" });
  return false;
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
  });
}

function simulateSession(maxItems: number, maxTimeS: number) {
  if (sessionTimer) clearInterval(sessionTimer);
  mode = "auto";
  collected = 0;
  failed = 0;
  itemIndex = 0;
  const endAt = Date.now() + maxTimeS * 1000;
  push("session_start", maxItems, maxTimeS);
  sessionTimer = setInterval(() => {
    if (Date.now() > endAt || collected >= maxItems) {
      if (sessionTimer) clearInterval(sessionTimer);
      sessionTimer = null;
      mode = "idle";
      state = "DONE";
      push("session_done", collected, failed);
      return;
    }
    itemIndex++;
    const shouldFail = FAIL_EVERY > 0 && itemIndex % FAIL_EVERY === 0;
    state = "SEARCH";
    setTimeout(() => {
      state = "APPROACH";
    }, 200);
    setTimeout(() => {
      state = "SCOOP";
    }, 400);
    setTimeout(() => {
      if (shouldFail) {
        failed++;
        push("item_failed");
      } else {
        collected++;
        push("item_collected");
      }
      state = "SEARCH";
    }, 900);
  }, 1000);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  if (!auth(req, res)) return;

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(WEB_INDEX);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/post") {
    return json(res, 200, {
      ok: true,
      reset_reason: "mock",
      checks: { psram: true, nvs: true, camera: true, detector: true, ultrasonic: true, servo: true, wifi: true },
    });
  }

  if (req.method === "GET" && url.pathname === "/api/bringup") {
    return json(res, 200, {
      motor_left_invert: false,
      motor_right_invert: false,
      motor_swap_sides: false,
      camera_vflip: false,
      camera_hmirror: false,
      bringup_done: bringupDone,
      calib_present: true,
    });
  }

  if (req.method === "POST" && url.pathname === "/api/bringup/complete") {
    bringupDone = true;
    return json(res, 200, { ok: true, bringup_done: true });
  }

  if (req.method === "POST" && url.pathname === "/api/bringup") {
    await readBody(req);
    return json(res, 200, { ok: true });
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    return json(res, 200, {
      overall: estop ? "CRITICAL" : "OK",
      checks: [
        { name: "motor_lease", status: "OK", value: "ok" },
        { name: "vision_heartbeat", status: "OK", value: "ok" },
        { name: "mock", status: "OK", value: "ok" },
      ],
    });
  }

  if (req.method === "GET" && url.pathname === "/api/status") {
    const body = statusSchema.parse({
      fw: "0.1.0-mock",
      mode,
      state,
      session: { active: mode === "auto", collected, failed, skipped: 0, max_items: 5, elapsed_s: 0, max_time_s: 180 },
      distance_cm: 42,
      detections: [{ x: 0.5, y: 0.7, w: 0.1, h: 0.1, score: 0.9 }],
      detections_age_ms: 50,
      vision_ms: 120,
      detector: "mock",
      model_loaded: false,
      camera: "mock",
      estop,
      uptime_ms: 1000,
      api_version: 2,
      bringup_done: bringupDone,
      post_ok: true,
    });
    return json(res, 200, body);
  }

  if (req.method === "GET" && url.pathname === "/api/photo") {
    const buf = Buffer.from(PLACEHOLDER_JPEG_B64, "base64");
    res.writeHead(200, { "Content-Type": "image/jpeg", "Content-Length": buf.length });
    res.end(buf);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/log") {
    const since = Number(url.searchParams.get("since") ?? 0);
    const filtered = events.filter((e) => e.seq > since);
    return json(res, 200, logSchema.parse({ events: filtered, last_seq: seq }));
  }

  if (req.method === "POST" && url.pathname === "/api/stop") {
    mode = "idle";
    state = "IDLE";
    if (sessionTimer) clearInterval(sessionTimer);
    return json(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/api/clean") {
    if (!bringupDone) {
      return json(res, 409, { error: "preflight_failed", failed: ["bringup_required"] });
    }
    const body = JSON.parse(await readBody(req));
    simulateSession(body.max_items ?? 5, body.max_time_s ?? 180);
    return json(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/api/mode") {
    const body = JSON.parse(await readBody(req));
    mode = body.mode === "manual" ? "manual" : "idle";
    return json(res, 200, { ok: true, mode });
  }

  if (req.method === "POST" && url.pathname === "/api/estop") {
    estop = true;
    state = "ESTOP";
    push("estop");
    return json(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/api/estop/reset") {
    estop = false;
    state = "IDLE";
    push("estop_reset");
    return json(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/api/drive") {
    if (mode !== "manual") return json(res, 409, { error: "manual only" });
    return json(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/api/move") {
    const body = JSON.parse(await readBody(req));
    return json(res, 200, { ok: true, duration_ms: Math.abs(body.distance_cm ?? 10) * 40 });
  }

  if (req.method === "POST" && url.pathname === "/api/turn") {
    return json(res, 200, { ok: true, duration_ms: 500 });
  }

  if (req.method === "POST" && url.pathname === "/api/scoop") {
    return json(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/calib/")) {
    const key = url.pathname.slice("/api/calib/".length);
    const body = JSON.parse(await readBody(req));
    calibLog.push({ key, body });
    push("calib_saved");
    return json(res, 200, { ok: true, key });
  }

  if (req.method === "GET" && url.pathname === "/api/calib") {
    return json(res, 200, { entries: calibLog });
  }

  json(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  console.error(`Mock TrashBot on http://127.0.0.1:${PORT}`);
});
