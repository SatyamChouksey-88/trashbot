import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { RobotClient } from "../src/robotClient.js";
import { logSchema, missionSchema, statusSchema } from "../src/contract.js";

const agentRoot = join(import.meta.dirname, "..");
let mockProc: ChildProcess;
let baseUrl: string;

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForMock(port: number, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/status`);
      if (r.ok) return;
    } catch {
      /* retry */
    }
    await wait(100);
  }
  throw new Error("mock did not start");
}

function startMock(port: number, extraEnv: Record<string, string> = {}) {
  mockProc = spawn(process.execPath, ["./node_modules/tsx/dist/cli.mjs", "mock-robot/server.ts"], {
    cwd: agentRoot,
    env: { ...process.env, MOCK_PORT: String(port), ...extraEnv },
    stdio: "ignore",
  });
}

beforeAll(async () => {
  const port = 18787;
  baseUrl = `http://127.0.0.1:${port}`;
  startMock(port);
  await waitForMock(port);
}, 15000);

afterAll(() => {
  mockProc?.kill();
});

describe("mock robot contract", () => {
  const client = () => new RobotClient(baseUrl);

  it("GET /api/status parses", async () => {
    const s = await client().getStatus();
    statusSchema.parse(s);
    expect(s.fw).toContain("mock");
  });

  it("GET /api/photo returns JPEG magic", async () => {
    const buf = await client().getPhoto();
    expect(buf[0]).toBe(0xff);
    expect(buf[1]).toBe(0xd8);
  });

  it("POST manual routes", async () => {
    const c = client();
    await c.setMode("manual");
    await c.postJson("/api/drive", { left: 10, right: 10, duration_ms: 200 });
    await c.move(10, 40);
    await c.turn(45, 40);
    await c.scoop("down");
    const log = await c.getLog(0);
    logSchema.parse(log);
  });

  it("POST /api/estop and reset", async () => {
    const c = client();
    await c.postJson("/api/estop", {});
    await c.postJson("/api/estop/reset", {});
    const log = await c.getLog(0);
    logSchema.parse(log);
  });

  it("mission current API", async () => {
    const c = client();
    const m = missionSchema.parse(await c.getJson("/api/mission/current"));
    expect(m.active === false || m.mission_id !== undefined).toBe(true);
  });

  it("start_cleaning session events", async () => {
    const c = client();
    await c.postJson("/api/clean", { max_items: 2, max_time_s: 30 });
    await wait(2500);
    const log = await c.getLog(0);
    const types = log.events.map((e) => String(e.type));
    expect(types).toContain("session_start");
    expect(types.some((t) => t.includes("collected"))).toBe(true);
    await c.stop();
  });

});

describe("MOCK_FAIL_EVERY", () => {
  let proc: ChildProcess;
  const port = 18789;
  beforeAll(async () => {
    proc = spawn(process.execPath, ["./node_modules/tsx/dist/cli.mjs", "mock-robot/server.ts"], {
      cwd: agentRoot,
      env: { ...process.env, MOCK_PORT: String(port), MOCK_FAIL_EVERY: "1" },
      stdio: "ignore",
    });
    await waitForMock(port);
  });
  afterAll(() => proc.kill());

  it("emits item_failed", async () => {
    const c = new RobotClient(`http://127.0.0.1:${port}`);
    await c.postJson("/api/clean", { max_items: 3, max_time_s: 30 });
    await wait(3500);
    const log = await c.getLog(0);
    const types = log.events.map((e) => String(e.type));
    expect(types).toContain("item_failed");
  });
});
