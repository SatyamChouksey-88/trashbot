import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { createExecutor } from "../src/bolo.js";
import { makeHttp } from "../src/boloHttp.js";

const agentRoot = join(import.meta.dirname, "..");
let mockProc: ChildProcess;
const port = 18790;

async function waitForMock() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/status`);
      if (r.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("mock timeout");
}

beforeAll(async () => {
  mockProc = spawn(process.execPath, ["./node_modules/tsx/dist/cli.mjs", "mock-robot/server.ts"], {
    cwd: agentRoot,
    env: { ...process.env, MOCK_PORT: String(port) },
    stdio: "ignore",
  });
  await waitForMock();
}, 15000);

afterAll(() => mockProc?.kill());

describe("run_command via executor", () => {
  const base = `http://127.0.0.1:${port}`;

  it("dry_run does not POST move for forward command", async () => {
    const calls: string[] = [];
    const http = makeHttp(base);
    const wrapped = async (m: string, p: string, b?: Record<string, unknown>) => {
      calls.push(`${m} ${p}`);
      return http(m, p, b);
    };
    const ex = createExecutor({ http: wrapped, mode: "dry_run" });
    const r = await ex.run("20 cm aage");
    expect(r.text).toMatch(/DRY RUN|dry/i);
    expect(calls.some((c) => c.includes("/api/move"))).toBe(false);
  });

  it("full mode posts move for 20 cm aage", async () => {
    const moves: unknown[] = [];
    const http = makeHttp(base);
    const wrapped = async (m: string, p: string, b?: Record<string, unknown>) => {
      if (p === "/api/move") moves.push(b);
      return http(m, p, b);
    };
    const ex = createExecutor({ http: wrapped, mode: "full", sleep: async () => {} });
    await ex.run("20 cm aage");
    expect(moves.some((b) => (b as { distance_cm?: number })?.distance_cm === 20)).toBe(true);
  });

  it("ghumo then answer 2 turns right", async () => {
    const turns: unknown[] = [];
    const http = makeHttp(base);
    const wrapped = async (m: string, p: string, b?: Record<string, unknown>) => {
      if (p === "/api/turn") turns.push(b);
      return http(m, p, b);
    };
    const ex = createExecutor({ http: wrapped, mode: "full", sleep: async () => {} });
    const a = await ex.run("ghumo");
    expect(a.needsAnswer).toBe(true);
    await ex.run("2");
    const last = turns.at(-1) as { degrees?: number };
    expect(last?.degrees).toBeLessThan(0);
  });

  it("read_only stop sends /api/stop", async () => {
    const calls: string[] = [];
    const http = makeHttp(base);
    const wrapped = async (m: string, p: string, b?: Record<string, unknown>) => {
      calls.push(`${m} ${p}`);
      return http(m, p, b);
    };
    const ex = createExecutor({ http: wrapped, mode: "read_only" });
    await ex.run("ruko");
    expect(calls.some((c) => c.includes("/api/stop"))).toBe(true);
  });
});
