import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCommandStrict, toApiCalls } from "../src/bolo.js";

const MOTION_INFO = new Set([
  "STOP",
  "ESTOP",
  "MOVE",
  "TURN",
  "CLEAN",
  "PHOTO",
  "STATUS",
  "HEALTH",
  "BATTERY",
  "REPORT",
  "MISTAKES",
]);

type Golden = {
  in: string;
  kind: string;
  intents?: string[];
  opts?: Record<string, unknown>;
};

const goldenPath = join(import.meta.dirname, "..", "..", "shared", "lang", "test", "golden.json");
const golden = JSON.parse(readFileSync(goldenPath, "utf8")) as Golden[];

const parityCases = golden
  .filter(
    (g) =>
      g.kind === "command" &&
      g.intents?.length === 1 &&
      MOTION_INFO.has(g.intents[0]) &&
      !g.in.includes("?"),
  )
  .slice(0, 30);

describe("agent/parser parity (30 golden motion+info phrases)", () => {
  it("toApiCalls matches parseCommandStrict for each case", () => {
    expect(parityCases.length).toBe(30);
    const turnLeftSign = 1;
    for (const g of parityCases) {
      const parsed = parseCommandStrict(g.in, { ...(g.opts || {}), now: 0 });
      expect(parsed.kind).toBe("command");
      expect(parsed.steps.length).toBeGreaterThan(0);
      const expectedIntent = g.intents![0];
      expect(parsed.steps[0].intent).toBe(expectedIntent);
      const calls = toApiCalls(parsed.steps[0], { turnLeftSign });
      expect(calls.length).toBeGreaterThan(0);
      if (expectedIntent === "STOP") {
        expect(calls[0]).toEqual({ method: "POST", path: "/api/stop" });
      }
      if (expectedIntent === "MOVE") {
        expect(calls[0].path).toBe("/api/move");
        expect(calls[0].method).toBe("POST");
      }
    }
  });
});
