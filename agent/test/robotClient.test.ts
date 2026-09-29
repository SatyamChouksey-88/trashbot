import { describe, expect, it, vi } from "vitest";
import { RobotClient } from "../src/robotClient.js";
import { statusSchema } from "../src/contract.js";

describe("robotClient", () => {
  it("parses status JSON", () => {
    const data = statusSchema.parse({ fw: "0.1.0", mode: "idle", state: "IDLE" });
    expect(data.fw).toBe("0.1.0");
  });

  it("friendly error when offline", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("network")));
    const c = new RobotClient("http://127.0.0.1:1");
    await expect(c.getStatus()).rejects.toThrow(/not reachable/);
    vi.unstubAllGlobals();
  });
});
