import { describe, expect, it, vi, afterEach } from "vitest";
import { RobotClient } from "../src/robotClient.js";
import { statusSchema } from "../src/contract.js";

describe("robotClient", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("parses status JSON", () => {
    const data = statusSchema.parse({ fw: "0.1.0", mode: "idle", state: "IDLE" });
    expect(data.fw).toBe("0.1.0");
  });

  it("friendly error when offline", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("network")));
    const c = new RobotClient("http://127.0.0.1:1");
    await expect(c.getStatus()).rejects.toThrow(/not reachable/);
  });

  it("timeout surfaces as not reachable", async () => {
    vi.stubGlobal("fetch", (_url: string, init?: RequestInit) => {
      const err = new Error("The operation was aborted");
      (err as Error & { name: string }).name = "AbortError";
      init?.signal?.dispatchEvent(new Event("abort"));
      return Promise.reject(err);
    });
    const c = new RobotClient("http://127.0.0.1:9");
    await expect(c.getStatus()).rejects.toThrow(/not reachable/);
  });

  it("bad JSON throws", async () => {
    vi.stubGlobal(
      "fetch",
      () =>
        Promise.resolve({
          ok: true,
          json: () => Promise.reject(new Error("invalid json")),
        } as Response),
    );
    const c = new RobotClient("http://127.0.0.1:9");
    await expect(c.getStatus()).rejects.toThrow();
  });

  it("sends token header", async () => {
    const calls: RequestInit[] = [];
    vi.stubGlobal("fetch", (_url: string, init?: RequestInit) => {
      calls.push(init ?? {});
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ fw: "x", mode: "idle", state: "IDLE" }),
      } as Response);
    });
    const c = new RobotClient("http://robot.test", "tok123");
    await c.getStatus();
    const h = calls[0]?.headers as Record<string, string>;
    expect(h["X-TrashBot-Token"]).toBe("tok123");
  });

  it("stop retries POST", async () => {
    let attempts = 0;
    vi.stubGlobal("fetch", () => {
      attempts++;
      if (attempts < 3) return Promise.reject(new Error("fail"));
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve("{}"),
      } as Response);
    });
    const c = new RobotClient("http://127.0.0.1:9");
    await c.stop();
    expect(attempts).toBe(3);
  });
});
